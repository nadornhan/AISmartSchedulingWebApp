import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.auth.dependencies import CurrentUser, DatabaseSession
from app.notifications import service
from app.notifications.schemas import NotificationListResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    db: DatabaseSession,
    current_user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
) -> NotificationListResponse:
    items, unread_count = service.list_notifications(
        db,
        current_user.id,
        limit=limit,
    )
    return NotificationListResponse(
        items=items,
        unread_count=unread_count,
    )


@router.post("/mark-read", response_model=NotificationListResponse)
def mark_notifications_read(
    notification_ids: list[uuid.UUID],
    db: DatabaseSession,
    current_user: CurrentUser,
) -> NotificationListResponse:
    service.mark_notifications_read(
        db,
        current_user.id,
        notification_ids,
    )
    items, unread_count = service.list_notifications(
        db,
        current_user.id,
        limit=5,
        sync_reminders=False,
    )
    return NotificationListResponse(
        items=items,
        unread_count=unread_count,
    )


@router.post("/mark-all-read", response_model=NotificationListResponse)
def mark_all_notifications_read(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> NotificationListResponse:
    service.mark_all_notifications_read(
        db,
        current_user.id,
    )
    items, unread_count = service.list_notifications(
        db,
        current_user.id,
        limit=5,
        sync_reminders=False,
    )
    return NotificationListResponse(
        items=items,
        unread_count=unread_count,
    )
