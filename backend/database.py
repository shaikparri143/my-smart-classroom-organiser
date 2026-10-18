from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import settings


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class inherited by all SQLAlchemy database models."""

    pass


def initialize_database() -> None:
    """Create any missing tables so new schema changes do not crash startup."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Provide one database session per API request."""
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> bool:
    """Check whether PostgreSQL is reachable."""
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return True
