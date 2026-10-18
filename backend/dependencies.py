
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

import models
from database import get_db
from security import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> models.User:
    """Return the authenticated active user or reject the request."""
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)

    if not payload:
        raise credentials_error

    subject = payload.get("sub")

    if not isinstance(subject, str) or not subject.isdigit():
        raise credentials_error

    user = db.get(models.User, int(subject))

    if user is None or not user.is_active:
        raise credentials_error

    return user


def require_roles(*allowed_roles: str) -> Callable:
    """Create a dependency that allows only the specified roles."""

    def role_checker(
        current_user: Annotated[models.User, Depends(get_current_user)],
    ) -> models.User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )

        return current_user

    return role_checker


CurrentUser = Annotated[models.User, Depends(get_current_user)]
CurrentTeacher = Annotated[models.User, Depends(require_roles("teacher"))]
CurrentStudent = Annotated[models.User, Depends(require_roles("student"))]
CurrentAdmin = Annotated[models.User, Depends(require_roles("admin"))]
