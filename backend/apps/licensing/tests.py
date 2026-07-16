from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.inventory.models import Asset, AssetCategory
from apps.licensing.models import LicenseSubscription

User = get_user_model()


class LicenseSubscriptionTableApiTests(APITestCase):
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
            "license-admin",
            UserProfile.Role.ADMIN,
        )

        category = AssetCategory.objects.create(name="Laptop")
        self.asset = Asset.objects.create(
            category=category,
            name="Bilgi İşlem Laptop 01",
            inventory_code="IT-LPT-LIC-001",
            status=Asset.Status.ACTIVE,
        )

        today = timezone.localdate()

        self.active_subscription = LicenseSubscription.objects.create(
            name="Microsoft 365 Business Premium",
            tracking_code="LIC-M365-001",
            type=LicenseSubscription.Type.SUBSCRIPTION,
            vendor="Microsoft",
            license_key_masked="XXXX-XXXX-1234",
            seat_count=25,
            assigned_asset=None,
            start_date=today - timedelta(days=30),
            end_date=today + timedelta(days=15),
            renewal_cost=12000,
            billing_cycle=LicenseSubscription.BillingCycle.YEARLY,
            auto_renew=True,
            is_active=True,
        )

        self.expired_license = LicenseSubscription.objects.create(
            name="Adobe Creative Cloud",
            tracking_code="LIC-ADOBE-001",
            type=LicenseSubscription.Type.LICENSE,
            vendor="Adobe",
            license_key_masked="XXXX-XXXX-5678",
            seat_count=5,
            assigned_asset=self.asset,
            start_date=today - timedelta(days=400),
            end_date=today - timedelta(days=1),
            renewal_cost=8000,
            billing_cycle=LicenseSubscription.BillingCycle.YEARLY,
            auto_renew=False,
            is_active=True,
        )

        self.inactive_subscription = LicenseSubscription.objects.create(
            name="ESET Endpoint Security",
            tracking_code="LIC-ESET-001",
            type=LicenseSubscription.Type.SUBSCRIPTION,
            vendor="ESET",
            license_key_masked="XXXX-XXXX-9999",
            seat_count=10,
            end_date=today + timedelta(days=120),
            billing_cycle=LicenseSubscription.BillingCycle.YEARLY,
            is_active=False,
        )

        self.deleted_subscription = LicenseSubscription.objects.create(
            name="Deleted Test License",
            tracking_code="LIC-DEL-001",
            type=LicenseSubscription.Type.LICENSE,
            vendor="Deleted Vendor",
            license_key_masked="XXXX-XXXX-0000",
            seat_count=1,
            end_date=today + timedelta(days=60),
            billing_cycle=LicenseSubscription.BillingCycle.YEARLY,
            is_active=True,
        )
        self.deleted_subscription.soft_delete(user=self.admin_user)

    def test_license_table_endpoint_returns_paginated_response(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/licensing/subscriptions/table/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)

        result_ids = {item["id"] for item in response.data["results"]}

        self.assertIn(self.active_subscription.id, result_ids)
        self.assertIn(self.expired_license.id, result_ids)
        self.assertIn(self.inactive_subscription.id, result_ids)
        self.assertNotIn(self.deleted_subscription.id, result_ids)

    def test_license_table_supports_search(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/licensing/subscriptions/table/",
            {"search": "Microsoft"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.active_subscription.id)

    def test_license_table_supports_type_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/licensing/subscriptions/table/",
            {"type": LicenseSubscription.Type.LICENSE},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result_ids = {item["id"] for item in response.data["results"]}

        self.assertIn(self.expired_license.id, result_ids)
        self.assertNotIn(self.active_subscription.id, result_ids)

    def test_license_table_supports_vendor_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/licensing/subscriptions/table/",
            {"vendor": "Adobe"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.expired_license.id)

    def test_license_table_supports_is_active_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/licensing/subscriptions/table/",
            {"is_active": "false"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.inactive_subscription.id)

    def test_license_table_supports_expired_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/licensing/subscriptions/table/",
            {"expired": "true"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.expired_license.id)

    def test_license_table_supports_upcoming_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/licensing/subscriptions/table/",
            {"upcoming": "true"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.active_subscription.id)

    def test_license_table_supports_ordering(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/licensing/subscriptions/table/",
            {"ordering": "-name"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        names = [item["name"] for item in response.data["results"]]

        self.assertEqual(names, sorted(names, reverse=True))

    def test_license_table_supports_deleted_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/licensing/subscriptions/table/",
            {"deleted": "true"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.deleted_subscription.id)

    def test_legacy_license_endpoint_still_returns_array(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/licensing/subscriptions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)