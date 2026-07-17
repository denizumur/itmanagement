from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import UserProfile
from apps.reminders.models import Reminder
from apps.tickets.models import Ticket, TicketApproval

MAX_NOTIFICATION_ITEMS = 20
MAX_OVERVIEW_ITEMS = 8

URGENCY_SCORE_OVERDUE_REMINDER = 100
URGENCY_SCORE_URGENT_TICKET = 95
URGENCY_SCORE_DUE_TODAY_REMINDER = 90
URGENCY_SCORE_PENDING_APPROVAL = 85
URGENCY_SCORE_HIGH_TICKET = 80
URGENCY_SCORE_SEVEN_DAY_REMINDER = 60
URGENCY_SCORE_NORMAL_TICKET = 40
URGENCY_SCORE_THIRTY_DAY_REMINDER = 20
URGENCY_SCORE_DEFAULT = 10


def get_user_role(user):
    return getattr(getattr(user, "profile", None), "role", None)


def is_operational_user(user):
    return get_user_role(user) in {
        UserProfile.Role.ADMIN,
        UserProfile.Role.TECHNICIAN,
        UserProfile.Role.VIEWER,
    }


def is_requester(user):
    return get_user_role(user) == UserProfile.Role.REQUESTER


def is_approver(user):
    return get_user_role(user) in {
        UserProfile.Role.APPROVER,
        UserProfile.Role.ADMIN,
    }


def severity_from_score(score):
    return "critical" if score >= URGENCY_SCORE_PENDING_APPROVAL else "normal"


def urgency_label_from_score(score):
    if score >= URGENCY_SCORE_OVERDUE_REMINDER:
        return "Çok kritik"

    if score >= URGENCY_SCORE_PENDING_APPROVAL:
        return "Kritik"

    if score >= URGENCY_SCORE_HIGH_TICKET:
        return "Yüksek"

    if score >= URGENCY_SCORE_SEVEN_DAY_REMINDER:
        return "Orta"

    return "Normal"


def ticket_urgency_score(ticket):
    if ticket.priority == Ticket.Priority.URGENT:
        return URGENCY_SCORE_URGENT_TICKET

    if ticket.priority == Ticket.Priority.HIGH:
        return URGENCY_SCORE_HIGH_TICKET

    return URGENCY_SCORE_NORMAL_TICKET


def requester_ticket_urgency_score(ticket):
    if ticket.priority == Ticket.Priority.URGENT and ticket.status != Ticket.Status.RESOLVED:
        return URGENCY_SCORE_URGENT_TICKET

    if ticket.priority == Ticket.Priority.HIGH and ticket.status != Ticket.Status.RESOLVED:
        return URGENCY_SCORE_HIGH_TICKET

    return URGENCY_SCORE_NORMAL_TICKET


def approval_urgency_score(approval):
    return URGENCY_SCORE_PENDING_APPROVAL


def reminder_urgency_score(reminder):
    days = reminder.days_until_due

    if days < 0:
        return URGENCY_SCORE_OVERDUE_REMINDER

    if days == 0:
        return URGENCY_SCORE_DUE_TODAY_REMINDER

    if days <= 7:
        return URGENCY_SCORE_SEVEN_DAY_REMINDER

    if days <= 30:
        return URGENCY_SCORE_THIRTY_DAY_REMINDER

    return URGENCY_SCORE_DEFAULT


def with_urgency(item, score):
    item["urgency_score"] = score
    item["urgency_label"] = urgency_label_from_score(score)
    item["severity"] = severity_from_score(score)
    return item


def ticket_to_notification(ticket):
    score = ticket_urgency_score(ticket)
    severity = severity_from_score(score)

    item = {
        "id": f"ticket:{ticket.id}",
        "type": "ticket",
        "severity": severity,
        "title": "ACİL ticket" if ticket.priority == Ticket.Priority.URGENT else "Aktif ticket",
        "message": f"#{ticket.id} - {ticket.title}",
        "url": "/tickets",
        "created_at": ticket.created_at,
        "metadata": {
            "ticket_id": ticket.id,
            "status": ticket.status,
            "status_label": ticket.get_status_display(),
            "priority": ticket.priority,
            "priority_label": ticket.get_priority_display(),
            "employee_name": ticket.employee.full_name if ticket.employee else None,
        },
    }

    return with_urgency(item, score)


