from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.assignments.models import Assignment
from apps.audit.models import AuditLog
from apps.employees.models import Department, Employee, JobTitle
from apps.inventory.models import Asset, AssetCategory
from apps.tickets.models import Ticket

User = get_user_model()


class EmployeeApiTests(APITestCase):
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
            "admin-user",
            UserProfile.Role.ADMIN,
        )
        self.technician_user = self.create_user_with_role(
            "technician-user",
            UserProfile.Role.TECHNICIAN,
        )
        self.viewer_user = self.create_user_with_role(
            "viewer-user",
            UserProfile.Role.VIEWER,
        )
        self.requester_user = self.create_user_with_role(
            "requester-user",
            UserProfile.Role.REQUESTER,
        )

        self.department = Department.objects.create(name="Bilgi İşlem")
        self.job_title = JobTitle.objects.create(name="Uzman")
        self.asset_category = AssetCategory.objects.create(name="Laptop")

        self.manager_user = self.create_user_with_role(
            "manager-user",
            UserProfile.Role.APPROVER,
        )
        self.manager = Employee.objects.create(
            user=self.manager_user,
            full_name="Manager Personel",
            email="manager@example.com",
            department=self.department,
            job_title=self.job_title,
            is_active=True,
        )

        self.employee = Employee.objects.create(
            user=self.requester_user,
            manager=self.manager,
            full_name="Requester Personel",
            employee_code="EMP-001",
            email="requester@example.com",
            phone="5551112233",
            department=self.department,
            job_title=self.job_title,
            external_hr_id="HR-001",
            sync_source=Employee.SyncSource.MANUAL,
            is_active=True,
        )

    def create_asset(self, *, name, inventory_code):
        return Asset.objects.create(
            category=self.asset_category,
            name=name,
            inventory_code=inventory_code,
            serial_number=f"SN-{inventory_code}",
            status=Asset.Status.ACTIVE,
        )

    def test_legacy_employee_endpoint_still_returns_array(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/employees/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_employee_table_endpoint_returns_paginated_response(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/employees/table/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)

    def test_employee_table_supports_search_and_user_role_filter(self):
        Employee.objects.create(
            full_name="Bağımsız Personel",
            email="bagimsiz@example.com",
            department=self.department,
            job_title=self.job_title,
            is_active=True,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/employees/table/",
            {
                "search": "Requester",
                "user_role": UserProfile.Role.REQUESTER,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.employee.id)

    def test_employee_detail_returns_profile_user_org_assignments_and_tickets(self):
        active_asset = self.create_asset(
            name="Aktif Zimmet Laptop",
            inventory_code="IT-LPT-001",
        )
        returned_asset = self.create_asset(
            name="İade Edilmiş Laptop",
            inventory_code="IT-LPT-002",
        )

        active_assignment = Assignment.objects.create(
            asset=active_asset,
            employee=self.employee,
            assigned_by=self.admin_user,
            notes="Güncel zimmet",
        )
        Assignment.objects.create(
            asset=returned_asset,
            employee=self.employee,
            assigned_at=timezone.now() - timezone.timedelta(days=10),
            returned_at=timezone.now() - timezone.timedelta(days=1),
            assigned_by=self.admin_user,
            returned_by=self.admin_user,
        )

        Ticket.objects.create(
            employee=self.employee,
            title="Açık ticket",
            description="Açık ticket açıklaması",
            category=Ticket.Category.ACCESS,
            priority=Ticket.Priority.HIGH,
            status=Ticket.Status.OPEN,
            created_by=self.requester_user,
        )
        Ticket.objects.create(
            employee=self.employee,
            title="İşlemde ticket",
            description="İşlemde ticket açıklaması",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.NORMAL,
            status=Ticket.Status.IN_PROGRESS,
            created_by=self.requester_user,
        )
        Ticket.objects.create(
            employee=self.employee,
            title="Çözüldü ticket",
            description="Çözüldü ticket açıklaması",
            category=Ticket.Category.SOFTWARE,
            priority=Ticket.Priority.NORMAL,
            status=Ticket.Status.RESOLVED,
            created_by=self.requester_user,
        )
        Ticket.objects.create(
            employee=self.employee,
            title="Kapandı ticket",
            description="Kapandı ticket açıklaması",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.LOW,
            status=Ticket.Status.CLOSED,
            created_by=self.requester_user,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(f"/api/employees/{self.employee.id}/detail/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(response.data["employee"]["id"], self.employee.id)
        self.assertEqual(response.data["employee"]["manager"]["id"], self.manager.id)
        self.assertEqual(response.data["employee"]["department"]["name"], "Bilgi İşlem")
        self.assertEqual(response.data["employee"]["job_title"]["name"], "Uzman")

        self.assertEqual(response.data["user"]["username"], self.requester_user.username)
        self.assertEqual(response.data["user"]["role"], UserProfile.Role.REQUESTER)

        self.assertEqual(response.data["summary"]["active_assignment_count"], 1)
        self.assertEqual(response.data["summary"]["total_assignment_count"], 2)
        self.assertEqual(response.data["summary"]["open_ticket_count"], 1)
        self.assertEqual(response.data["summary"]["in_progress_ticket_count"], 1)
        self.assertEqual(response.data["summary"]["resolved_ticket_count"], 1)
        self.assertEqual(response.data["summary"]["closed_ticket_count"], 1)
        self.assertEqual(response.data["summary"]["total_ticket_count"], 4)

        active_assignment_ids = {
            item["id"] for item in response.data["active_assignments"]
        }

        self.assertEqual(active_assignment_ids, {active_assignment.id})
        self.assertEqual(len(response.data["recent_tickets"]), 4)

    def test_viewer_can_read_employee_detail(self):
        self.client.force_authenticate(user=self.viewer_user)

        response = self.client.get(f"/api/employees/{self.employee.id}/detail/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_requester_cannot_read_employee_detail(self):
        self.client.force_authenticate(user=self.requester_user)

        response = self.client.get(f"/api/employees/{self.employee.id}/detail/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_export_employees_as_csv(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/employees/export/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("attachment;", response["Content-Disposition"])

        content = response.content.decode("utf-8-sig")

        self.assertIn("Ad Soyad", content)
        self.assertIn("Requester Personel", content)
        self.assertIn("EMP-001", content)

    def test_technician_can_export_employees_as_csv(self):
        self.client.force_authenticate(user=self.technician_user)

        response = self.client.get("/api/employees/export/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_viewer_cannot_export_employees(self):
        self.client.force_authenticate(user=self.viewer_user)

        response = self.client.get("/api/employees/export/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_export_applies_filters_and_search(self):
        Employee.objects.create(
            full_name="Pasif Personel",
            email="pasif@example.com",
            department=self.department,
            job_title=self.job_title,
            is_active=False,
        )
        Employee.objects.create(
            full_name="Aktif Başka Personel",
            email="aktif@example.com",
            department=self.department,
            job_title=self.job_title,
            is_active=True,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/employees/export/",
            {
                "search": "Requester",
                "user_role": UserProfile.Role.REQUESTER,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        content = response.content.decode("utf-8-sig")

        self.assertIn("Requester Personel", content)
        self.assertNotIn("Aktif Başka Personel", content)
        self.assertNotIn("Pasif Personel", content)

    def test_export_ignores_pagination_and_exports_filtered_all_rows(self):
        for index in range(30):
            Employee.objects.create(
                full_name=f"Bulk Personel {index:02d}",
                email=f"bulk{index:02d}@example.com",
                department=self.department,
                job_title=self.job_title,
                is_active=True,
            )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/employees/export/",
            {
                "search": "Bulk Personel",
                "page_size": "5",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        content = response.content.decode("utf-8-sig")
        lines = [line for line in content.splitlines() if line.strip()]

        self.assertEqual(len(lines), 31)
        self.assertIn("Bulk Personel 00", content)
        self.assertIn("Bulk Personel 29", content)

    def test_export_creates_audit_log(self):
        self.client.force_authenticate(user=self.admin_user)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.get(
                "/api/employees/export/",
                {
                    "search": "Requester",
                },
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        audit_log = AuditLog.objects.filter(
            action=AuditLog.Action.EXPORT,
            entity_type="employees.Employee",
            metadata__operation="employee_export",
        ).first()

        self.assertIsNotNone(audit_log)
        self.assertEqual(audit_log.actor, self.admin_user)
        self.assertEqual(audit_log.metadata["format"], "csv")
        self.assertEqual(audit_log.metadata["row_count"], 1)
        self.assertEqual(audit_log.metadata["filters"]["search"], "Requester")