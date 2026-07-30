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
from apps.employees.models import Department


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


class AdminConsoleUserManagementTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username="users.admin",
            email="users.admin@example.com",
            password="StrongPass123!",
        )
        self.admin.profile.role = UserProfile.Role.ADMIN
        self.admin.profile.save(update_fields=["role"])

        self.requester = User.objects.create_user(
            username="portal.requester",
            email="portal.requester@example.com",
            password="StrongPass123!",
        )
        self.requester.profile.role = UserProfile.Role.REQUESTER
        self.requester.profile.save(update_fields=["role"])

        self.technician = User.objects.create_user(
            username="ops.technician",
            email="ops.technician@example.com",
            password="StrongPass123!",
        )
        self.technician.profile.role = UserProfile.Role.TECHNICIAN
        self.technician.profile.save(update_fields=["role"])

        self.invite_user = User.objects.create_user(
            username="activation.user",
            email="activation.user@example.com",
        )
        self.invite_user.is_active = False
        self.invite_user.set_unusable_password()
        self.invite_user.save()
        self.invite_user.profile.role = UserProfile.Role.REQUESTER
        self.invite_user.profile.save(update_fields=["role"])

        department = Department.objects.create(name="Bilgi İşlem")
        Employee.objects.create(
            user=self.invite_user,
            full_name="Activation Person",
            employee_code="EMP-ACT",
            department=department,
            email="activation.person@example.com",
        )
        Employee.objects.create(
            user=self.technician,
            full_name="Technician Person",
            employee_code="EMP-TECH",
            department=department,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user)

    def test_admin_can_list_users(self):
        self.authenticate(self.admin)
        response = self.client.get("/api/admin-console/users/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertGreaterEqual(response.data["count"], 4)

    def test_requester_and_technician_cannot_list_users(self):
        for user in [self.requester, self.technician]:
            self.authenticate(user)
            response = self.client.get("/api/admin-console/users/")
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_list_users(self):
        response = self.client.get("/api/admin-console/users/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_can_get_user_detail(self):
        self.authenticate(self.admin)
        response = self.client.get(f"/api/admin-console/users/{self.invite_user.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], self.invite_user.username)
        self.assertIn("recommended_next_step", response.data)

    def test_user_detail_404_for_missing(self):
        self.authenticate(self.admin)
        response = self.client.get("/api/admin-console/users/999999/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_search_username_and_employee_name(self):
        self.authenticate(self.admin)
        by_username = self.client.get(
            "/api/admin-console/users/",
            {"search": "activation.user"},
        )
        by_employee = self.client.get(
            "/api/admin-console/users/",
            {"search": "Activation Person"},
        )

        self.assertEqual(by_username.data["count"], 1)
        self.assertEqual(by_employee.data["count"], 1)

    def test_list_filters_role_is_active_and_has_employee(self):
        self.authenticate(self.admin)
        role_response = self.client.get("/api/admin-console/users/", {"role": "technician"})
        inactive_response = self.client.get(
            "/api/admin-console/users/",
            {"is_active": "false"},
        )
        linked_response = self.client.get(
            "/api/admin-console/users/",
            {"has_employee": "true"},
        )

        self.assertEqual(role_response.data["results"][0]["role"], "technician")
        self.assertEqual(inactive_response.data["results"][0]["username"], "activation.user")
        self.assertGreaterEqual(linked_response.data["count"], 2)

    def test_activation_state_filters_pending_and_expired_invitation(self):
        now = timezone.now()
        UserInvitation.objects.create(
            user=self.invite_user,
            token_hash="pending-admin-users-token",
            status=UserInvitation.Status.PENDING,
            expires_at=now + timezone.timedelta(days=1),
        )
        UserInvitation.objects.create(
            user=self.technician,
            token_hash="expired-admin-users-token",
            status=UserInvitation.Status.PENDING,
            expires_at=now - timezone.timedelta(days=1),
        )

        self.authenticate(self.admin)
        pending = self.client.get(
            "/api/admin-console/users/",
            {"activation_state": "pending_invitation"},
        )
        expired = self.client.get(
            "/api/admin-console/users/",
            {"activation_state": "expired_invitation"},
        )

        self.assertEqual(pending.data["results"][0]["username"], "activation.user")
        self.assertEqual(expired.data["results"][0]["username"], "ops.technician")

    def test_response_excludes_password_token_hash_and_activation_url(self):
        UserInvitation.objects.create(
            user=self.invite_user,
            token_hash="secret-token-hash",
            status=UserInvitation.Status.PENDING,
            expires_at=timezone.now() + timezone.timedelta(days=1),
        )
        self.authenticate(self.admin)
        response = self.client.get(f"/api/admin-console/users/{self.invite_user.id}/")

        response_text = json.dumps(response.data, default=str).lower()
        self.assertNotIn("password", response_text)
        self.assertNotIn("token_hash", response_text)
        self.assertNotIn("secret-token-hash", response_text)
        self.assertNotIn("activation_url", response_text)
        self.assertNotIn("activation.person@example.com", response_text)

    def test_user_without_employee_is_handled_and_pagination_works(self):
        self.authenticate(self.admin)
        no_employee = self.client.get(
            "/api/admin-console/users/",
            {"activation_state": "no_employee", "page_size": 2},
        )

        self.assertEqual(no_employee.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(no_employee.data["results"]), 2)
        self.assertTrue(
            all(item["employee"] is None for item in no_employee.data["results"])
        )

    def test_overview_additive_user_counts_work(self):
        self.authenticate(self.admin)
        with tempfile.TemporaryDirectory() as manifest_dir, override_settings(
            BACKUP_MANIFEST_DIR=manifest_dir
        ):
            response = self.client.get("/api/admin-console/overview/")

        self.assertIn("activation_needed_users", response.data["accounts"])
        self.assertIn("users_without_employee", response.data["accounts"])

    def action_payload(self, action, username, **overrides):
        payload = {
            "reason": "Operasyonel güvenlik kontrolü",
            "confirmation": f"{action} {username}",
        }
        payload.update(overrides)
        return payload

    def action_url(self, user, action):
        return f"/api/admin-console/users/{user.id}/{action}/"

    def test_admin_can_deactivate_user_and_audit_is_safe(self):
        self.authenticate(self.admin)
        response = self.client.post(
            self.action_url(self.technician, "deactivate"),
            self.action_payload("DEACTIVATE", self.technician.username),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.technician.refresh_from_db()
        self.assertFalse(self.technician.is_active)
        self.assertEqual(response.data["user"]["is_active"], False)

        audit = AuditLog.objects.get(metadata__operation="admin_user_deactivate")
        self.assertEqual(audit.metadata["target_user_id"], self.technician.id)
        self.assertEqual(audit.changes["is_active"], {"old": True, "new": False})
        audit_text = json.dumps(
            {"metadata": audit.metadata, "changes": audit.changes},
            default=str,
        ).lower()
        self.assertNotIn("password", audit_text)
        self.assertNotIn("token", audit_text)
        self.assertNotIn("token_hash", audit_text)
        self.assertNotIn("activation_url", audit_text)

    def test_admin_can_reactivate_user_with_usable_credential(self):
        self.technician.is_active = False
        self.technician.save(update_fields=["is_active"])

        self.authenticate(self.admin)
        response = self.client.post(
            self.action_url(self.technician, "reactivate"),
            self.action_payload("REACTIVATE", self.technician.username),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.technician.refresh_from_db()
        self.assertTrue(self.technician.is_active)
        self.assertTrue(
            AuditLog.objects.filter(metadata__operation="admin_user_reactivate").exists()
        )

    def test_admin_can_change_role_and_list_detail_reflect_it(self):
        self.authenticate(self.admin)
        response = self.client.post(
            self.action_url(self.technician, "change-role"),
            {
                **self.action_payload("CHANGE ROLE", self.technician.username),
                "role": UserProfile.Role.VIEWER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.technician.profile.refresh_from_db()
        self.assertEqual(self.technician.profile.role, UserProfile.Role.VIEWER)
        self.assertEqual(response.data["user"]["role"], UserProfile.Role.VIEWER)

        list_response = self.client.get(
            "/api/admin-console/users/",
            {"search": self.technician.username},
        )
        detail_response = self.client.get(
            f"/api/admin-console/users/{self.technician.id}/"
        )
        self.assertEqual(list_response.data["results"][0]["role"], UserProfile.Role.VIEWER)
        self.assertEqual(detail_response.data["role"], UserProfile.Role.VIEWER)

        audit = AuditLog.objects.get(metadata__operation="admin_user_role_change")
        self.assertEqual(
            audit.changes["role"],
            {"old": UserProfile.Role.TECHNICIAN, "new": UserProfile.Role.VIEWER},
        )

    def test_non_admin_and_anonymous_cannot_run_user_actions(self):
        for actor in [self.requester, self.technician]:
            self.authenticate(actor)
            response = self.client.post(
                self.action_url(self.requester, "deactivate"),
                self.action_payload("DEACTIVATE", self.requester.username),
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate(None)
        response = self.client.post(
            self.action_url(self.requester, "reactivate"),
            self.action_payload("REACTIVATE", self.requester.username),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_reason_and_confirmation_validation(self):
        self.authenticate(self.admin)
        missing_reason = self.client.post(
            self.action_url(self.technician, "deactivate"),
            {"reason": "bad", "confirmation": f"DEACTIVATE {self.technician.username}"},
            format="json",
        )
        bad_confirmation = self.client.post(
            self.action_url(self.technician, "deactivate"),
            {"reason": "Geçerli gerekçe", "confirmation": "DEACTIVATE wrong.user"},
            format="json",
        )
        long_reason = self.client.post(
            self.action_url(self.technician, "deactivate"),
            {
                "reason": "a" * 501,
                "confirmation": f"DEACTIVATE {self.technician.username}",
            },
            format="json",
        )

        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(bad_confirmation.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(long_reason.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deactivate_guards_self_already_inactive_and_last_admin(self):
        self.authenticate(self.admin)
        self_request = self.client.post(
            self.action_url(self.admin, "deactivate"),
            self.action_payload("DEACTIVATE", self.admin.username),
            format="json",
        )
        self.assertEqual(self_request.status_code, status.HTTP_400_BAD_REQUEST)

        self.technician.is_active = False
        self.technician.save(update_fields=["is_active"])
        inactive_response = self.client.post(
            self.action_url(self.technician, "deactivate"),
            self.action_payload("DEACTIVATE", self.technician.username),
            format="json",
        )
        self.assertEqual(inactive_response.status_code, status.HTTP_400_BAD_REQUEST)

        second_admin = get_user_model().objects.create_user(
            username="second.admin",
            email="second.admin@example.com",
            password="StrongPass123!",
        )
        second_admin.profile.role = UserProfile.Role.ADMIN
        second_admin.profile.save(update_fields=["role"])
        self.admin.profile.role = UserProfile.Role.VIEWER
        self.admin.profile.save(update_fields=["role"])
        self.authenticate(second_admin)
        last_admin_response = self.client.post(
            self.action_url(second_admin, "deactivate"),
            self.action_payload("DEACTIVATE", second_admin.username),
            format="json",
        )
        self.assertEqual(last_admin_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reactivate_guards_active_and_unusable_credential(self):
        self.authenticate(self.admin)
        active_response = self.client.post(
            self.action_url(self.technician, "reactivate"),
            self.action_payload("REACTIVATE", self.technician.username),
            format="json",
        )
        unusable_response = self.client.post(
            self.action_url(self.invite_user, "reactivate"),
            self.action_payload("REACTIVATE", self.invite_user.username),
            format="json",
        )

        self.assertEqual(active_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unusable_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_role_change_guards_self_invalid_same_and_last_admin_demotion(self):
        self.authenticate(self.admin)
        own_role = self.client.post(
            self.action_url(self.admin, "change-role"),
            {
                **self.action_payload("CHANGE ROLE", self.admin.username),
                "role": UserProfile.Role.VIEWER,
            },
            format="json",
        )
        invalid_role = self.client.post(
            self.action_url(self.technician, "change-role"),
            {
                **self.action_payload("CHANGE ROLE", self.technician.username),
                "role": "owner",
            },
            format="json",
        )
        same_role = self.client.post(
            self.action_url(self.technician, "change-role"),
            {
                **self.action_payload("CHANGE ROLE", self.technician.username),
                "role": UserProfile.Role.TECHNICIAN,
            },
            format="json",
        )

        self.assertEqual(own_role.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_role.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(same_role.status_code, status.HTTP_400_BAD_REQUEST)

        only_admin = get_user_model().objects.create_user(
            username="only.admin",
            email="only.admin@example.com",
            password="StrongPass123!",
        )
        only_admin.profile.role = UserProfile.Role.ADMIN
        only_admin.profile.save(update_fields=["role"])
        self.admin.profile.role = UserProfile.Role.VIEWER
        self.admin.profile.save(update_fields=["role"])
        self.authenticate(only_admin)
        demotion_response = self.client.post(
            self.action_url(only_admin, "change-role"),
            {
                **self.action_payload("CHANGE ROLE", only_admin.username),
                "role": UserProfile.Role.VIEWER,
            },
            format="json",
        )
        self.assertEqual(demotion_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_action_response_excludes_sensitive_values(self):
        UserInvitation.objects.create(
            user=self.technician,
            token_hash="unsafe-token-hash",
            status=UserInvitation.Status.PENDING,
            expires_at=timezone.now() + timezone.timedelta(days=1),
        )
        self.authenticate(self.admin)
        response = self.client.post(
            self.action_url(self.technician, "change-role"),
            {
                **self.action_payload("CHANGE ROLE", self.technician.username),
                "role": UserProfile.Role.VIEWER,
            },
            format="json",
        )

        response_text = json.dumps(response.data, default=str).lower()
        self.assertNotIn("password", response_text)
        self.assertNotIn("token_hash", response_text)
        self.assertNotIn("unsafe-token-hash", response_text)
        self.assertNotIn("activation_url", response_text)
