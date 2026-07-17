from __future__ import annotations

from typing import Any

from apps.audit.models import AuditLog
from apps.tickets.models import Ticket, TicketApproval, TicketAttachment, TicketComment


TIMELINE_AUDIT_TYPES = {
    "status_changed",
    "assigned_changed",
}


def get_user_display_name(user) -> str:
    if not user:
        return "Sistem"

    full_name = user.get_full_name()

    return full_name or user.username or str(user)


def truncate_text(value: str, limit: int = 180) -> str:
    value = (value or "").strip()

    if len(value) <= limit:
        return value

    return f"{value[:limit].rstrip()}..."


def make_item(
    *,
    item_id: str,
    item_type: str,
    title: str,
    description: str,
    actor_name: str,
    created_at,
    tone: str = "neutral",
    source: str,
    metadata: dict[str, Any] | None = None,
    sort_index: int = 0,
) -> dict[str, Any]:
    return {
        "id": item_id,
        "type": item_type,
        "title": title,
        "description": description,
        "actor_name": actor_name,
        "created_at": created_at,
        "tone": tone,
        "source": source,
        "metadata": metadata or {},
        "_sort_index": sort_index,
    }


def serialize_ticket_created(ticket: Ticket) -> dict[str, Any]:
    return make_item(
        item_id=f"ticket-created-{ticket.id}",
        item_type="ticket_created",
        title="Ticket oluşturuldu",
        description=truncate_text(ticket.description),
        actor_name=get_user_display_name(ticket.created_by),
        created_at=ticket.created_at,
        tone="accent",
        source="ticket",
        metadata={
            "ticket_id": ticket.id,
            "priority": ticket.priority,
            "category": ticket.category,
            "asset_id": ticket.asset_id,
        },
        sort_index=0,
    )


def serialize_approval_items(approval: TicketApproval) -> list[dict[str, Any]]:
    items = [
        make_item(
            item_id=f"approval-requested-{approval.id}",
            item_type="approval_requested",
            title="Onay istendi",
            description=f"{approval.approver.full_name} onayı bekleniyor.",
            actor_name=get_user_display_name(approval.requested_by),
            created_at=approval.requested_at,
            tone="warning",
            source="approval",
            metadata={
                "approval_id": approval.id,
                "approver_id": approval.approver_id,
                "approver_name": approval.approver.full_name,
                "status": approval.status,
            },
            sort_index=10,
        )
    ]

    if approval.status == TicketApproval.Status.APPROVED and approval.decided_at:
        items.append(
            make_item(
                item_id=f"approval-approved-{approval.id}",
                item_type="approval_approved",
                title="Onaylandı",
                description=approval.decision_note or "Yönetici talebi onayladı.",
                actor_name=get_user_display_name(approval.approver_user),
                created_at=approval.decided_at,
                tone="success",
                source="approval",
                metadata={
                    "approval_id": approval.id,
                    "approver_id": approval.approver_id,
                    "approver_name": approval.approver.full_name,
                    "decision_note": approval.decision_note,
                },
                sort_index=20,
            )
        )

    if approval.status == TicketApproval.Status.REJECTED and approval.decided_at:
        items.append(
            make_item(
                item_id=f"approval-rejected-{approval.id}",
                item_type="approval_rejected",
                title="Reddedildi",
                description=approval.decision_note or "Yönetici talebi reddetti.",
                actor_name=get_user_display_name(approval.approver_user),
                created_at=approval.decided_at,
                tone="danger",
                source="approval",
                metadata={
                    "approval_id": approval.id,
                    "approver_id": approval.approver_id,
                    "approver_name": approval.approver.full_name,
                    "decision_note": approval.decision_note,
                },
                sort_index=20,
            )
        )

    return items


def is_solution_note_comment(comment: TicketComment) -> bool:
    normalized = (comment.body or "").strip().lower()

    return normalized.startswith("çözüm notu:") or normalized.startswith(
        "├ç├âz├╝m notu:"
    )