def requester_ticket_to_notification(ticket):
    score = requester_ticket_urgency_score(ticket)
    severity = severity_from_score(score)

    item = {
        "id": f"ticket:{ticket.id}",
        "type": "ticket",
        "severity": severity,
        "title": "Ticket durumun güncellendi",
        "message": f"#{ticket.id} - {ticket.title}: {ticket.get_status_display()}",
        "url": "/my-tickets",
        "created_at": ticket.updated_at,
        "metadata": {
            "ticket_id": ticket.id,
            "status": ticket.status,
            "status_label": ticket.get_status_display(),
            "priority": ticket.priority,
            "priority_label": ticket.get_priority_display(),
        },
    }

    return with_urgency(item, score)


def approval_to_notification(approval):
    ticket = approval.ticket
    score = approval_urgency_score(approval)
    severity = severity_from_score(score)

    item = {
        "id": f"ticket_approval:{approval.id}",
        "type": "ticket_approval",
        "severity": severity,
        "title": "Onay bekliyor",
        "message": f"#{ticket.id} - {ticket.title}",
        "url": "/approvals",
        "created_at": approval.requested_at,
        "metadata": {
            "approval_id": approval.id,
            "ticket_id": ticket.id,
            "approval_status": approval.status,
            "priority": ticket.priority,
            "priority_label": ticket.get_priority_display(),
            "employee_name": ticket.employee.full_name if ticket.employee else None,
            "approver_name": approval.approver.full_name if approval.approver else None,
        },
    }

    return with_urgency(item, score)


def reminder_bucket(reminder):
    days = reminder.days_until_due

    if days <= 0:
        return "due_today"

    if days <= 7:
        return "seven_days"

    if days <= 30:
        return "thirty_days"

    return None


def reminder_to_notification(reminder):
    days = reminder.days_until_due
    bucket = reminder_bucket(reminder)
    score = reminder_urgency_score(reminder)
    severity = severity_from_score(score)

    if days < 0:
        title = "Gecikmiş hatırlatıcı"
    elif days == 0:
        title = "Bugün son gün"
    elif bucket == "seven_days":
        title = "7 gün içinde"
    else:
        title = "30 gün içinde"

    item = {
        "id": f"reminder:{reminder.id}",
        "type": "reminder",
        "severity": severity,
        "title": title,
        "message": reminder.title,
        "url": "/reminders",
        "created_at": reminder.created_at,
        "metadata": {
            "reminder_id": reminder.id,
            "source_type": reminder.source_type,
            "source_type_label": reminder.get_source_type_display(),
            "due_date": reminder.due_date,
            "days_until_due": days,
            "threshold_days": reminder.threshold_days,
            "bucket": bucket,
        },
    }

    return with_urgency(item, score)


def reminder_dedupe_key(reminder):
    return (
        reminder.source_type,
        reminder.source_id,
        reminder.due_date,
        reminder.channel,
    )


def reminder_threshold_preference(reminder):
    bucket = reminder_bucket(reminder)

    if bucket == "due_today":
        preferred_order = [1, 7, 30, 15]
    elif bucket == "seven_days":
        preferred_order = [7, 1, 30, 15]
    else:
        preferred_order = [30, 15, 7, 1]

    try:
        threshold_rank = preferred_order.index(reminder.threshold_days)
    except ValueError:
        threshold_rank = len(preferred_order)

    return (threshold_rank, reminder.id)


def dedupe_reminders(reminders):
    selected = {}

    for reminder in reminders:
        bucket = reminder_bucket(reminder)

        if not bucket:
            continue

        key = reminder_dedupe_key(reminder)
        current = selected.get(key)

        if current is None:
            selected[key] = reminder
            continue

        if reminder_threshold_preference(reminder) < reminder_threshold_preference(current):
            selected[key] = reminder

    return sorted(
        selected.values(),
        key=lambda reminder: (
            reminder.days_until_due,
            reminder.due_date,
            reminder.id,
        ),
    )


def limit_items(items, limit=MAX_NOTIFICATION_ITEMS):
    return items[:limit]


def sort_notification_items(items):
    return sorted(
        items,
        key=lambda item: (
            -item.get("urgency_score", URGENCY_SCORE_DEFAULT),
            -item["created_at"].timestamp(),
            item["id"],
        ),
    )


