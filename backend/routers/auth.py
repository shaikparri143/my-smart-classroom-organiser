
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
from auth_schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from database import get_db
from dependencies import CurrentUser
from security import create_access_token, hash_password, verify_password


router = APIRouter(prefix="/api/auth", tags=["Authentication"])

DbSession = Annotated[Session, Depends(get_db)]


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterRequest, db: DbSession) -> TokenResponse:
    """Register a student or teacher and return an access token."""
    existing_user = db.scalar(
        select(models.User).where(models.User.email == str(payload.email).lower())
    )

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = models.User(
        full_name=payload.full_name,
        email=str(payload.email).lower(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from None

    token = create_access_token(subject=str(user.id), role=user.role)

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    """Authenticate an account and return a signed access token."""
    user = db.scalar(
        select(models.User).where(models.User.email == str(payload.email).lower())
    )

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive. Please contact an administrator.",
        )

    token = create_access_token(subject=str(user.id), role=user.role)

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: CurrentUser) -> UserResponse:
    """Return the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)
