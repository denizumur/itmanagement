from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.inventory.models import Asset, AssetCategory


DEMO_ASSETS = [
    # Laptoplar
    {
        "category": "Laptop",
        "name": "DEMO - Genel Müdür Laptop",
        "brand": "Lenovo",
        "model": "ThinkPad X1 Carbon",
        "serial_number": "DEMO-LPT-0001",
        "inventory_code": "DEMO-IT-LPT-0001",
        "status": Asset.Status.ASSIGNED,
        "location": "Genel Müdürlük",
        "purchase_price": Decimal("62000.00"),
        "maintenance_frequency_days": 180,
        "maintenance_due_offset": 25,
        "warranty_offset": 420,
        "custom_fields": {
            "cpu": "Intel i7",
            "ram": "32 GB",
            "disk": "1 TB SSD",
            "os": "Windows 11 Pro",
        },
    },
    {
        "category": "Laptop",
        "name": "DEMO - Bilgi İşlem Laptop 01",
        "brand": "Lenovo",
        "model": "ThinkPad E14",
        "serial_number": "DEMO-LPT-0002",
        "inventory_code": "DEMO-IT-LPT-0002",
        "status": Asset.Status.ASSIGNED,
        "location": "Bilgi İşlem Odası",
        "purchase_price": Decimal("28500.00"),
        "maintenance_frequency_days": 180,
        "maintenance_due_offset": -3,
        "warranty_offset": 260,
        "custom_fields": {
            "cpu": "Intel i5",
            "ram": "16 GB",
            "disk": "512 GB SSD",
            "os": "Windows 11 Pro",
        },
    },
    {
        "category": "Laptop",
        "name": "DEMO - Muhasebe Laptop",
        "brand": "HP",
        "model": "ProBook 450 G10",
        "serial_number": "DEMO-LPT-0003",
        "inventory_code": "DEMO-IT-LPT-0003",
        "status": Asset.Status.ASSIGNED,
        "location": "İdari ve Mali İşler Müdürlüğü",
        "purchase_price": Decimal("31000.00"),
        "maintenance_frequency_days": 180,
        "maintenance_due_offset": 12,
        "warranty_offset": 120,
        "custom_fields": {
            "cpu": "Intel i5",
            "ram": "16 GB",
            "disk": "512 GB SSD",
            "os": "Windows 11 Pro",
        },
    },
    {
        "category": "Laptop",
        "name": "DEMO - Pazarlama Laptop",
        "brand": "Dell",
        "model": "Latitude 5440",
        "serial_number": "DEMO-LPT-0004",
        "inventory_code": "DEMO-IT-LPT-0004",
        "status": Asset.Status.ASSIGNED,
        "location": "Reklam ve Pazarlama Müdürlüğü",
        "purchase_price": Decimal("34000.00"),
        "maintenance_frequency_days": 180,
        "maintenance_due_offset": 55,
        "warranty_offset": 310,
        "custom_fields": {
            "cpu": "Intel i5",
            "ram": "16 GB",
            "disk": "512 GB SSD",
            "os": "Windows 11 Pro",
        },
    },
    {
        "category": "Laptop",
        "name": "DEMO - Depo Yedek Laptop",
        "brand": "Acer",
        "model": "TravelMate P2",
        "serial_number": "DEMO-LPT-0005",
        "inventory_code": "DEMO-IT-LPT-0005",
        "status": Asset.Status.IN_STOCK,
        "location": "IT Depo",
        "purchase_price": Decimal("22000.00"),
        "maintenance_frequency_days": 180,
        "maintenance_due_offset": 80,
        "warranty_offset": 500,
        "custom_fields": {
            "cpu": "Intel i3",
            "ram": "8 GB",
            "disk": "256 GB SSD",
            "os": "Windows 11 Pro",
        },
    },

    # Masaüstü
    {
        "category": "Masaüstü Bilgisayar",
        "name": "DEMO - Grafik Tasarım PC",
        "brand": "HP",
        "model": "Z2 Tower",
        "serial_number": "DEMO-PC-0001",
        "inventory_code": "DEMO-IT-PC-0001",
        "status": Asset.Status.ASSIGNED,
        "location": "Reklam ve Pazarlama Müdürlüğü",
        "purchase_price": Decimal("58000.00"),
        "maintenance_frequency_days": 120,
        "maintenance_due_offset": 7,
        "warranty_offset": 210,
        "custom_fields": {
            "cpu": "Intel i7",
            "ram": "32 GB",
            "disk": "1 TB SSD",
            "gpu": "NVIDIA RTX",
            "os": "Windows 11 Pro",
        },
    },
    {
        "category": "Masaüstü Bilgisayar",
        "name": "DEMO - Satın Alma PC",
        "brand": "Dell",
        "model": "OptiPlex 7010",
        "serial_number": "DEMO-PC-0002",
        "inventory_code": "DEMO-IT-PC-0002",
        "status": Asset.Status.ACTIVE,
        "location": "İdari ve Mali İşler Müdürlüğü",
        "purchase_price": Decimal("24000.00"),
        "maintenance_frequency_days": 180,
        "maintenance_due_offset": 33,
        "warranty_offset": 95,
        "custom_fields": {
            "cpu": "Intel i5",
            "ram": "16 GB",
            "disk": "512 GB SSD",
            "os": "Windows 11 Pro",
        },
    },

    # Monitörler
    {
        "category": "Monitör",
        "name": "DEMO - Grafik Monitörü 27",
        "brand": "LG",
        "model": "27UP850",
        "serial_number": "DEMO-MON-0001",
        "inventory_code": "DEMO-IT-MON-0001",
        "status": Asset.Status.ASSIGNED,
        "location": "Reklam ve Pazarlama Müdürlüğü",
        "purchase_price": Decimal("14500.00"),
        "maintenance_frequency_days": 365,
        "maintenance_due_offset": 200,
        "warranty_offset": 600,
        "custom_fields": {
            "screen_size": "27 inch",
            "resolution": "4K",
        },
    },
    {
        "category": "Monitör",
        "name": "DEMO - Muhasebe Monitör 24",
        "brand": "Samsung",
        "model": "S24C310",
        "serial_number": "DEMO-MON-0002",
        "inventory_code": "DEMO-IT-MON-0002",
        "status": Asset.Status.ASSIGNED,
        "location": "İdari ve Mali İşler Müdürlüğü",
        "purchase_price": Decimal("5200.00"),
        "maintenance_frequency_days": 365,
        "maintenance_due_offset": 150,
        "warranty_offset": 320,
        "custom_fields": {
            "screen_size": "24 inch",
            "resolution": "Full HD",
        },
    },

    # Yazıcılar
    {
        "category": "Yazıcı",
        "name": "DEMO - Muhasebe Yazıcı",
        "brand": "HP",
        "model": "LaserJet Pro M404dn",
        "serial_number": "DEMO-PRN-0001",
        "inventory_code": "DEMO-IT-PRN-0001",
        "status": Asset.Status.ACTIVE,
        "location": "İdari ve Mali İşler Müdürlüğü",
        "ip_address": "192.168.1.50",
        "purchase_price": Decimal("9600.00"),
        "maintenance_frequency_days": 90,
        "maintenance_due_offset": 5,
        "warranty_offset": 180,
        "custom_fields": {
            "printer_type": "Laser",
            "connection_type": "Network",
            "toner_model": "HP 59A",
            "snmp_enabled": True,
        },
    },
    {
        "category": "Yazıcı",
        "name": "DEMO - Genel Müdürlük Renkli Yazıcı",
        "brand": "Canon",
        "model": "i-SENSYS MF754Cdw",
        "serial_number": "DEMO-PRN-0002",
        "inventory_code": "DEMO-IT-PRN-0002",
        "status": Asset.Status.ACTIVE,
        "location": "Genel Müdürlük",
        "ip_address": "192.168.1.51",
        "purchase_price": Decimal("18500.00"),
        "maintenance_frequency_days": 90,
        "maintenance_due_offset": -10,
        "warranty_offset": 75,
        "custom_fields": {
            "printer_type": "Color Laser",
            "connection_type": "Network",
            "toner_model": "Canon 069",
            "snmp_enabled": True,
        },
    },
    {
        "category": "Yazıcı",
        "name": "DEMO - Mağaza Yazıcı",
        "brand": "Brother",
        "model": "HL-L2351DW",
        "serial_number": "DEMO-PRN-0003",
        "inventory_code": "DEMO-IT-PRN-0003",
        "status": Asset.Status.IN_REPAIR,
        "location": "İşletmeler Müdürlüğü",
        "ip_address": "192.168.1.52",
        "purchase_price": Decimal("7200.00"),
        "maintenance_frequency_days": 90,
        "maintenance_due_offset": -1,
        "warranty_offset": -20,
        "custom_fields": {
            "printer_type": "Laser",
            "connection_type": "Wi-Fi",
            "toner_model": "Brother TN-2421",
            "snmp_enabled": False,
        },
    },

    # Network
    {
        "category": "Firewall",
        "name": "DEMO - Ana Firewall",
        "brand": "Fortinet",
        "model": "FortiGate 60F",
        "serial_number": "DEMO-FW-0001",
        "inventory_code": "DEMO-IT-FW-0001",
        "status": Asset.Status.ACTIVE,
        "location": "Sistem Odası",
        "ip_address": "192.168.1.1",
        "purchase_price": Decimal("42000.00"),
        "maintenance_frequency_days": 30,
        "maintenance_due_offset": 3,
        "warranty_offset": 270,
        "custom_fields": {
            "license_end_date": "2027-07-09",
            "vpn_enabled": True,
            "snmp_enabled": False,
        },
    },
    {
        "category": "Switch",
        "name": "DEMO - Ana Switch 24 Port",
        "brand": "Cisco",
        "model": "CBS350-24T",
        "serial_number": "DEMO-SW-0001",
        "inventory_code": "DEMO-IT-SW-0001",
        "status": Asset.Status.ACTIVE,
        "location": "Sistem Odası",
        "ip_address": "192.168.1.2",
        "purchase_price": Decimal("27500.00"),
        "maintenance_frequency_days": 90,
        "maintenance_due_offset": 14,
        "warranty_offset": 390,
        "custom_fields": {
            "port_count": 24,
            "managed": True,
            "snmp_enabled": True,
        },
    },
    {
        "category": "Switch",
        "name": "DEMO - Kat Switch 16 Port",
        "brand": "TP-Link",
        "model": "TL-SG1016DE",
        "serial_number": "DEMO-SW-0002",
        "inventory_code": "DEMO-IT-SW-0002",
        "status": Asset.Status.ACTIVE,
        "location": "İşletmeler Müdürlüğü",
        "ip_address": "192.168.1.3",
        "purchase_price": Decimal("8500.00"),
        "maintenance_frequency_days": 120,
        "maintenance_due_offset": 60,
        "warranty_offset": 410,
        "custom_fields": {
            "port_count": 16,
            "managed": True,
            "snmp_enabled": True,
        },
    },
    {
        "category": "Modem / Router",
        "name": "DEMO - Yedek Router",
        "brand": "MikroTik",
        "model": "hEX S",
        "serial_number": "DEMO-RTR-0001",
        "inventory_code": "DEMO-IT-RTR-0001",
        "status": Asset.Status.IN_STOCK,
        "location": "IT Depo",
        "ip_address": "192.168.1.254",
        "purchase_price": Decimal("3900.00"),
        "maintenance_frequency_days": 180,
        "maintenance_due_offset": 100,
        "warranty_offset": 250,
        "custom_fields": {
            "wan_type": "Ethernet",
            "snmp_enabled": False,
        },
    },

    # Sunucu / UPS
    {
        "category": "Sunucu",
        "name": "DEMO - Dosya Sunucusu",
        "brand": "Dell",
        "model": "PowerEdge T350",
        "serial_number": "DEMO-SRV-0001",
        "inventory_code": "DEMO-IT-SRV-0001",
        "status": Asset.Status.ACTIVE,
        "location": "Sistem Odası",
        "ip_address": "192.168.1.10",
        "purchase_price": Decimal("125000.00"),
        "maintenance_frequency_days": 90,
        "maintenance_due_offset": 20,
        "warranty_offset": 700,
        "custom_fields": {
            "cpu": "Intel Xeon",
            "ram": "64 GB",
            "disk": "4x2TB RAID",
            "os": "Windows Server",
            "role": "File Server",
        },
    },
    {
        "category": "UPS",
        "name": "DEMO - Sistem Odası UPS",
        "brand": "APC",
        "model": "Smart-UPS 1500VA",
        "serial_number": "DEMO-UPS-0001",
        "inventory_code": "DEMO-IT-UPS-0001",
        "status": Asset.Status.ACTIVE,
        "location": "Sistem Odası",
        "purchase_price": Decimal("19500.00"),
        "maintenance_frequency_days": 180,
        "maintenance_due_offset": -7,
        "warranty_offset": 30,
        "custom_fields": {
            "capacity_va": "1500VA",
            "battery_replacement_date": "2026-12-01",
        },
    },

    # Telefon / Tablet
    {
        "category": "Telefon",
        "name": "DEMO - Yönetici IP Telefon",
        "brand": "Yealink",
        "model": "T31P",
        "serial_number": "DEMO-PHN-0001",
        "inventory_code": "DEMO-IT-PHN-0001",
        "status": Asset.Status.ASSIGNED,
        "location": "Genel Müdürlük",
        "ip_address": "192.168.1.80",
        "purchase_price": Decimal("2500.00"),
        "maintenance_frequency_days": 365,
        "maintenance_due_offset": 220,
        "warranty_offset": 340,
        "custom_fields": {
            "phone_type": "IP Phone",
        },
    },
    {
        "category": "Tablet",
        "name": "DEMO - Saha Tablet",
        "brand": "Samsung",
        "model": "Galaxy Tab A9",
        "serial_number": "DEMO-TAB-0001",
        "inventory_code": "DEMO-IT-TAB-0001",
        "status": Asset.Status.ASSIGNED,
        "location": "İşletmeler Müdürlüğü",
        "purchase_price": Decimal("7900.00"),
        "maintenance_frequency_days": 180,
        "maintenance_due_offset": 45,
        "warranty_offset": 190,
        "custom_fields": {
            "imei": "DEMO-IMEI-0001",
            "os": "Android",
        },
    },

    # Riskli/özel durumlar
    {
        "category": "Laptop",
        "name": "DEMO - Arızalı Laptop",
        "brand": "Asus",
        "model": "ExpertBook",
        "serial_number": "DEMO-LPT-FAULTY-0001",
        "inventory_code": "DEMO-IT-LPT-0099",
        "status": Asset.Status.FAULTY,
        "location": "IT Depo",
        "purchase_price": Decimal("18000.00"),
        "maintenance_frequency_days": 90,
        "maintenance_due_offset": -20,
        "warranty_offset": -60,
        "custom_fields": {
            "cpu": "Intel i5",
            "ram": "8 GB",
            "disk": "256 GB SSD",
            "os": "Windows 10 Pro",
        },
    },
    {
        "category": "Diğer",
        "name": "DEMO - Kayıp Barkod Okuyucu",
        "brand": "Zebra",
        "model": "DS2208",
        "serial_number": "DEMO-OTHER-LOST-0001",
        "inventory_code": "DEMO-IT-OTH-0001",
        "status": Asset.Status.LOST,
        "location": "Bilinmiyor",
        "purchase_price": Decimal("4300.00"),
        "maintenance_frequency_days": None,
        "maintenance_due_offset": None,
        "warranty_offset": 15,
        "custom_fields": {},
    },
]


