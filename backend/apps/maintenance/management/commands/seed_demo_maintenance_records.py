from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.inventory.models import Asset
from apps.maintenance.models import MaintenanceRecord


DEMO_RECORDS = [
    {
        "asset_code": "DEMO-IT-PRN-0001",
        "type": MaintenanceRecord.Type.MAINTENANCE,
        "days_ago": 85,
        "frequency_days": 90,
        "cost": Decimal("750.00"),
        "performed_by": "DEMO Servis Firması",
        "description": "Yazıcı periyodik bakımı yapıldı. Toner ve tambur kontrol edildi.",
    },
    {
        "asset_code": "DEMO-IT-PRN-0002",
        "type": MaintenanceRecord.Type.REPAIR,
        "days_ago": 12,
        "frequency_days": None,
        "cost": Decimal("1250.00"),
        "performed_by": "DEMO Servis Firması",
        "description": "Kağıt sıkıştırma problemi giderildi.",
        "asset_status_after": Asset.Status.ACTIVE,
    },
    {
        "asset_code": "DEMO-IT-SRV-0001",
        "type": MaintenanceRecord.Type.MAINTENANCE,
        "days_ago": 70,
        "frequency_days": 90,
        "cost": Decimal("0.00"),
        "performed_by": "Bilgi İşlem",
        "description": "Disk sağlığı, güncelleme ve yedekleme kontrolü yapıldı.",
    },
    {
        "asset_code": "DEMO-IT-SW-0001",
        "type": MaintenanceRecord.Type.MAINTENANCE,
        "days_ago": 80,
        "frequency_days": 90,
        "cost": Decimal("0.00"),
        "performed_by": "Bilgi İşlem",
        "description": "Switch port kontrolü ve kablo düzeni kontrol edildi.",
    },
    {
        "asset_code": "DEMO-IT-UPS-0001",
        "type": MaintenanceRecord.Type.MAINTENANCE,
        "days_ago": 190,
        "frequency_days": 180,
        "cost": Decimal("450.00"),
        "performed_by": "DEMO Elektrik Servisi",
        "description": "UPS batarya sağlık kontrolü yapıldı. Bir sonraki bakım gecikmiş durumda.",
    },
    {
        "asset_code": "DEMO-IT-LPT-0099",
        "type": MaintenanceRecord.Type.REPAIR,
        "days_ago": 5,
        "frequency_days": None,
        "cost": Decimal("2300.00"),
        "performed_by": "DEMO Teknik Servis",
        "description": "Arızalı laptop için anakart kontrolü yapıldı. Cihaz servis sonrası aktif hale alındı.",
        "asset_status_after": Asset.Status.IN_STOCK,
    },
    {
        "asset_code": "DEMO-IT-PC-0001",
        "type": MaintenanceRecord.Type.MAINTENANCE,
        "days_ago": 110,
        "frequency_days": 120,
        "cost": Decimal("0.00"),
        "performed_by": "Bilgi İşlem",
        "description": "Toz temizliği, disk kontrolü ve Windows güncelleme kontrolü yapıldı.",
    },
    {
        "asset_code": "DEMO-IT-OTH-0001",
        "type": MaintenanceRecord.Type.DISPOSAL,
        "days_ago": 1,
        "frequency_days": None,
        "cost": Decimal("0.00"),
        "performed_by": "Bilgi İşlem",
        "description": "Kayıp olarak işaretlenen barkod okuyucu için imha/kayıp süreç kaydı açıldı.",
    },
]


class Command(BaseCommand):
    help = "Demo bakım/onarım/imha kayıtlarını oluşturur."

    def handle(self, *args, **options):
        User = get_user_model()
        system_user = User.objects.filter(is_superuser=True).first()

        created_count = 0
        skipped_count = 0
        today = timezone.localdate()

        for item in DEMO_RECORDS:
            asset = Asset.objects.filter(inventory_code=item["asset_code"]).first()

            if not asset:
                skipped_count += 1
                continue

            performed_at = today - timedelta(days=item["days_ago"])
            frequency_days = item.get("frequency_days")

            next_due_date = None
            if frequency_days:
                next_due_date = performed_at + timedelta(days=frequency_days)

            already_exists = MaintenanceRecord.objects.filter(
                asset=asset,
                type=item["type"],
                performed_at=performed_at,
                description=item["description"],
            ).exists()

            if already_exists:
                skipped_count += 1
                continue

            record = MaintenanceRecord.objects.create(
                asset=asset,
                type=item["type"],
                performed_at=performed_at,
                frequency_days=frequency_days,
                next_due_date=next_due_date,
                cost=item["cost"],
                performed_by=item["performed_by"],
                description=item["description"],
                asset_status_before=asset.status,
                asset_status_after=item.get("asset_status_after", ""),
                created_by=system_user,
                updated_by=system_user,
            )

            self.apply_asset_effect(record, system_user)
            created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo bakım kayıtları seed tamamlandı. "
                f"Oluşturulan: {created_count}, Atlanan: {skipped_count}"
            )
        )

    def apply_asset_effect(self, record, user):
        asset = record.asset
        update_fields = ["updated_by", "updated_at"]

        asset.updated_by = user

        if record.type == MaintenanceRecord.Type.MAINTENANCE:
            asset.maintenance_enabled = True
            update_fields.append("maintenance_enabled")

            if record.frequency_days:
                asset.maintenance_frequency_days = record.frequency_days
                update_fields.append("maintenance_frequency_days")

            if record.next_due_date:
                asset.next_maintenance_due_date = record.next_due_date
                update_fields.append("next_maintenance_due_date")

            if record.asset_status_after:
                asset.status = record.asset_status_after
                update_fields.append("status")

        elif record.type == MaintenanceRecord.Type.REPAIR:
            if record.asset_status_after:
                asset.status = record.asset_status_after
            else:
                has_active_assignment = asset.assignments.filter(
                    returned_at__isnull=True
                ).exists()
                asset.status = (
                    Asset.Status.ASSIGNED
                    if has_active_assignment
                    else Asset.Status.ACTIVE
                )

            update_fields.append("status")

        elif record.type == MaintenanceRecord.Type.DISPOSAL:
            asset.status = Asset.Status.DISPOSED
            asset.maintenance_enabled = False
            asset.next_maintenance_due_date = None

            update_fields.extend(
                [
                    "status",
                    "maintenance_enabled",
                    "next_maintenance_due_date",
                ]
            )

        asset.save(update_fields=list(set(update_fields)))