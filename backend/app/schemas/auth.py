from typing import Optional
from pydantic import BaseModel, ConfigDict

class UserLoginRequest(BaseModel):
    email: str
    password: str

class UserRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: Optional[str] = "Data Analyst"

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: str
    avatar_color: Optional[str] = "#06b6d4"
    created_at: Optional[str] = None
    last_login: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ForgotPasswordRequest(BaseModel):
    email: str

class ForgotPasswordResponse(BaseModel):
    status: str
    message: str
    email: str
    verification_code: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

class ResetPasswordResponse(BaseModel):
    status: str
    message: str

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

class UpdateProfileResponse(BaseModel):
    status: str
    message: str
    user: UserResponse

