from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import create_audit_log, serialize_instance
from apps.tickets.models import Ticket


TICKET_AUDIT_EXCLUDE_FIELDS = (
    "created_at",
    "updated_at",
)


def get_choice_label(choices, value):
    return dict(choices).get(value, value)


class Command(BaseCommand):
    help = (
        "Requester teyidi bekleyen eski resolved ticketları otomatik olarak "
        "closed durumuna alır."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=3,
            help="resolved_at tarihinden kaç gün sonra otomatik kapatılacağı.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Kapatılacak ticketları listeler ama veritabanını değiştirmez.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        dry_run = options["dry_run"]

        if days < 1:
            raise CommandError("--days değeri en az 1 olmalıdır.")

        now = timezone.now()
        cutoff = now - timedelta(days=days)

        queryset = (
            Ticket.objects.select_related(
                "employee",
                "resolved_by",
                "closed_by",
                "created_by",
            )
            .filter(
                status=Ticket.Status.RESOLVED,
                resolved_at__isnull=False,
                resolved_at__lte=cutoff,
            )
            .order_by("resolved_at", "id")
        )

        total = queryset.count()

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"DRY RUN: {total} ticket otomatik kapatılmaya uygun."
                )
            )

            for ticket in queryset:
                self.stdout.write(
                    f"- #{ticket.id} | {ticket.title} | resolved_at={ticket.resolved_at}"
                )

            return

        closed_count = 0

        for ticket in queryset:
            with transaction.atomic():
                before = serialize_instance(
                    ticket,
                    exclude=TICKET_AUDIT_EXCLUDE_FIELDS,
                )
                status_before = ticket.status

                ticket.status = Ticket.Status.CLOSED
                ticket.closed_by = None
                ticket.closed_at = now
                ticket.save(
                    update_fields=[
                        "status",
                        "closed_by",
                        "closed_at",
                        "updated_at",
                    ]
                )
                ticket.refresh_from_db()

                after = serialize_instance(
                    ticket,
                    exclude=TICKET_AUDIT_EXCLUDE_FIELDS,
                )

                create_audit_log(
                    request=None,
                    action=AuditLog.Action.STATUS_CHANGE,
                    instance=ticket,
                    before=before,
                    after=after,
                    metadata={
                        "module": "tickets",
                        "operation": "system_auto_closed_resolution",
                        "ticket_id": ticket.id,
                        "timeline_type": "system_auto_closed_resolution",
                        "status_before": status_before,
                        "status_after": ticket.status,
                        "status_before_label": get_choice_label(
                            Ticket.Status.choices,
                            status_before,
                        ),
                        "status_after_label": ticket.get_status_display(),
                        "auto_closed_after_days": days,
                        "resolved_at": ticket.resolved_at,
                        "closed_at": ticket.closed_at,
                    },
                )

                closed_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"{closed_count} ticket otomatik olarak kapatıldı. days={days}"
            )
        )