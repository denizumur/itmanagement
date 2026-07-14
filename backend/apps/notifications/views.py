from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UserProfile
from apps.reminders.models import Reminder
from apps.tickets.models import Ticket


MAX_NOTIFICATION_ITEMS = 20
MAX_OVERVIEW_ITEMS = 8


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


def ticket_to_notification(ticket, *, severity):
    return {
        "id": f"ticket:{ticket.id}",
        "type": "ticket",
        "severity": severity,
        "title": "ACİL ticket" if severity == "critical" else "Aktif ticket",
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


def requester_ticket_to_notification(ticket, *, severity):
    return {
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


def reminder_bucket(reminder):
    days = reminder.days_until_due

    if days <= 0:
        return "due_today"

    if days <= 7:
        return "seven_days"

    if days <= 30:
        return "thirty_days"

    return None


def reminder_to_notification(reminder, *, severity, bucket):
    days = reminder.days_until_due

    if days < 0:
        title = "Gecikmiş hatırlatıcı"
    elif days == 0:
        title = "Bugün son gün"
    elif bucket == "seven_days":
        title = "7 gün içinde"
    else:
        title = "30 gün içinde"

    return {
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


class NotificationCenterAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localdate()

        normal = []
        critical = []

        overview = {
            "urgent_tickets": [],
            "active_tickets": [],
            "reminders_due_today": [],
            "reminders_7_days": [],
            "reminders_30_days": [],
        }

        if is_operational_user(user):
            ticket_queryset = (
                Ticket.objects.select_related("employee")
                .filter(status__in=[Ticket.Status.OPEN, Ticket.Status.IN_PROGRESS])
                .order_by("-created_at")
            )

            for ticket in ticket_queryset:
                if ticket.priority == Ticket.Priority.URGENT:
                    item = ticket_to_notification(ticket, severity="critical")
                    critical.append(item)
                    overview["urgent_tickets"].append(item)
                else:
                    item = ticket_to_notification(ticket, severity="normal")
                    normal.append(item)
                    overview["active_tickets"].append(item)

            reminder_queryset = (
                Reminder.objects.select_related("created_by")
                .filter(
                    status=Reminder.Status.PENDING,
                    channel=Reminder.Channel.IN_APP,
                    scheduled_for__lte=today,
                    due_date__lte=today + timezone.timedelta(days=30),
                )
                .order_by("due_date", "threshold_days", "id")
            )

            for reminder in dedupe_reminders(reminder_queryset):
                bucket = reminder_bucket(reminder)

                if bucket == "due_today":
                    item = reminder_to_notification(
                        reminder,
                        severity="critical",
                        bucket=bucket,
                    )
                    critical.append(item)
                    overview["reminders_due_today"].append(item)

                elif bucket == "seven_days":
                    item = reminder_to_notification(
                        reminder,
                        severity="normal",
                        bucket=bucket,
                    )
                    normal.append(item)
                    overview["reminders_7_days"].append(item)

                elif bucket == "thirty_days":
                    item = reminder_to_notification(
                        reminder,
                        severity="normal",
                        bucket=bucket,
                    )
                    normal.append(item)
                    overview["reminders_30_days"].append(item)

        elif is_requester(user):
            ticket_queryset = (
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

            for ticket in ticket_queryset:
                severity = (
                    "critical"
                    if ticket.priority == Ticket.Priority.URGENT
                    and ticket.status != Ticket.Status.RESOLVED
                    else "normal"
                )

                item = requester_ticket_to_notification(ticket, severity=severity)

                if severity == "critical":
                    critical.append(item)
                else:
                    normal.append(item)

        data = {
            "counts": {
                "normal": len(normal),
                "critical": len(critical),
                "total": len(normal) + len(critical),
            },
            "normal": limit_items(normal),
            "critical": limit_items(critical),
            "overview": {
                "urgent_tickets": limit_items(
                    overview["urgent_tickets"],
                    MAX_OVERVIEW_ITEMS,
                ),
                "active_tickets": limit_items(
                    overview["active_tickets"],
                    MAX_OVERVIEW_ITEMS,
                ),
                "reminders_due_today": limit_items(
                    overview["reminders_due_today"],
                    MAX_OVERVIEW_ITEMS,
                ),
                "reminders_7_days": limit_items(
                    overview["reminders_7_days"],
                    MAX_OVERVIEW_ITEMS,
                ),
                "reminders_30_days": limit_items(
                    overview["reminders_30_days"],
                    MAX_OVERVIEW_ITEMS,
                ),
            },
            "polling": {
                "normal_interval_seconds": 300,
                "critical_interval_seconds": 1800,
            },
        }

        return Response(data)