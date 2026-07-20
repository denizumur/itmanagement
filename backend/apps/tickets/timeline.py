from __future__ import annotations

from typing import Any

from apps.audit.models import AuditLog
from apps.tickets.models import (
    Ticket,
    TicketApproval,
    TicketAttachment,
    TicketComment,
    TicketITDecision,
)


TIMELINE_AUDIT_TYPES = {
    "status_changed",
    "assigned_changed",
    "requester_resubmitted",
}


def get_user_display_name(user) -> str:
    if not user:
        return "Sistem"

    full_name = user.get_full_name()

    return full_name or user.username or str(user)


def get_employee_display_name(employee) -> str:
    if not employee:
        return "Sistem"

    return employee.full_name or str(employee)


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


def make_stage(
    *,
    stage_id: str,
    stage: str,
    label: str,
    state: str,
    actor_name: str | None = None,
    timestamp=None,
    comment: str | None = None,
    round_number: int = 1,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": stage_id,
        "stage": stage,
        "label": label,
        "state": state,
        "actor": actor_name,
        "actor_name": actor_name,
        "timestamp": timestamp,
        "created_at": timestamp,
        "comment": comment,
        "round": round_number,
        "metadata": metadata or {},
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


def serialize_created_stage(ticket: Ticket) -> dict[str, Any]:
    return make_stage(
        stage_id=f"stage-created-{ticket.id}",
        stage="created",
        label="Ticket açıldı",
        state="done",
        actor_name=get_user_display_name(ticket.created_by),
        timestamp=ticket.created_at,
        comment=truncate_text(ticket.description),
        round_number=1,
        metadata={
            "ticket_id": ticket.id,
            "priority": ticket.priority,
            "priority_label": ticket.get_priority_display(),
            "category": ticket.category,
            "category_label": ticket.get_category_display(),
            "asset_id": ticket.asset_id,
        },
    )


def approval_state(approval: TicketApproval) -> str:
    if approval.status == TicketApproval.Status.APPROVED:
        return "approved"

    if approval.status == TicketApproval.Status.REJECTED:
        return "rejected"

    return "pending"


def approval_tone(approval: TicketApproval) -> str:
    if approval.status == TicketApproval.Status.APPROVED:
        return "success"

    if approval.status == TicketApproval.Status.REJECTED:
        return "danger"

    return "warning"


def approval_timestamp(approval: TicketApproval):
    return approval.decided_at or approval.requested_at


def serialize_approval_stage(
    approval: TicketApproval,
    *,
    round_number: int,
) -> dict[str, Any]:
    state = approval_state(approval)

    if state == "approved":
        label = "Onaylandı"
    elif state == "rejected":
        label = "Reddedildi"
    else:
        label = "Onay bekliyor"

    return make_stage(
        stage_id=f"stage-approval-{approval.id}",
        stage="approval",
        label=label,
        state=state,
        actor_name=get_employee_display_name(approval.approver),
        timestamp=approval_timestamp(approval),
        comment=approval.decision_note or None,
        round_number=round_number,
        metadata={
            "approval_id": approval.id,
            "approver_id": approval.approver_id,
            "approver_user_id": approval.approver_user_id,
            "requested_by_id": approval.requested_by_id,
            "requested_at": approval.requested_at,
            "decided_at": approval.decided_at,
            "status": approval.status,
            "status_label": approval.get_status_display(),
        },
    )


def serialize_skipped_approval_stage(ticket: Ticket) -> dict[str, Any]:
    return make_stage(
        stage_id=f"stage-approval-skipped-{ticket.id}",
        stage="approval",
        label="Onay gerekmedi",
        state="skipped",
        actor_name=None,
        timestamp=ticket.created_at,
        comment="Bu talep için yönetici onayı gerekmedi.",
        round_number=1,
        metadata={
            "approval_status": ticket.approval_status,
            "approval_status_label": ticket.get_approval_status_display(),
        },
    )


def serialize_approval_items(approval: TicketApproval) -> list[dict[str, Any]]:
    approver_name = get_employee_display_name(approval.approver)

    items = [
        make_item(
            item_id=f"approval-requested-{approval.id}",
            item_type="approval_requested",
            title="Onay istendi",
            description=f"{approver_name} onayı bekleniyor.",
            actor_name=get_user_display_name(approval.requested_by),
            created_at=approval.requested_at,
            tone="warning",
            source="approval",
            metadata={
                "approval_id": approval.id,
                "approver_id": approval.approver_id,
                "approver_name": approver_name,
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
                    "approver_name": approver_name,
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
                    "approver_name": approver_name,
                    "decision_note": approval.decision_note,
                },
                sort_index=20,
            )
        )

    return items


def is_solution_note_comment(comment: TicketComment) -> bool:
    normalized = (comment.body or "").strip().lower()

    return normalized.startswith("çözüm notu:")


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


def serialize_it_decision(decision: TicketITDecision) -> dict[str, Any]:
    return make_item(
        item_id=f"it-decision-{decision.id}",
        item_type="it_returned_to_requester",
        title="IT talebi geri gönderdi",
        description=truncate_text(decision.comment),
        actor_name=get_user_display_name(decision.technician),
        created_at=decision.decided_at,
        tone="danger",
        source="it_decision",
        metadata={
            "decision_id": decision.id,
            "decision": decision.decision,
            "decision_label": decision.get_decision_display(),
            "ticket_id": decision.ticket_id,
        },
        sort_index=35,
    )


def serialize_it_return_stage(
    decision: TicketITDecision,
    *,
    round_number: int,
) -> dict[str, Any]:
    return make_stage(
        stage_id=f"stage-it-return-{decision.id}",
        stage="it_review",
        label="IT geri gönderdi",
        state="returned",
        actor_name=get_user_display_name(decision.technician),
        timestamp=decision.decided_at,
        comment=decision.comment,
        round_number=round_number,
        metadata={
            "decision_id": decision.id,
            "decision": decision.decision,
            "decision_label": decision.get_decision_display(),
            "ticket_id": decision.ticket_id,
        },
    )


def current_it_review_state(ticket: Ticket) -> str:
    if ticket.status in {Ticket.Status.RESOLVED, Ticket.Status.CLOSED}:
        return "resolved"

    if ticket.status == Ticket.Status.IN_PROGRESS or ticket.assigned_to_id:
        return "in_progress"

    if ticket.status == Ticket.Status.RETURNED_TO_REQUESTER:
        return "returned"

    return "pending"


def current_it_review_actor(ticket: Ticket) -> str | None:
    if ticket.resolved_by:
        return get_user_display_name(ticket.resolved_by)

    if ticket.closed_by:
        return get_user_display_name(ticket.closed_by)

    if ticket.assigned_to:
        return get_user_display_name(ticket.assigned_to)

    return None


def current_it_review_comment(ticket: Ticket) -> str:
    state = current_it_review_state(ticket)

    if state == "resolved":
        return ticket.resolution_note or "Ticket çözüldü."

    if state == "in_progress":
        return "Ticket IT tarafından inceleniyor."

    if state == "returned":
        return "Ticket talep sahibine geri gönderildi."

    return "IT incelemesi bekleniyor."


def serialize_current_it_review_stage(
    ticket: Ticket,
    *,
    round_number: int,
) -> dict[str, Any]:
    state = current_it_review_state(ticket)

    if state == "resolved":
        label = "IT çözümledi"
        timestamp = ticket.resolved_at or ticket.closed_at or ticket.updated_at
    elif state == "in_progress":
        label = "IT inceliyor"
        timestamp = ticket.updated_at
    elif state == "returned":
        label = "IT geri gönderdi"
        timestamp = ticket.updated_at
    else:
        label = "IT incelemesi bekliyor"
        timestamp = None

    return make_stage(
        stage_id=f"stage-it-current-{ticket.id}-{round_number}",
        stage="it_review",
        label=label,
        state=state,
        actor_name=current_it_review_actor(ticket),
        timestamp=timestamp,
        comment=current_it_review_comment(ticket),
        round_number=round_number,
        metadata={
            "status": ticket.status,
            "status_label": ticket.get_status_display(),
            "assigned_to_id": ticket.assigned_to_id,
        },
    )


def serialize_blocked_it_review_stage(
    ticket: Ticket,
    *,
    round_number: int,
    reason: str,
) -> dict[str, Any]:
    return make_stage(
        stage_id=f"stage-it-blocked-{ticket.id}-{round_number}",
        stage="it_review",
        label="IT incelemesi bekliyor",
        state="pending",
        actor_name=None,
        timestamp=None,
        comment=reason,
        round_number=round_number,
        metadata={
            "status": ticket.status,
            "status_label": ticket.get_status_display(),
            "approval_status": ticket.approval_status,
            "approval_status_label": ticket.get_approval_status_display(),
        },
    )


def serialize_resolved_stage(ticket: Ticket) -> dict[str, Any]:
    is_resolved = ticket.status in {Ticket.Status.RESOLVED, Ticket.Status.CLOSED}
    timestamp = ticket.resolved_at or ticket.closed_at

    return make_stage(
        stage_id=f"stage-resolved-{ticket.id}",
        stage="resolved",
        label="Çözüldü",
        state="done" if is_resolved else "pending",
        actor_name=current_it_review_actor(ticket) if is_resolved else None,
        timestamp=timestamp if is_resolved else None,
        comment=ticket.resolution_note or None,
        round_number=1,
        metadata={
            "status": ticket.status,
            "status_label": ticket.get_status_display(),
            "resolved_at": ticket.resolved_at,
            "closed_at": ticket.closed_at,
        },
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

    if timeline_type == "requester_resubmitted":
        return make_item(
            item_id=f"audit-{log.id}",
            item_type="requester_resubmitted",
            title="Talep tekrar gönderildi",
            description="Talep sahibi eksikleri güncelleyip ticket'ı tekrar gönderdi.",
            actor_name=get_user_display_name(log.actor),
            created_at=log.created_at,
            tone="accent",
            source="audit",
            metadata=metadata,
            sort_index=45,
        )

    return None


def get_return_decisions_between(
    decisions: list[TicketITDecision],
    *,
    start_at,
    end_at=None,
) -> list[TicketITDecision]:
    matched_decisions = []

    for decision in decisions:
        if decision.decided_at < start_at:
            continue

        if end_at and decision.decided_at >= end_at:
            continue

        matched_decisions.append(decision)

    return matched_decisions


def build_ticket_timeline_stages(ticket: Ticket) -> list[dict[str, Any]]:
    stages: list[dict[str, Any]] = [serialize_created_stage(ticket)]

    approvals = list(
        TicketApproval.objects.select_related(
            "approver",
            "approver_user",
            "requested_by",
        )
        .filter(ticket=ticket)
        .order_by("requested_at", "id")
    )

    decisions = list(
        TicketITDecision.objects.select_related("technician")
        .filter(ticket=ticket)
        .order_by("decided_at", "id")
    )

    if not approvals:
        stages.append(serialize_skipped_approval_stage(ticket))

        for index, decision in enumerate(decisions, start=1):
            stages.append(
                serialize_it_return_stage(
                    decision,
                    round_number=index,
                )
            )

        if ticket.status != Ticket.Status.RETURNED_TO_REQUESTER:
            stages.append(
                serialize_current_it_review_stage(
                    ticket,
                    round_number=max(len(decisions) + 1, 1),
                )
            )

        stages.append(serialize_resolved_stage(ticket))
        return stages

    for index, approval in enumerate(approvals, start=1):
        next_approval = approvals[index] if index < len(approvals) else None

        stages.append(
            serialize_approval_stage(
                approval,
                round_number=index,
            )
        )

        if approval.status == TicketApproval.Status.APPROVED:
            start_at = approval.decided_at or approval.requested_at
            end_at = next_approval.requested_at if next_approval else None
            round_return_decisions = get_return_decisions_between(
                decisions,
                start_at=start_at,
                end_at=end_at,
            )

            for decision in round_return_decisions:
                stages.append(
                    serialize_it_return_stage(
                        decision,
                        round_number=index,
                    )
                )

            is_latest_approval = next_approval is None
            has_return_after_latest_approval = bool(round_return_decisions)

            if is_latest_approval:
                if ticket.status == Ticket.Status.RETURNED_TO_REQUESTER:
                    if not has_return_after_latest_approval:
                        stages.append(
                            serialize_current_it_review_stage(
                                ticket,
                                round_number=index,
                            )
                        )
                else:
                    stages.append(
                        serialize_current_it_review_stage(
                            ticket,
                            round_number=index,
                        )
                    )

        elif approval.status == TicketApproval.Status.PENDING:
            stages.append(
                serialize_blocked_it_review_stage(
                    ticket,
                    round_number=index,
                    reason="Yönetici onayı bekleniyor.",
                )
            )

        elif approval.status == TicketApproval.Status.REJECTED:
            stages.append(
                serialize_blocked_it_review_stage(
                    ticket,
                    round_number=index,
                    reason="Yönetici reddi nedeniyle IT incelemesine aktarılmadı.",
                )
            )

    stages.append(serialize_resolved_stage(ticket))
    return stages


def build_ticket_timeline_items(ticket: Ticket) -> list[dict[str, Any]]:
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

    decisions = (
        TicketITDecision.objects.select_related("technician")
        .filter(ticket=ticket)
        .order_by("decided_at", "id")
    )

    for decision in decisions:
        items.append(serialize_it_decision(decision))

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

    return items


def build_ticket_timeline(ticket: Ticket) -> dict[str, Any]:
    return {
        "ticket": ticket.id,
        "current_status": ticket.status,
        "current_status_label": ticket.get_status_display(),
        "current_approval_status": ticket.approval_status,
        "current_approval_status_label": ticket.get_approval_status_display(),
        "stages": build_ticket_timeline_stages(ticket),
        "items": build_ticket_timeline_items(ticket),
    }