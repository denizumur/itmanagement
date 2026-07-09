from django.core.management.base import BaseCommand

from apps.inventory.models import AssetCategory


CATEGORIES = [
    {
        "name": "Laptop",
        "description": "Taşınabilir bilgisayarlar.",
        "custom_fields_schema": {
            "cpu": "text",
            "ram": "text",
            "disk": "text",
            "os": "text",
        },
    },
    {
        "name": "Masaüstü Bilgisayar",
        "description": "Masaüstü bilgisayar kasaları.",
        "custom_fields_schema": {
            "cpu": "text",
            "ram": "text",
            "disk": "text",
            "os": "text",
        },
    },
    {
        "name": "Monitör",
        "description": "Monitör ve ekranlar.",
        "custom_fields_schema": {
            "screen_size": "text",
            "resolution": "text",
        },
    },
    {
        "name": "Yazıcı",
        "description": "USB veya ağ bağlantılı yazıcılar.",
        "custom_fields_schema": {
            "printer_type": "text",
            "connection_type": "text",
            "toner_model": "text",
            "snmp_enabled": "boolean",
        },
    },
    {
        "name": "Telefon",
        "description": "Sabit telefon, IP telefon veya mobil telefonlar.",
        "custom_fields_schema": {
            "imei": "text",
            "phone_type": "text",
        },
    },
    {
        "name": "Tablet",
        "description": "Tablet cihazları.",
        "custom_fields_schema": {
            "imei": "text",
            "os": "text",
        },
    },
    {
        "name": "Sunucu",
        "description": "Fiziksel veya sanal sunucular.",
        "custom_fields_schema": {
            "cpu": "text",
            "ram": "text",
            "disk": "text",
            "os": "text",
            "role": "text",
        },
    },
    {
        "name": "Switch",
        "description": "Network switch cihazları.",
        "custom_fields_schema": {
            "port_count": "number",
            "managed": "boolean",
            "snmp_enabled": "boolean",
        },
    },
    {
        "name": "Firewall",
        "description": "Güvenlik duvarı cihazları.",
        "custom_fields_schema": {
            "license_end_date": "date",
            "vpn_enabled": "boolean",
            "snmp_enabled": "boolean",
        },
    },
    {
        "name": "Modem / Router",
        "description": "Modem ve yönlendirici cihazları.",
        "custom_fields_schema": {
            "wan_type": "text",
            "snmp_enabled": "boolean",
        },
    },
    {
        "name": "UPS",
        "description": "Kesintisiz güç kaynakları.",
        "custom_fields_schema": {
            "capacity_va": "text",
            "battery_replacement_date": "date",
        },
    },
    {
        "name": "Lisans",
        "description": "Yazılım lisansları. İleride licensing modülüne taşınabilir.",
        "custom_fields_schema": {
            "license_key_masked": "text",
            "seat_count": "number",
        },
    },
    {
        "name": "Diğer",
        "description": "Diğer envanter kalemleri.",
        "custom_fields_schema": {},
    },
]


class Command(BaseCommand):
    help = "Varsayılan varlık kategorilerini oluşturur."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for index, category_data in enumerate(CATEGORIES, start=1):
            category, created = AssetCategory.objects.update_or_create(
                name=category_data["name"],
                defaults={
                    "description": category_data["description"],
                    "custom_fields_schema": category_data["custom_fields_schema"],
                    "display_order": index,
                    "is_active": True,
                },
            )

            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Kategori seed tamamlandı. "
                f"Oluşturulan: {created_count}, Güncellenen: {updated_count}"
            )
        )