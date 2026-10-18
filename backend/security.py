
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from pwdlib import PasswordHash

from config import settings


password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash a password before storing it in the database."""
    return password_hasher.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verify a password against its stored hash."""
    try:
        return password_hasher.verify(plain_password, password_hash)
    except (ValueError, TypeError):
        return False


def create_access_token(
    subject: str,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token."""
    if not settings.JWT_SECRET_KEY or len(settings.JWT_SECRET_KEY) < 32:
        raise RuntimeError(
            "JWT_SECRET_KEY must be configured with a strong random secret "
            "of at least 32 characters in backend/.env."
        )

    now = datetime.now(timezone.utc)
    expires_at = now + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a JWT. Return None when it is invalid or expired."""
    if not settings.JWT_SECRET_KEY or len(settings.JWT_SECRET_KEY) < 32:
        raise RuntimeError(
            "JWT_SECRET_KEY must be configured with a strong random secret "
            "of at least 32 characters in backend/.env."
        )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )

        if not isinstance(payload.get("sub"), str):
            return None

        return payload

    except (jwt.InvalidTokenError, TypeError, ValueError):
        return None
