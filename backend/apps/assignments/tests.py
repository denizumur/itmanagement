from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
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

    def test_integrity_error_is_returned_as_400_not_500_when_race_condition_hits_api(self):
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