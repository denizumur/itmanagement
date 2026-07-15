from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.inventory.models import Asset, AssetCategory

User = get_user_model()


class AssetTableApiTests(APITestCase):
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
            "asset-admin",
            UserProfile.Role.ADMIN,
        )

        self.laptop_category = AssetCategory.objects.create(name="Laptop")
        self.printer_category = AssetCategory.objects.create(name="Yazıcı")

        today = timezone.localdate()

        self.laptop = Asset.objects.create(
            category=self.laptop_category,
            name="Bilgi İşlem Laptop 01",
            brand="Lenovo",
            model="ThinkPad",
            serial_number="SN-LPT-001",
            inventory_code="IT-LPT-001",
            status=Asset.Status.ACTIVE,
            location="Bilgi İşlem",
            warranty_end_date=today + timedelta(days=120),
            maintenance_enabled=True,
            maintenance_frequency_days=90,
            next_maintenance_due_date=today + timedelta(days=10),
        )

        self.printer = Asset.objects.create(
            category=self.printer_category,
            name="Muhasebe Yazıcı 01",
            brand="HP",
            model="LaserJet",
            serial_number="SN-PRN-001",
            inventory_code="IT-PRN-001",
            status=Asset.Status.IN_REPAIR,
            location="Muhasebe",
            warranty_end_date=today - timedelta(days=1),
            maintenance_enabled=True,
            maintenance_frequency_days=90,
            next_maintenance_due_date=today - timedelta(days=1),
        )

    def test_asset_table_endpoint_returns_paginated_response(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/inventory/assets/table/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)

        result_ids = {item["id"] for item in response.data["results"]}

        self.assertIn(self.laptop.id, result_ids)
        self.assertIn(self.printer.id, result_ids)

    def test_asset_table_supports_search(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/inventory/assets/table/",
            {"search": "Laptop"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.laptop.id)

    def test_asset_table_supports_status_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/inventory/assets/table/",
            {"status": Asset.Status.IN_REPAIR},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.printer.id)

    def test_asset_table_supports_category_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/inventory/assets/table/",
            {"category": self.laptop_category.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.laptop.id)

    def test_asset_table_supports_ordering(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/inventory/assets/table/",
            {"ordering": "-name"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        names = [item["name"] for item in response.data["results"]]

        self.assertEqual(names, sorted(names, reverse=True))

    def test_asset_table_supports_maintenance_overdue_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/inventory/assets/table/",
            {"maintenance_overdue": "true"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.printer.id)

    def test_asset_table_supports_warranty_expired_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/inventory/assets/table/",
            {"warranty_expired": "true"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.printer.id)

    def test_legacy_asset_endpoint_still_returns_array(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/inventory/assets/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)