import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('student', 'teacher', 'other', 'admin')",
            name="ck_users_role_allowed",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )

    email: Mapped[str] = mapped_column(
        String(320),
        unique=True,
        index=True,
        nullable=False,
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        default="",
        server_default="",
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(100),
        default="",
        server_default="",
        nullable=False,
    )

    role: Mapped[str] = mapped_column(
        String(32),
        default="student",
        server_default="student",
        nullable=False,
    )

    avatar_path: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    @property
    def avatar_url(self) -> str | None:
        if self.avatar_path is None:
            return None

        return f"/media/{self.avatar_path}"
