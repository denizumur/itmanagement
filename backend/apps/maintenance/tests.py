from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.inventory.models import Asset, AssetCategory
from apps.maintenance.models import MaintenanceRecord

User = get_user_model()


class MaintenanceRecordTableApiTests(APITestCase):
    def create_user_with_role(self, username, role):
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="StrongPass123!",
        )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.save(update_fields=["role"])

        return User.objects.get(pk=user.pk)

    def setUp(self):
        self.admin_user = self.create_user_with_role(
            "maintenance-admin",
            UserProfile.Role.ADMIN,
        )

        category = AssetCategory.objects.create(name="Laptop")
        self.asset = Asset.objects.create(
            category=category,
            name="Bilgi İşlem Laptop 01",
            inventory_code="IT-LPT-MNT-001",
            serial_number="SN-MNT-001",
            status=Asset.Status.ACTIVE,
        )
        self.other_asset = Asset.objects.create(
            category=category,
            name="Muhasebe Yazıcı 01",
            inventory_code="IT-PRN-MNT-001",
            serial_number="SN-MNT-002",
            status=Asset.Status.ACTIVE,
        )

        today = timezone.localdate()

        self.maintenance_record = MaintenanceRecord.objects.create(
            asset=self.asset,
            type=MaintenanceRecord.Type.MAINTENANCE,
            performed_at=today - timedelta(days=10),
            next_due_date=today + timedelta(days=20),
            frequency_days=30,
            cost=1500,
            performed_by="Bilgi İşlem",
            description="Periyodik bakım yapıldı.",
            asset_status_before=Asset.Status.ACTIVE,
            asset_status_after=Asset.Status.ACTIVE,
            created_by=self.admin_user,
            updated_by=self.admin_user,
        )

        self.repair_record = MaintenanceRecord.objects.create(
            asset=self.other_asset,
            type=MaintenanceRecord.Type.REPAIR,
            performed_at=today - timedelta(days=5),
            next_due_date=today - timedelta(days=1),
            cost=2500,
            performed_by="Servis Firması",
            description="Arıza onarımı yapıldı.",
            asset_status_before=Asset.Status.FAULTY,
            asset_status_after=Asset.Status.ACTIVE,
            created_by=self.admin_user,
            updated_by=self.admin_user,
        )

        self.disposal_record = MaintenanceRecord.objects.create(
            asset=self.asset,
            type=MaintenanceRecord.Type.DISPOSAL,
            performed_at=today - timedelta(days=1),
            cost=0,
            performed_by="Bilgi İşlem",
            description="Cihaz imha sürecine alındı.",
            asset_status_before=Asset.Status.ACTIVE,
            asset_status_after=Asset.Status.DISPOSED,
            created_by=self.admin_user,
            updated_by=self.admin_user,
        )

    def test_maintenance_table_endpoint_returns_paginated_response(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/maintenance/records/table/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)

        result_ids = {item["id"] for item in response.data["results"]}

        self.assertIn(self.maintenance_record.id, result_ids)
        self.assertIn(self.repair_record.id, result_ids)
        self.assertIn(self.disposal_record.id, result_ids)

    def test_maintenance_table_supports_search(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/maintenance/records/table/",
            {"search": "Servis"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.repair_record.id)

    def test_maintenance_table_supports_type_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/maintenance/records/table/",
            {"type": MaintenanceRecord.Type.REPAIR},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.repair_record.id)

    def test_maintenance_table_supports_asset_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/maintenance/records/table/",
            {"asset": self.other_asset.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.repair_record.id)

    def test_maintenance_table_supports_overdue_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/maintenance/records/table/",
            {"overdue": "true"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.repair_record.id)

    def test_maintenance_table_supports_performed_date_filters(self):
        self.client.force_authenticate(user=self.admin_user)
        today = timezone.localdate()

        response = self.client.get(
            "/api/maintenance/records/table/",
            {"performed_after": today - timedelta(days=6)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        result_ids = {item["id"] for item in response.data["results"]}

        self.assertIn(self.repair_record.id, result_ids)
        self.assertIn(self.disposal_record.id, result_ids)
        self.assertNotIn(self.maintenance_record.id, result_ids)

    def test_maintenance_table_supports_next_due_date_filters(self):
        self.client.force_authenticate(user=self.admin_user)
        today = timezone.localdate()

        response = self.client.get(
            "/api/maintenance/records/table/",
            {"next_due_before": today},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.repair_record.id)

    def test_maintenance_table_supports_ordering(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/maintenance/records/table/",
            {"ordering": "-performed_at"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        dates = [item["performed_at"] for item in response.data["results"]]

        self.assertEqual(dates, sorted(dates, reverse=True))

    def test_legacy_maintenance_endpoint_still_returns_array(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/maintenance/records/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_delete_maintenance_record_still_returns_405(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(
            f"/api/maintenance/records/{self.maintenance_record.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)