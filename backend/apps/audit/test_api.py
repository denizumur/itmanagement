from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.audit.models import AuditLog


User = get_user_model()


def create_user_with_role(username, role):
    user = User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="Test12345!",
    )

    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.role = role
    profile.save(update_fields=["role"])

    if "profile" in user._state.fields_cache:
        del user._state.fields_cache["profile"]

    user.refresh_from_db()

    return user
class AuditLogApiTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_role("admin.audit", UserProfile.Role.ADMIN)
        self.technician = create_user_with_role(
            "technician.audit",
            UserProfile.Role.TECHNICIAN,
        )
        self.viewer = create_user_with_role("viewer.audit", UserProfile.Role.VIEWER)
        self.requester = create_user_with_role(
            "requester.audit",
            UserProfile.Role.REQUESTER,
        )

    def create_audit_log(
        self,
        *,
        actor=None,
        action=AuditLog.Action.CREATE,
        entity_type="inventory.Asset",
        entity_id="1",
        entity_repr="Demo Asset",
        changes=None,
        metadata=None,
    ):
        return AuditLog.objects.create(
            actor=actor or self.admin,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_repr=entity_repr,
            before={},
            after={},
            changes=changes or {},
            metadata=metadata or {},
            request_method="POST",
            request_path="/api/demo/",
            ip_address="127.0.0.1",
            user_agent="test-agent",
        )

    def test_admin_can_list_audit_logs(self):
        self.create_audit_log(
            actor=self.admin,
            action=AuditLog.Action.CREATE,
            entity_type="inventory.Asset",
            entity_id="14",
            entity_repr="Laptop-14",
            changes={
                "name": {
                    "before": None,
                    "after": "Laptop-14",
                }
            },
            metadata={
                "module": "inventory",
                "operation": "asset_create",
            },
        )

        self.client.force_authenticate(user=self.admin)

        response = self.client.get("/api/audit/logs/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["entity_type"], "inventory.Asset")
        self.assertEqual(response.data["results"][0]["entity_id"], "14")
        self.assertEqual(response.data["results"][0]["operation"], "asset_create")

    def test_non_admin_roles_cannot_list_audit_logs(self):
        self.create_audit_log()

        for user in [self.technician, self.viewer, self.requester]:
            self.client.force_authenticate(user=user)

            response = self.client.get("/api/audit/logs/")

            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_filter_by_entity_type_and_entity_id(self):
        self.create_audit_log(
            entity_type="inventory.Asset",
            entity_id="14",
            entity_repr="Laptop-14",
        )
        self.create_audit_log(
            entity_type="tickets.Ticket",
            entity_id="7",
            entity_repr="#7 internet problemi",
        )

        self.client.force_authenticate(user=self.admin)

        response = self.client.get(
            "/api/audit/logs/",
            {
                "entity_type": "tickets.Ticket",
                "entity_id": "7",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["entity_type"], "tickets.Ticket")
        self.assertEqual(response.data["results"][0]["entity_id"], "7")

    def test_admin_can_read_audit_log_detail_with_changes(self):
        audit_log = self.create_audit_log(
            action=AuditLog.Action.UPDATE,
            entity_type="licensing.LicenseSubscription",
            entity_id="3",
            entity_repr="Adobe License",
            changes={
                "seat_count": {
                    "before": 5,
                    "after": 8,
                },
                "license_key": {
                    "before": "***REDACTED***",
                    "after": "***REDACTED***",
                },
            },
            metadata={
                "module": "licensing",
                "operation": "license_update",
            },
        )

        self.client.force_authenticate(user=self.admin)

        response = self.client.get(f"/api/audit/logs/{audit_log.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], audit_log.id)
        self.assertIn("changes", response.data)
        self.assertEqual(
            response.data["changes"]["license_key"]["before"],
            "***REDACTED***",
        )
        self.assertEqual(
            response.data["changes"]["license_key"]["after"],
            "***REDACTED***",
        )

    def test_admin_can_get_audit_summary(self):
        self.create_audit_log(
            action=AuditLog.Action.CREATE,
            entity_type="inventory.Asset",
        )
        self.create_audit_log(
            action=AuditLog.Action.EXPORT,
            entity_type="employees.Employee",
            entity_repr="Employee CSV Export",
        )
        self.create_audit_log(
            action=AuditLog.Action.DELETE,
            entity_type="tickets.Ticket",
            entity_id="7",
        )

        self.client.force_authenticate(user=self.admin)

        response = self.client.get("/api/audit/logs/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 3)
        self.assertEqual(response.data["critical"]["export"], 1)
        self.assertEqual(response.data["critical"]["delete"], 1)
        self.assertEqual(response.data["critical"]["total"], 2)