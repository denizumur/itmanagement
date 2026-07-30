import json
import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserInvitation, UserProfile
from apps.audit.models import AuditLog
from apps.employees.models import Employee, EmployeeImportJob


class AdminConsoleOverviewTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username="admin.console",
            email="admin.console@example.com",
            password="StrongPass123!",
        )
        self.admin.profile.role = UserProfile.Role.ADMIN
        self.admin.profile.save(update_fields=["role"])

        self.requester = User.objects.create_user(
            username="requester.console",
            email="requester.console@example.com",
            password="StrongPass123!",
        )
        self.requester.profile.role = UserProfile.Role.REQUESTER
        self.requester.profile.save(update_fields=["role"])

        self.technician = User.objects.create_user(
            username="technician.console",
            email="technician.console@example.com",
            password="StrongPass123!",
        )
        self.technician.profile.role = UserProfile.Role.TECHNICIAN
        self.technician.profile.save(update_fields=["role"])

    def get_overview(self, user=None):
        if user:
            self.client.force_authenticate(user=user)
        else:
            self.client.force_authenticate(user=None)

        return self.client.get("/api/admin-console/overview/")

    def write_manifest(self, manifest_dir, name, payload):
        manifest_path = Path(manifest_dir) / name
        manifest_path.write_text(json.dumps(payload), encoding="utf-8")
        return manifest_path

    def success_manifest_payload(self, **overrides):
        now = timezone.now()
        payload = {
            "run_id": "backup-test",
            "started_at": (now - timezone.timedelta(minutes=3)).isoformat(),
            "finished_at": now.isoformat(),
            "status": "success",
            "environment": "dev",
            "postgres_backup_path": r"C:\secret\path\it_inventory.sql",
            "postgres_backup_size_bytes": 1234,
            "media_backup_path": r"C:\secret\path\media.zip",
            "media_backup_size_bytes": 456,
            "retention_applied": True,
            "deleted_files_count": 0,
            "warnings": [],
            "errors": [],
        }
        payload.update(overrides)
        return payload

    def test_admin_can_get_overview(self):
        with tempfile.TemporaryDirectory() as manifest_dir, override_settings(
            BACKUP_MANIFEST_DIR=manifest_dir
        ):
            response = self.get_overview(self.admin)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("system", response.data)
        self.assertIn("backup", response.data)

    def test_requester_cannot_get_overview(self):
        response = self.get_overview(self.requester)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_technician_cannot_get_overview(self):
        response = self.get_overview(self.technician)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_get_overview(self):
        response = self.get_overview()

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_overview_does_not_expose_secret_like_values(self):
        with tempfile.TemporaryDirectory() as manifest_dir, override_settings(
            BACKUP_MANIFEST_DIR=manifest_dir
        ):
            self.write_manifest(
                manifest_dir,
                "backup-manifest-20260730-120000.json",
                self.success_manifest_payload(),
            )
            response = self.get_overview(self.admin)

        response_text = json.dumps(response.data, default=str)
        self.assertNotIn("SECRET_KEY", response_text)
        self.assertNotIn("password", response_text.lower())
        self.assertNotIn("token_hash", response_text)
        self.assertNotIn("DATABASE_URL", response_text)
        self.assertNotIn("C:\\secret\\path", response_text)

    def test_missing_manifest_returns_unknown_backup_status(self):
        with tempfile.TemporaryDirectory() as manifest_dir, override_settings(
            BACKUP_MANIFEST_DIR=manifest_dir
        ):
            response = self.get_overview(self.admin)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["backup"]["status"], "unknown")
        self.assertIsNone(response.data["backup"]["latest_manifest"])

    def test_malformed_manifest_returns_critical_without_500(self):
        with tempfile.TemporaryDirectory() as manifest_dir, override_settings(
            BACKUP_MANIFEST_DIR=manifest_dir
        ):
            Path(manifest_dir, "backup-manifest-20260730-120000.json").write_text(
                "{not-json",
                encoding="utf-8",
            )
            response = self.get_overview(self.admin)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["backup"]["status"], "critical")

    def test_latest_success_manifest_returns_backup_summary(self):
        with tempfile.TemporaryDirectory() as manifest_dir, override_settings(
            BACKUP_MANIFEST_DIR=manifest_dir
        ):
            self.write_manifest(
                manifest_dir,
                "backup-manifest-20260730-120000.json",
                self.success_manifest_payload(),
            )
            response = self.get_overview(self.admin)

        latest = response.data["backup"]["latest_manifest"]
        self.assertEqual(response.data["backup"]["status"], "healthy")
        self.assertEqual(latest["postgres_backup_file"], "it_inventory.sql")
        self.assertEqual(latest["media_backup_file"], "media.zip")
        self.assertNotIn("postgres_backup_path", latest)

    def test_stale_manifest_marks_warning_or_critical(self):
        old_finished_at = timezone.now() - timezone.timedelta(hours=80)
        with tempfile.TemporaryDirectory() as manifest_dir, override_settings(
            BACKUP_MANIFEST_DIR=manifest_dir
        ):
            self.write_manifest(
                manifest_dir,
                "backup-manifest-20260730-120000.json",
                self.success_manifest_payload(finished_at=old_finished_at.isoformat()),
            )
            response = self.get_overview(self.admin)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["backup"]["status"], "critical")

    def test_invitation_counts_include_pending_expired_accepted_revoked(self):
        now = timezone.now()
        UserInvitation.objects.create(
            user=self.requester,
            token_hash="pending-token",
            status=UserInvitation.Status.PENDING,
            expires_at=now + timezone.timedelta(days=1),
        )
        UserInvitation.objects.create(
            user=self.technician,
            token_hash="expired-token",
            status=UserInvitation.Status.PENDING,
            expires_at=now - timezone.timedelta(days=1),
        )
        UserInvitation.objects.create(
            user=self.requester,
            token_hash="accepted-token",
            status=UserInvitation.Status.ACCEPTED,
            accepted_at=now,
            expires_at=now + timezone.timedelta(days=1),
        )
        UserInvitation.objects.create(
            user=self.technician,
            token_hash="revoked-token",
            status=UserInvitation.Status.REVOKED,
            revoked_at=now,
            expires_at=now + timezone.timedelta(days=1),
        )

        with tempfile.TemporaryDirectory() as manifest_dir, override_settings(
            BACKUP_MANIFEST_DIR=manifest_dir
        ):
            response = self.get_overview(self.admin)

        self.assertEqual(response.data["accounts"]["pending_invitations"], 1)
        self.assertEqual(response.data["accounts"]["expired_invitations"], 1)
        self.assertEqual(response.data["accounts"]["accepted_invitations_30d"], 1)
        self.assertEqual(response.data["accounts"]["revoked_invitations_30d"], 1)

    def test_employee_import_summary_no_pii(self):
        Employee.objects.create(
            full_name="Import User",
            email="import.user@example.com",
            user=self.requester,
        )
        EmployeeImportJob.objects.create(
            import_id="import-test",
            file_name="employees.xlsx",
            file_format="xlsx",
            status=EmployeeImportJob.Status.COMMITTED,
            total_rows=1,
            valid_rows=1,
            created_count=1,
            error_rows=0,
            warning_rows=2,
            expires_at=timezone.now() + timezone.timedelta(days=1),
        )

        with tempfile.TemporaryDirectory() as manifest_dir, override_settings(
            BACKUP_MANIFEST_DIR=manifest_dir
        ):
            response = self.get_overview(self.admin)

        latest_import = response.data["employees"]["latest_import"]
        response_text = json.dumps(response.data, default=str)
        self.assertEqual(latest_import["created_count"], 1)
        self.assertEqual(latest_import["warning_count"], 2)
        self.assertNotIn("import.user@example.com", response_text)
        self.assertNotIn("employees.xlsx", response_text)

    def test_audit_ticket_reminder_counts_do_not_crash_if_empty(self):
        AuditLog.objects.create(
            actor=self.admin,
            action=AuditLog.Action.DELETE,
            entity_type="tests.Entity",
            entity_id="1",
        )

        with tempfile.TemporaryDirectory() as manifest_dir, override_settings(
            BACKUP_MANIFEST_DIR=manifest_dir
        ):
            response = self.get_overview(self.admin)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["operations"]["audit_logs_24h"], 1)
        self.assertGreaterEqual(
            response.data["operations"]["critical_audit_logs_24h"],
            1,
        )
