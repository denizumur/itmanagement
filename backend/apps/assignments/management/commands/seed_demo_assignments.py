from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.assignments.models import Assignment
from apps.employees.models import Employee
from apps.inventory.models import Asset


DEMO_ASSIGNMENTS = [
    ("DEMO-IT-LPT-0001", "DEMO-PER-001"),
    ("DEMO-IT-LPT-0003", "DEMO-PER-002"),
    ("DEMO-IT-PC-0001", "DEMO-PER-003"),
    ("DEMO-IT-TAB-0001", "DEMO-PER-004"),
    ("DEMO-IT-LPT-0002", "DEMO-PER-005"),
]


class Command(BaseCommand):
    help = "Demo aktif zimmet kayıtlarını oluşturur."

    def handle(self, *args, **options):
        User = get_user_model()
        system_user = User.objects.filter(is_superuser=True).first()

        if not system_user:
            raise CommandError("Önce superuser oluşturmalısın.")

        created_count = 0
        skipped_count = 0

        for inventory_code, employee_code in DEMO_ASSIGNMENTS:
            asset = Asset.objects.filter(inventory_code=inventory_code).first()
            employee = Employee.objects.filter(employee_code=employee_code).first()

            if not asset or not employee:
                skipped_count += 1
                continue

            active_exists = Assignment.objects.filter(
                asset=asset,
                returned_at__isnull=True,
            ).exists()

            if active_exists:
                skipped_count += 1
                continue

            Assignment.objects.create(
                asset=asset,
                employee=employee,
                assigned_at=timezone.now(),
                assigned_by=system_user,
                notes="Demo aktif zimmet kaydıdır.",
            )

            asset.status = Asset.Status.ASSIGNED
            asset.updated_by = system_user
            asset.save(update_fields=["status", "updated_by", "updated_at"])

            created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo zimmet seed tamamlandı. "
                f"Oluşturulan: {created_count}, Atlanan: {skipped_count}"
            )
        )