def serialize_comment(comment: TicketComment) -> dict[str, Any]:
    if is_solution_note_comment(comment):
        item_type = "solution_note_added"
        title = "Çözüm notu eklendi"
        tone = "success"
    elif comment.is_internal:
        item_type = "internal_note_added"
        title = "Dahili IT notu eklendi"
        tone = "warning"
    else:
        item_type = "public_comment_added"
        title = "Talep edene yanıt eklendi"
        tone = "accent"

    return make_item(
        item_id=f"comment-{comment.id}",
        item_type=item_type,
        title=title,
        description=truncate_text(comment.body),
        actor_name=get_user_display_name(comment.author),
        created_at=comment.created_at,
        tone=tone,
        source="comment",
        metadata={
            "comment_id": comment.id,
            "is_internal": comment.is_internal,
        },
        sort_index=30,
    )


def serialize_attachment(attachment: TicketAttachment) -> dict[str, Any]:
    return make_item(
        item_id=f"attachment-{attachment.id}",
        item_type="attachment_uploaded",
        title="Ek dosya yüklendi",
        description=attachment.original_filename,
        actor_name=get_user_display_name(attachment.uploaded_by),
        created_at=attachment.uploaded_at,
        tone="neutral",
        source="attachment",
        metadata={
            "attachment_id": attachment.id,
            "filename": attachment.original_filename,
            "mime_type": attachment.mime_type,
            "size_bytes": attachment.size_bytes,
        },
        sort_index=40,
    )


def serialize_audit_log(log: AuditLog) -> dict[str, Any] | None:
    metadata = log.metadata or {}
    timeline_type = metadata.get("timeline_type")

    if timeline_type not in TIMELINE_AUDIT_TYPES:
        return None

    if timeline_type == "status_changed":
        return make_item(
            item_id=f"audit-{log.id}",
            item_type="status_changed",
            title="Durum değişti",
            description=(
                f"{metadata.get('status_before_label') or metadata.get('status_before') or '-'}"
                f" → "
                f"{metadata.get('status_after_label') or metadata.get('status_after') or '-'}"
            ),
            actor_name=get_user_display_name(log.actor),
            created_at=log.created_at,
            tone="accent",
            source="audit",
            metadata=metadata,
            sort_index=50,
        )

    if timeline_type == "assigned_changed":
        return make_item(
            item_id=f"audit-{log.id}",
            item_type="assigned_changed",
            title="Atanan kişi değişti",
            description=(
                f"{metadata.get('assigned_to_before_name') or 'Atanmamış'}"
                f" → "
                f"{metadata.get('assigned_to_after_name') or 'Atanmamış'}"
            ),
            actor_name=get_user_display_name(log.actor),
            created_at=log.created_at,
            tone="warning",
            source="audit",
            metadata=metadata,
            sort_index=50,
        )

    return None


def build_ticket_timeline(ticket: Ticket) -> dict[str, Any]:
    items: list[dict[str, Any]] = [serialize_ticket_created(ticket)]

    approvals = (
        TicketApproval.objects.select_related(
            "approver",
            "approver_user",
            "requested_by",
        )
        .filter(ticket=ticket)
        .order_by("requested_at", "id")
    )

    for approval in approvals:
        items.extend(serialize_approval_items(approval))

    comments = (
        TicketComment.objects.select_related("author")
        .filter(ticket=ticket)
        .order_by("created_at", "id")
    )

    for comment in comments:
        items.append(serialize_comment(comment))

    attachments = (
        TicketAttachment.objects.select_related("uploaded_by")
        .filter(ticket=ticket)
        .order_by("uploaded_at", "id")
    )

    for attachment in attachments:
        items.append(serialize_attachment(attachment))

    audit_logs = (
        AuditLog.objects.select_related("actor")
        .filter(
            metadata__module="tickets",
            metadata__ticket_id=ticket.id,
        )
        .order_by("created_at", "id")
    )

    for log in audit_logs:
        item = serialize_audit_log(log)

        if item:
            items.append(item)

    items.sort(
        key=lambda item: (
            item["created_at"],
            item["_sort_index"],
            item["id"],
        )
    )

    for item in items:
        item.pop("_sort_index", None)

    return {
        "ticket": ticket.id,
        "items": items,
    }