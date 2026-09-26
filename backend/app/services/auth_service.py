import hashlib
import hmac
import json
import base64
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.config import settings
from app.database import utc_now
from app.models.user import User

logger = logging.getLogger("datova.auth")

class AuthService:
    ITERATIONS = 100_000
    ALGORITHM = "sha256"

    @classmethod
    def hash_password(cls, password: str) -> str:
        """Hash password using salted PBKDF2-HMAC-SHA256."""
        salt = secrets.token_hex(16)
        hash_bytes = hashlib.pbkdf2_hmac(
            cls.ALGORITHM,
            password.encode("utf-8"),
            salt.encode("utf-8"),
            cls.ITERATIONS
        )
        return f"pbkdf2:{cls.ALGORITHM}:{cls.ITERATIONS}${salt}${hash_bytes.hex()}"

    @classmethod
    def verify_password(cls, plain_password: str, hashed_password: str) -> bool:
        """Verify plain password against PBKDF2-HMAC-SHA256 hash string."""
        try:
            algorithm_part, salt, stored_hash = hashed_password.split("$")
            _, algo, iters_str = algorithm_part.split(":")
            iters = int(iters_str)
            
            calc_bytes = hashlib.pbkdf2_hmac(
                algo,
                plain_password.encode("utf-8"),
                salt.encode("utf-8"),
                iters
            )
            return hmac.compare_digest(calc_bytes.hex(), stored_hash)
        except Exception as e:
            logger.warning(f"Error verifying password: {e}")
            return False

    @classmethod
    def create_access_token(cls, user: User, expires_hours: Optional[int] = None) -> str:
        """Create HMAC-SHA256 signed bearer token."""
        if expires_hours is None:
            expires_hours = settings.AUTH_TOKEN_EXPIRE_HOURS

        exp = utc_now() + timedelta(hours=expires_hours)
        payload = {
            "sub": str(user.id),
            "email": user.email.lower().strip(),
            "name": user.full_name,
            "role": user.role,
            "exp": int(exp.timestamp())
        }

        payload_json = json.dumps(payload, separators=(',', ':'))
        payload_b64 = base64.urlsafe_b64encode(payload_json.encode('utf-8')).decode('utf-8').rstrip('=')
        
        signature = hmac.new(
            settings.AUTH_SECRET_KEY.encode('utf-8'),
            payload_b64.encode('utf-8'),
            hashlib.sha256
        ).digest()
        sig_b64 = base64.urlsafe_b64encode(signature).decode('utf-8').rstrip('=')

        return f"{payload_b64}.{sig_b64}"

    @classmethod
    def verify_access_token(cls, token: str) -> Optional[Dict[str, Any]]:
        """Verify signed bearer token and return payload if valid and unexpired."""
        try:
            if not token or "." not in token:
                return None
            payload_b64, sig_b64 = token.split(".", 1)

            # Recompute expected signature
            expected_sig = hmac.new(
                settings.AUTH_SECRET_KEY.encode('utf-8'),
                payload_b64.encode('utf-8'),
                hashlib.sha256
            ).digest()
            expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).decode('utf-8').rstrip('=')

            if not hmac.compare_digest(sig_b64, expected_sig_b64):
                logger.warning("Token signature mismatch")
                return None

            # Add padding back if necessary
            rem = len(payload_b64) % 4
            if rem > 0:
                payload_b64 += '=' * (4 - rem)

            payload_bytes = base64.urlsafe_b64decode(payload_b64.encode('utf-8'))
            payload = json.loads(payload_bytes.decode('utf-8'))

            # Check expiration
            exp = payload.get("exp")
            if not exp or utc_now().timestamp() > exp:
                logger.info("Token has expired")
                return None

            return payload
        except Exception as e:
            logger.warning(f"Failed to verify access token: {e}")
            return None

    @classmethod
    def seed_default_users(cls, db: Session) -> None:
        """Ensure demo accounts exist for immediate evaluation."""
        defaults = [
            {
                "email": "demo@datanova.ai",
                "password": "datanova123",
                "full_name": "Alex Chen",
                "role": "Senior AI Analyst",
                "avatar_color": "#06b6d4"
            },
            {
                "email": "admin@datanova.ai",
                "password": "admin123",
                "full_name": "Dr. Elena Vance",
                "role": "Enterprise Architect",
                "avatar_color": "#8b5cf6"
            }
        ]

        for u in defaults:
            existing = db.query(User).filter(User.email == u["email"].lower()).first()
            if not existing:
                logger.info(f"Seeding demo user: {u['email']}")
                new_user = User(
                    email=u["email"].lower(),
                    hashed_password=cls.hash_password(u["password"]),
                    full_name=u["full_name"],
                    role=u["role"],
                    avatar_color=u["avatar_color"]
                )
                db.add(new_user)
        try:
            db.commit()
        except Exception as e:
            logger.error(f"Error seeding default users: {e}")
            db.rollback()

    # In-memory thread-safe password reset store
    _password_reset_codes: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def generate_reset_code(cls, email: str) -> str:
        """Generate a 6-digit secure password reset code expiring in 15 minutes."""
        normalized_email = email.strip().lower()
        code = f"{secrets.randbelow(900000) + 100000}"
        exp = utc_now() + timedelta(minutes=15)

        cls._password_reset_codes[normalized_email] = {
            "code": code,
            "exp": exp
        }
        logger.info(f"[SECURITY] Generated password reset code for {normalized_email}: {code} (expires {exp})")
        return code

    @classmethod
    def verify_and_consume_reset_code(cls, email: str, code: str) -> bool:
        """Verify the 6-digit reset code and remove it if valid."""
        normalized_email = email.strip().lower()
        entry = cls._password_reset_codes.get(normalized_email)

        if not entry:
            logger.warning(f"No password reset request found for {normalized_email}")
            return False

        if utc_now() > entry["exp"]:
            logger.warning(f"Password reset code for {normalized_email} has expired")
            cls._password_reset_codes.pop(normalized_email, None)
            return False

        if hmac.compare_digest(entry["code"].strip(), code.strip()):
            cls._password_reset_codes.pop(normalized_email, None)
            logger.info(f"Password reset code verified for {normalized_email}")
            return True

        logger.warning(f"Incorrect reset code entered for {normalized_email}")
        return False

