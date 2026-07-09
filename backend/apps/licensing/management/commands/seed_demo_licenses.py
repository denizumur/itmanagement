from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.inventory.models import Asset
from apps.licensing.models import LicenseSubscription


DEMO_LICENSES = [
    {
        "tracking_code": "DEMO-LIC-M365-001",
        "name": "DEMO - Microsoft 365 Business Premium",
        "type": LicenseSubscription.Type.SUBSCRIPTION,
        "vendor": "Microsoft",
        "license_key_masked": "TENANT-XXXX-M365",
        "seat_count": 25,
        "asset_code": None,
        "start_offset": -330,
        "end_offset": 18,
        "renewal_cost": Decimal("87500.00"),
        "billing_cycle": LicenseSubscription.BillingCycle.YEARLY,
        "auto_renew": True,
        "notes": "Demo Microsoft 365 aboneliği. Yakında yenilenecek.",
    },
    {
        "tracking_code": "DEMO-LIC-ADOBE-001",
        "name": "DEMO - Adobe Creative Cloud",
        "type": LicenseSubscription.Type.SUBSCRIPTION,
        "vendor": "Adobe",
        "license_key_masked": "ADOBE-XXXX-2026",
        "seat_count": 5,
        "asset_code": None,
        "start_offset": -370,
        "end_offset": -5,
        "renewal_cost": Decimal("42000.00"),
        "billing_cycle": LicenseSubscription.BillingCycle.YEARLY,
        "auto_renew": False,
        "notes": "Demo Adobe aboneliği. Süresi geçmiş örnek kayıt.",
    },
    {
        "tracking_code": "DEMO-LIC-ESET-001",
        "name": "DEMO - ESET Endpoint Security",
        "type": LicenseSubscription.Type.LICENSE,
        "vendor": "ESET",
        "license_key_masked": "ESET-XXXX-7890",
        "seat_count": 40,
        "asset_code": None,
        "start_offset": -300,
        "end_offset": 45,
        "renewal_cost": Decimal("36000.00"),
        "billing_cycle": LicenseSubscription.BillingCycle.YEARLY,
        "auto_renew": False,
        "notes": "Demo antivirüs lisansı. 45 gün sonra bitecek.",
    },
    {
        "tracking_code": "DEMO-LIC-FORTI-001",
        "name": "DEMO - FortiGate UTM Bundle",
        "type": LicenseSubscription.Type.SUBSCRIPTION,
        "vendor": "Fortinet",
        "license_key_masked": "FORTI-XXXX-60F",
        "seat_count": 1,
        "asset_code": "DEMO-IT-FW-0001",
        "start_offset": -300,
        "end_offset": 60,
        "renewal_cost": Decimal("28000.00"),
        "billing_cycle": LicenseSubscription.BillingCycle.YEARLY,
        "auto_renew": False,
        "notes": "Demo firewall güvenlik aboneliği.",
    },
    {
        "tracking_code": "DEMO-LIC-BACKUP-001",
        "name": "DEMO - Backup Yazılımı",
        "type": LicenseSubscription.Type.SUBSCRIPTION,
        "vendor": "Veeam",
        "license_key_masked": "VEEAM-XXXX-5555",
        "seat_count": 1,
        "asset_code": "DEMO-IT-SRV-0001",
        "start_offset": -340,
        "end_offset": 12,
        "renewal_cost": Decimal("55000.00"),
        "billing_cycle": LicenseSubscription.BillingCycle.YEARLY,
        "auto_renew": False,
        "notes": "Demo sunucu yedekleme yazılımı. Yakında yenilenecek.",
    },
    {
        "tracking_code": "DEMO-LIC-WINSRV-001",
        "name": "DEMO - Windows Server Standard",
        "type": LicenseSubscription.Type.LICENSE,
        "vendor": "Microsoft",
        "license_key_masked": "WIN-SRV-XXXX-2026",
        "seat_count": 1,
        "asset_code": "DEMO-IT-SRV-0001",
        "start_offset": -700,
        "end_offset": 700,
        "renewal_cost": Decimal("0.00"),
        "billing_cycle": LicenseSubscription.BillingCycle.ONE_TIME,
        "auto_renew": False,
        "notes": "Demo tek seferlik Windows Server lisansı.",
    },
    {
        "tracking_code": "DEMO-LIC-CANVA-001",
        "name": "DEMO - Canva Pro",
        "type": LicenseSubscription.Type.SUBSCRIPTION,
        "vendor": "Canva",
        "license_key_masked": "CANVA-TEAM-XXXX",
        "seat_count": 3,
        "asset_code": None,
        "start_offset": -90,
        "end_offset": 25,
        "renewal_cost": Decimal("7200.00"),
        "billing_cycle": LicenseSubscription.BillingCycle.YEARLY,
        "auto_renew": True,
        "notes": "Demo pazarlama ekibi aboneliği.",
    },
    {
        "tracking_code": "DEMO-LIC-LOGO-001",
        "name": "DEMO - Muhasebe Yazılımı",
        "type": LicenseSubscription.Type.SUBSCRIPTION,
        "vendor": "Logo",
        "license_key_masked": "LOGO-XXXX-2026",
        "seat_count": 4,
        "asset_code": "DEMO-IT-PC-0002",
        "start_offset": -200,
        "end_offset": 8,
        "renewal_cost": Decimal("22000.00"),
        "billing_cycle": LicenseSubscription.BillingCycle.YEARLY,
        "auto_renew": False,
        "notes": "Demo muhasebe yazılım aboneliği. Kritik yenileme örneği.",
    },
]


class Command(BaseCommand):
    help = "Demo lisans/abonelik kayıtlarını oluşturur."

    def handle(self, *args, **options):
        User = get_user_model()
        system_user = User.objects.filter(is_superuser=True).first()

        today = timezone.localdate()
        created_count = 0
        updated_count = 0
        skipped_count = 0

        for item in DEMO_LICENSES:
            assigned_asset = None

            if item["asset_code"]:
                assigned_asset = Asset.objects.filter(
                    inventory_code=item["asset_code"]
                ).first()

                if not assigned_asset:
                    skipped_count += 1
                    continue

            _, created = LicenseSubscription.all_objects.update_or_create(
                tracking_code=item["tracking_code"],
                defaults={
                    "name": item["name"],
                    "type": item["type"],
                    "vendor": item["vendor"],
                    "license_key_masked": item["license_key_masked"],
                    "seat_count": item["seat_count"],
                    "assigned_asset": assigned_asset,
                    "start_date": today + timedelta(days=item["start_offset"]),
                    "end_date": today + timedelta(days=item["end_offset"]),
                    "renewal_cost": item["renewal_cost"],
                    "billing_cycle": item["billing_cycle"],
                    "auto_renew": item["auto_renew"],
                    "is_active": True,
                    "notes": item["notes"],
                    "is_deleted": False,
                    "deleted_at": None,
                    "created_by": system_user,
                    "updated_by": system_user,
                },
            )

            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo lisans seed tamamlandı. "
                f"Oluşturulan: {created_count}, "
                f"Güncellenen: {updated_count}, "
                f"Atlanan: {skipped_count}"
            )
        )