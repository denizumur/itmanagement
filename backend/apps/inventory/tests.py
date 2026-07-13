from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.assignments.models import Assignment
from apps.employees.models import Employee
from apps.inventory.models import Asset, AssetCategory


class AssetCreateWithAssignmentTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()

        self.user = user_model.objects.create_user(
            username="inventory-admin",
            email="inventory-admin@example.com",
            password="StrongPass123!",
        )
        UserProfile.objects.update_or_create(
            user=self.user,
            defaults={"role": UserProfile.Role.ADMIN},
        )
        self.category = AssetCategory.objects.create(
            name="Laptop",
            is_active=True,
        )
        self.employee = Employee.objects.create(
            full_name="QA Test Personeli",
            employee_code="QA-EMP-001",
            is_active=True,
        )

        self.client.force_authenticate(user=self.user)

    def test_create_with_assignment_creates_asset_and_assignment_atomically(self):
        payload = {
            "asset": {
                "category": self.category.id,
                "name": "QA Atomic Laptop",
                "brand": "Lenovo",
                "model": "ThinkPad",
                "serial_number": "QA-ATOMIC-SN-001",
                "inventory_code": "QA-ATOMIC-INV-001",
                "status": Asset.Status.ACTIVE,
                "location": "QA Lab",
                "maintenance_enabled": False,
                "custom_fields": {},
                "notes": "Atomic create with assignment success test",
            },
            "assignment": {
                "employee": self.employee.id,
                "notes": "QA atomic assignment",
            },
        }

        response = self.client.post(
            "/api/inventory/assets/create-with-assignment/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Asset.objects.count(), 1)
        self.assertEqual(Assignment.objects.count(), 1)

        asset = Asset.objects.get(serial_number="QA-ATOMIC-SN-001")
        assignment = Assignment.objects.get(asset=asset)

        self.assertEqual(asset.status, Asset.Status.ASSIGNED)
        self.assertEqual(assignment.employee, self.employee)
        self.assertIsNone(assignment.returned_at)

    def test_create_with_assignment_rolls_back_asset_when_assignment_is_invalid(self):
        payload = {
            "asset": {
                "category": self.category.id,
                "name": "QA Rollback Laptop",
                "brand": "Dell",
                "model": "Latitude",
                "serial_number": "QA-ROLLBACK-SN-001",
                "inventory_code": "QA-ROLLBACK-INV-001",
                "status": Asset.Status.ACTIVE,
                "location": "QA Lab",
                "maintenance_enabled": False,
                "custom_fields": {},
                "notes": "This asset must be rolled back",
            },
            "assignment": {
                "employee": 999999,
                "notes": "Invalid employee should rollback asset",
            },
        }

        response = self.client.post(
            "/api/inventory/assets/create-with-assignment/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            Asset.objects.filter(serial_number="QA-ROLLBACK-SN-001").exists()
        )
        self.assertFalse(
            Asset.objects.filter(inventory_code="QA-ROLLBACK-INV-001").exists()
        )
        self.assertEqual(Assignment.objects.count(), 0)