class Command(BaseCommand):
    help = "Lokal/demo ortam için gerçekçi örnek varlık kayıtları oluşturur."

    def handle(self, *args, **options):
        User = get_user_model()
        system_user = User.objects.filter(is_superuser=True).first()

        existing_categories = {
            category.name: category for category in AssetCategory.objects.all()
        }

        missing_categories = sorted(
            {
                item["category"]
                for item in DEMO_ASSETS
                if item["category"] not in existing_categories
            }
        )

        if missing_categories:
            raise CommandError(
                "Eksik kategoriler var. Önce seed_asset_categories çalıştır. "
                f"Eksikler: {', '.join(missing_categories)}"
            )

        created_count = 0
        updated_count = 0
        today = timezone.localdate()

        for item in DEMO_ASSETS:
            category = existing_categories[item["category"]]

            maintenance_frequency_days = item.get("maintenance_frequency_days")
            maintenance_due_offset = item.get("maintenance_due_offset")
            warranty_offset = item.get("warranty_offset")

            maintenance_enabled = maintenance_frequency_days is not None

            next_maintenance_due_date = None
            if maintenance_enabled and maintenance_due_offset is not None:
                next_maintenance_due_date = today + timedelta(
                    days=maintenance_due_offset
                )

            warranty_end_date = None
            if warranty_offset is not None:
                warranty_end_date = today + timedelta(days=warranty_offset)

            _, created = Asset.all_objects.update_or_create(
                inventory_code=item["inventory_code"],
                defaults={
                    "category": category,
                    "name": item["name"],
                    "brand": item["brand"],
                    "model": item["model"],
                    "serial_number": item["serial_number"],
                    "status": item["status"],
                    "location": item["location"],
                    "ip_address": item.get("ip_address"),
                    "purchase_date": today - timedelta(days=180),
                    "purchase_price": item["purchase_price"],
                    "vendor_name": "DEMO Tedarikçi",
                    "warranty_end_date": warranty_end_date,
                    "maintenance_enabled": maintenance_enabled,
                    "maintenance_frequency_days": maintenance_frequency_days,
                    "next_maintenance_due_date": next_maintenance_due_date,
                    "custom_fields": item["custom_fields"],
                    "notes": (
                        "Bu kayıt demo amaçlıdır. Gerçek envanter verisi değildir."
                    ),
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
                f"Demo asset seed tamamlandı. "
                f"Oluşturulan: {created_count}, Güncellenen: {updated_count}, "
                f"Toplam demo kayıt: {len(DEMO_ASSETS)}"
            )
        )