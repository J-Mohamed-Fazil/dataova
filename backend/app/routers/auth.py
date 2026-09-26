import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from app.database import get_db, utc_now
from app.models.user import User
from app.schemas.auth import (
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    UpdateProfileRequest,
    UpdateProfileResponse
)
from app.services.auth_service import AuthService

logger = logging.getLogger("datova.auth_router")

router = APIRouter(prefix="/auth", tags=["Authentication"])

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Dependency to extract and verify current authenticated user from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token."
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    payload = AuthService.verify_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or token is invalid. Please sign in again."
        )

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated."
        )

    return user

def get_optional_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Extract user if Bearer token present and valid, otherwise returns None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split("Bearer ", 1)[1].strip()
        payload = AuthService.verify_access_token(token)
        if not payload or "sub" not in payload:
            return None
        user = db.query(User).filter(User.id == payload["sub"]).first()
        if user and user.is_active:
            return user
    except Exception:
        return None
    return None

@router.post("/login", response_model=AuthResponse)
def login(request: UserLoginRequest, db: Session = Depends(get_db)):
    """Authenticate user with email and password."""
    email = request.email.strip().lower()
    if not email or not request.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required."
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address. Please create a new account to continue."
        )

    if not AuthService.verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please check your password and try again."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled."
        )

    # Update last login
    user.last_login = utc_now()
    db.commit()
    db.refresh(user)

    token = AuthService.create_access_token(user)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(**user.to_dict())
    )

@router.post("/register", response_model=AuthResponse)
def register(request: UserRegisterRequest, db: Session = Depends(get_db)):
    """Register a new user account with email, password, and name."""
    email = request.email.strip().lower()
    full_name = request.full_name.strip()
    
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email address is required."
        )
    if len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )
    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name is required."
        )

    # Check for existing email
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{email}' already exists. Please sign in instead."
        )

    hashed_pw = AuthService.hash_password(request.password)
    user = User(
        email=email,
        hashed_password=hashed_pw,
        full_name=full_name,
        role=request.role or "Data Analyst",
        avatar_color="#06b6d4",
        last_login=utc_now()
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = AuthService.create_access_token(user)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(**user.to_dict())
    )

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(user: User = Depends(get_current_user)):
    """Fetch currently authenticated user profile."""
    return UserResponse(**user.to_dict())

@router.put("/profile", response_model=UpdateProfileResponse)
def update_user_profile(
    request: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile details including role and password."""
    updated = False

    if request.full_name is not None and request.full_name.strip():
        user.full_name = request.full_name.strip()
        updated = True

    if request.role is not None and request.role.strip():
        user.role = request.role.strip()
        updated = True

    if request.new_password:
        if not request.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required to change your password."
            )
        if not AuthService.verify_password(request.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password does not match. Please enter your valid password."
            )
        if len(request.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 6 characters long."
            )
        user.hashed_password = AuthService.hash_password(request.new_password)
        updated = True

    if updated:
        db.commit()
        db.refresh(user)
        logger.info(f"User profile updated: {user.email} (Role: {user.role})")

    return UpdateProfileResponse(
        status="success",
        message="Profile updated successfully.",
        user=UserResponse(**user.to_dict())
    )

@router.post("/logout")
def logout():
    """Client-side token invalidation confirmation."""
    return {"status": "success", "message": "Logged out successfully."}

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Generate and dispatch a 6-digit password reset verification code."""
    email = request.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email address is required."
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address. Please check your spelling or register."
        )

    code = AuthService.generate_reset_code(user.email)
    logger.info(f"Password reset requested for {user.email}. Verification code: {code}")

    return ForgotPasswordResponse(
        status="success",
        message=f"A 6-digit security verification code has been dispatched to {user.email}.",
        email=user.email,
        verification_code=code
    )

@router.post("/reset-password", response_model=ResetPasswordResponse)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Verify reset code and update user's password."""
    email = request.email.strip().lower()
    code = request.code.strip()

    if not email or not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and verification code are required."
        )

    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long."
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found."
        )

    # Verify code
    is_valid = AuthService.verify_and_consume_reset_code(email, code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code. Please request a new code."
        )

    # Update password
    user.hashed_password = AuthService.hash_password(request.new_password)
    db.commit()
    logger.info(f"Password successfully reset for user: {user.email}")

    return ResetPasswordResponse(
        status="success",
        message="Password has been successfully updated. You can now log in with your new credentials."
    )