def get_pending_approval_notifications(user):
    queryset = (
        TicketApproval.objects.select_related(
            "ticket",
            "ticket__employee",
            "approver",
            "approver_user",
        )
        .filter(
            status=TicketApproval.Status.PENDING,
            ticket__approval_status=Ticket.ApprovalStatus.PENDING,
        )
        .order_by("-requested_at")
    )

    if get_user_role(user) != UserProfile.Role.ADMIN:
        queryset = queryset.filter(approver_user=user)

    return [approval_to_notification(approval) for approval in queryset]


def get_operational_ticket_notifications():
    queryset = (
        Ticket.objects.select_related("employee")
        .filter(
            status__in=[Ticket.Status.OPEN, Ticket.Status.IN_PROGRESS],
            approval_status__in=[
                Ticket.ApprovalStatus.NOT_REQUIRED,
                Ticket.ApprovalStatus.APPROVED,
            ],
        )
        .order_by("-created_at")
    )

    return [ticket_to_notification(ticket) for ticket in queryset]


def get_requester_ticket_notifications(user):
    queryset = (
        Ticket.objects.filter(
            employee__user=user,
            status__in=[
                Ticket.Status.OPEN,
                Ticket.Status.IN_PROGRESS,
                Ticket.Status.RESOLVED,
            ],
        )
        .select_related("employee")
        .order_by("-updated_at")[:10]
    )

    return [requester_ticket_to_notification(ticket) for ticket in queryset]


def get_reminder_notifications():
    today = timezone.localdate()

    queryset = (
        Reminder.objects.select_related("created_by")
        .filter(
            status=Reminder.Status.PENDING,
            channel=Reminder.Channel.IN_APP,
            scheduled_for__lte=today,
            due_date__lte=today + timezone.timedelta(days=30),
        )
        .filter(
            Q(snoozed_until__isnull=True)
            | Q(snoozed_until__lt=today)
        )
        .order_by("due_date", "threshold_days", "id")
    )

    return [
        reminder_to_notification(reminder)
        for reminder in dedupe_reminders(queryset)
    ]


def build_overview(items):
    overview = {
        "urgent_tickets": [],
        "active_tickets": [],
        "pending_approvals": [],
        "reminders_due_today": [],
        "reminders_7_days": [],
        "reminders_30_days": [],
    }

    for item in items:
        item_type = item.get("type")
        metadata = item.get("metadata", {})

        if item_type == "ticket_approval":
            overview["pending_approvals"].append(item)
            continue

        if item_type == "ticket":
            if metadata.get("priority") == Ticket.Priority.URGENT:
                overview["urgent_tickets"].append(item)
            else:
                overview["active_tickets"].append(item)
            continue

        if item_type == "reminder":
            bucket = metadata.get("bucket")

            if bucket == "due_today":
                overview["reminders_due_today"].append(item)
            elif bucket == "seven_days":
                overview["reminders_7_days"].append(item)
            elif bucket == "thirty_days":
                overview["reminders_30_days"].append(item)

    return {
        key: limit_items(value, MAX_OVERVIEW_ITEMS)
        for key, value in overview.items()
    }


def build_notification_items_for_user(user):
    items = []

    if is_operational_user(user):
        items.extend(get_operational_ticket_notifications())
        items.extend(get_reminder_notifications())

        if is_approver(user):
            items.extend(get_pending_approval_notifications(user))

    elif is_approver(user):
        items.extend(get_pending_approval_notifications(user))

    elif is_requester(user):
        items.extend(get_requester_ticket_notifications(user))

    return sort_notification_items(items)


def build_notification_center_response(user):
    items = build_notification_items_for_user(user)

    normal = [item for item in items if item["severity"] == "normal"]
    critical = [item for item in items if item["severity"] == "critical"]

    return {
        "counts": {
            "normal": len(normal),
            "critical": len(critical),
            "total": len(normal) + len(critical),
        },
        "items": limit_items(items),
        "normal": limit_items(normal),
        "critical": limit_items(critical),
        "overview": build_overview(items),
        "polling": {
            "interval_seconds": 1800,
            "normal_interval_seconds": 300,
            "critical_interval_seconds": 1800,
        },
    }