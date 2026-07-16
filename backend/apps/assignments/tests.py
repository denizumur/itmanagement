from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.assignments.models import Assignment
from apps.employees.models import Employee
from apps.inventory.models import Asset, AssetCategory


class AssignmentIntegrityTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()

        self.user = user_model.objects.create_user(
            username="assignment-admin",
            email="assignment-admin@example.com",
            password="StrongPass123!",
        )
        UserProfile.objects.update_or_create(
            user=self.user,
            defaults={"role": UserProfile.Role.ADMIN},
        )

        self.category = AssetCategory.objects.create(
            name="Test Cihazı",
            is_active=True,
        )
        self.asset = Asset.objects.create(
            category=self.category,
            name="QA Duplicate Assignment Asset",
            serial_number="QA-DUP-SN-001",
            inventory_code="QA-DUP-INV-001",
            status=Asset.Status.ACTIVE,
        )
        self.employee = Employee.objects.create(
            full_name="QA Birinci Personel",
            employee_code="QA-EMP-DUP-001",
            is_active=True,
        )
        self.second_employee = Employee.objects.create(
            full_name="QA İkinci Personel",
            employee_code="QA-EMP-DUP-002",
            is_active=True,
        )

        self.client.force_authenticate(user=self.user)

    def test_duplicate_active_assignment_returns_400_from_api_validation(self):
        Assignment.objects.create(
            asset=self.asset,
            employee=self.employee,
            assigned_by=self.user,
        )

        response = self.client.post(
            "/api/assignments/",
            {
                "asset": self.asset.id,
                "employee": self.second_employee.id,
                "notes": "Duplicate active assignment attempt",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("asset", response.data)
        self.assertEqual(
            Assignment.objects.filter(
                asset=self.asset,
                returned_at__isnull=True,
            ).count(),
            1,
        )

    def test_database_unique_constraint_blocks_duplicate_active_assignment(self):
        Assignment.objects.create(
            asset=self.asset,
            employee=self.employee,
            assigned_by=self.user,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Assignment.objects.bulk_create(
                    [
                        Assignment(
                            asset=self.asset,
                            employee=self.second_employee,
                            assigned_by=self.user,
                        )
                    ]
                )

        self.assertEqual(
            Assignment.objects.filter(
                asset=self.asset,
                returned_at__isnull=True,
            ).count(),
            1,
        )

    def test_integrity_error_is_returned_as_400_not_500_when_race_condition_hits_api(
        self,
    ):
        Assignment.objects.create(
            asset=self.asset,
            employee=self.employee,
            assigned_by=self.user,
        )

        with patch("apps.assignments.serializers.Assignment.objects.filter") as filter_mock:
            filter_mock.return_value.exists.return_value = False

            response = self.client.post(
                "/api/assignments/",
                {
                    "asset": self.asset.id,
                    "employee": self.second_employee.id,
                    "notes": "Race condition duplicate attempt",
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("asset", response.data)
        self.assertEqual(
            Assignment.objects.filter(
                asset=self.asset,
                returned_at__isnull=True,
            ).count(),
            1,
        )


class AssignmentTableApiTests(APITestCase):
    def create_user_with_role(self, username, role):
        user_model = get_user_model()

        user = user_model.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="StrongPass123!",
        )

        UserProfile.objects.update_or_create(
            user=user,
            defaults={"role": role},
        )

        return user_model.objects.get(pk=user.pk)

    def setUp(self):
        self.admin_user = self.create_user_with_role(
            "assignment-table-admin",
            UserProfile.Role.ADMIN,
        )

        self.category = AssetCategory.objects.create(
            name="Zimmet Test Cihazı",
            is_active=True,
        )

        self.asset = Asset.objects.create(
            category=self.category,
            name="Zimmet Laptop 01",
            serial_number="ASSIGN-SN-001",
            inventory_code="ASSIGN-INV-001",
            status=Asset.Status.ASSIGNED,
        )
        self.returned_asset = Asset.objects.create(
            category=self.category,
            name="İade Edilmiş Monitor 01",
            serial_number="ASSIGN-SN-002",
            inventory_code="ASSIGN-INV-002",
            status=Asset.Status.IN_STOCK,
        )

        self.employee = Employee.objects.create(
            full_name="Zimmet Aktif Personel",
            employee_code="ASSIGN-EMP-001",
            is_active=True,
        )
        self.returned_employee = Employee.objects.create(
            full_name="Zimmet İade Personel",
            employee_code="ASSIGN-EMP-002",
            is_active=True,
        )

        now = timezone.now()

        self.active_assignment = Assignment.objects.create(
            asset=self.asset,
            employee=self.employee,
            assigned_at=now - timedelta(days=10),
            assigned_by=self.admin_user,
            notes="Aktif zimmet test notu",
        )

        self.returned_assignment = Assignment.objects.create(
            asset=self.returned_asset,
            employee=self.returned_employee,
            assigned_at=now - timedelta(days=40),
            returned_at=now - timedelta(days=5),
            assigned_by=self.admin_user,
            returned_by=self.admin_user,
            notes="İade edilmiş zimmet test notu",
            return_notes="Sağlam iade alındı",
        )

    def test_assignment_table_endpoint_returns_paginated_response(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/assignments/table/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)

        result_ids = {item["id"] for item in response.data["results"]}

        self.assertIn(self.active_assignment.id, result_ids)
        self.assertIn(self.returned_assignment.id, result_ids)

    def test_assignment_table_supports_search(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/assignments/table/",
            {"search": "Monitor"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.returned_assignment.id)

    def test_assignment_table_supports_active_true_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/assignments/table/",
            {"active": "true"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.active_assignment.id)

    def test_assignment_table_supports_active_false_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/assignments/table/",
            {"active": "false"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.returned_assignment.id)

    def test_assignment_table_supports_asset_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/assignments/table/",
            {"asset": self.asset.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.active_assignment.id)

    def test_assignment_table_supports_employee_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/assignments/table/",
            {"employee": self.returned_employee.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.returned_assignment.id)

    def test_assignment_table_supports_assigned_date_filters(self):
        self.client.force_authenticate(user=self.admin_user)
        today = timezone.localdate()

        response = self.client.get(
            "/api/assignments/table/",
            {"assigned_after": today - timedelta(days=20)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        result_ids = {item["id"] for item in response.data["results"]}

        self.assertIn(self.active_assignment.id, result_ids)
        self.assertNotIn(self.returned_assignment.id, result_ids)

    def test_assignment_table_supports_ordering(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/assignments/table/",
            {"ordering": "-assigned_at"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        dates = [item["assigned_at"] for item in response.data["results"]]

        self.assertEqual(dates, sorted(dates, reverse=True))

    def test_assignment_summary_endpoint_returns_counts(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/assignments/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual(response.data["active"], 1)
        self.assertEqual(response.data["returned"], 1)

    def test_legacy_assignment_endpoint_still_returns_array(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/assignments/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_delete_assignment_still_returns_405(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(
            f"/api/assignments/{self.active_assignment.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)