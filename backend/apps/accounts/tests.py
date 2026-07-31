from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import UserInvitation, UserProfile
from apps.audit.models import AuditLog
from apps.employees.models import Employee
from apps.accounts.throttles import LoginRateThrottle
from config.settings import production as production_settings
from config.settings.base import build_default_cache_config


TRUSTED_ORIGIN = "http://localhost:5173"
UNTRUSTED_ORIGIN = "http://evil.example"


def auth_security_overrides(require_origin=True):
    return override_settings(
        AUTH_COOKIE_REQUIRE_ORIGIN=require_origin,
        AUTH_COOKIE_ALLOWED_ORIGINS=[TRUSTED_ORIGIN],
        CORS_ALLOWED_ORIGINS=[TRUSTED_ORIGIN],
        CSRF_TRUSTED_ORIGINS=[TRUSTED_ORIGIN],
        REFRESH_TOKEN_COOKIE_SECURE=True,
        REFRESH_TOKEN_COOKIE_SAMESITE="Lax",
    )


class CookieAuthHardeningTests(APITestCase):
    def setUp(self):
        cache.clear()
        user_model = get_user_model()
        self.password = "StrongPass123!"
        self.user = user_model.objects.create_user(
            username="security.user",
            email="security.user@example.com",
            password=self.password,
            first_name="Security",
            last_name="User",
        )
        self.user.profile.role = UserProfile.Role.TECHNICIAN
        self.user.profile.save(update_fields=["role"])

    def tearDown(self):
        cache.clear()

    def login_payload(self, password=None):
        return {
            "username": self.user.username,
            "password": password or self.password,
        }

    def login_with_trusted_origin(self):
        return self.client.post(
            "/api/auth/cookie-token/",
            self.login_payload(),
            format="json",
            HTTP_ORIGIN=TRUSTED_ORIGIN,
        )

    def assert_no_auth_material(self, response):
        self.assertNotIn("access", getattr(response, "data", {}) or {})
        self.assertNotIn(settings.REFRESH_TOKEN_COOKIE_NAME, response.cookies)

    @auth_security_overrides()
    def test_cookie_login_trusted_origin_returns_access_user_and_cookie(self):
        response = self.login_with_trusted_origin()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["username"], self.user.username)

        cookie = response.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]
        self.assertEqual(cookie["httponly"], True)
        self.assertEqual(cookie["secure"], True)
        self.assertEqual(
            cookie["samesite"],
            settings.REFRESH_TOKEN_COOKIE_SAMESITE,
        )
        self.assertEqual(cookie["path"], "/api/auth/")
        self.assertEqual(
            cookie["max-age"],
            settings.REFRESH_TOKEN_COOKIE_MAX_AGE,
        )

    @auth_security_overrides()
    def test_cookie_login_missing_origin_rejects_without_tokens(self):
        response = self.client.post(
            "/api/auth/cookie-token/",
            self.login_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assert_no_auth_material(response)

    @auth_security_overrides()
    def test_cookie_login_untrusted_origin_rejects_without_tokens(self):
        response = self.client.post(
            "/api/auth/cookie-token/",
            self.login_payload(),
            format="json",
            HTTP_ORIGIN=UNTRUSTED_ORIGIN,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assert_no_auth_material(response)

    @auth_security_overrides()
    def test_cookie_login_trusted_origin_wrong_password_sets_no_cookie(self):
        response = self.client.post(
            "/api/auth/cookie-token/",
            self.login_payload(password="wrong-password"),
            format="json",
            HTTP_ORIGIN=TRUSTED_ORIGIN,
        )

        self.assertIn(
            response.status_code,
            {status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED},
        )
        self.assert_no_auth_material(response)

    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_AUTHENTICATION_CLASSES": (
                "rest_framework_simplejwt.authentication.JWTAuthentication",
            ),
            "DEFAULT_PERMISSION_CLASSES": (
                "rest_framework.permissions.IsAuthenticated",
            ),
            "DEFAULT_THROTTLE_RATES": {
                "login": "5/5m",
            },
        }
    )
    def test_cookie_login_rate_limit_returns_429_after_threshold(self):
        cache.clear()
        url = "/api/auth/cookie-token/"
        payload = {
            "email": "not-existing@example.com",
            "password": "wrong-password",
        }

        first_five_status_codes = []

        for _ in range(5):
            response = self.client.post(url, payload, format="json")
            first_five_status_codes.append(response.status_code)

        throttled_response = self.client.post(url, payload, format="json")

        self.assertTrue(
            all(
                code
                in {status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED}
                for code in first_five_status_codes
            ),
            first_five_status_codes,
        )
        self.assertEqual(
            throttled_response.status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_AUTHENTICATION_CLASSES": (
                "rest_framework_simplejwt.authentication.JWTAuthentication",
            ),
            "DEFAULT_PERMISSION_CLASSES": (
                "rest_framework.permissions.IsAuthenticated",
            ),
            "DEFAULT_THROTTLE_RATES": {
                "login": "5/5m",
            },
        }
    )
    def test_cookie_login_rate_limit_key_is_separated_by_email(self):
        cache.clear()
        url = "/api/auth/cookie-token/"
        first_payload = {
            "email": "first@example.com",
            "password": "wrong-password",
        }
        second_payload = {
            "email": "second@example.com",
            "password": "wrong-password",
        }

        for _ in range(5):
            response = self.client.post(url, first_payload, format="json")
            self.assertIn(
                response.status_code,
                {status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED},
            )

        throttled_response = self.client.post(url, first_payload, format="json")
        separated_key_response = self.client.post(
            url,
            second_payload,
            format="json",
        )

        self.assertEqual(
            throttled_response.status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
        )
        self.assertIn(
            separated_key_response.status_code,
            {status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED},
        )

    @auth_security_overrides(require_origin=False)
    def test_cookie_refresh_rejects_untrusted_origin(self):
        response = self.client.post(
            "/api/auth/cookie-refresh/",
            {},
            format="json",
            HTTP_ORIGIN=UNTRUSTED_ORIGIN,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn("access", response.data)

    @auth_security_overrides(require_origin=False)
    def test_cookie_refresh_allows_trusted_origin_but_requires_refresh_cookie(self):
        response = self.client.post(
            "/api/auth/cookie-refresh/",
            {},
            format="json",
            HTTP_ORIGIN=TRUSTED_ORIGIN,
        )

        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @auth_security_overrides()
    def test_cookie_refresh_valid_cookie_trusted_origin_returns_access(self):
        login_response = self.login_with_trusted_origin()
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            "/api/auth/cookie-refresh/",
            {},
            format="json",
            HTTP_ORIGIN=TRUSTED_ORIGIN,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)

        if settings.REFRESH_TOKEN_COOKIE_NAME in response.cookies:
            cookie = response.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]
            self.assertEqual(cookie["httponly"], True)
            self.assertEqual(cookie["path"], "/api/auth/")

    @auth_security_overrides()
    def test_cookie_refresh_missing_cookie_is_controlled_401_and_clears_cookie(self):
        response = self.client.post(
            "/api/auth/cookie-refresh/",
            {},
            format="json",
            HTTP_ORIGIN=TRUSTED_ORIGIN,
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("access", response.data)
        cookie = response.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]
        self.assertEqual(cookie["max-age"], 0)
        self.assertEqual(cookie["path"], "/api/auth/")

    @auth_security_overrides()
    def test_cookie_refresh_invalid_cookie_is_controlled_401_and_clears_cookie(self):
        self.client.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = "invalid-token"

        response = self.client.post(
            "/api/auth/cookie-refresh/",
            {},
            format="json",
            HTTP_ORIGIN=TRUSTED_ORIGIN,
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("access", response.data)
        cookie = response.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]
        self.assertEqual(cookie["max-age"], 0)
        self.assertEqual(cookie["path"], "/api/auth/")

    @auth_security_overrides()
    def test_cookie_refresh_untrusted_origin_rejects_even_with_cookie(self):
        refresh_token = str(RefreshToken.for_user(self.user))
        self.client.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = refresh_token

        response = self.client.post(
            "/api/auth/cookie-refresh/",
            {},
            format="json",
            HTTP_ORIGIN=UNTRUSTED_ORIGIN,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn("access", response.data)

    @auth_security_overrides()
    def test_logout_trusted_origin_clears_cookie(self):
        login_response = self.login_with_trusted_origin()
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            "/api/auth/logout/",
            {},
            format="json",
            HTTP_ORIGIN=TRUSTED_ORIGIN,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cookie = response.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]
        self.assertEqual(cookie["max-age"], 0)
        self.assertEqual(cookie["path"], "/api/auth/")

    @auth_security_overrides()
    def test_logout_without_cookie_or_token_is_controlled_and_clears_cookie(self):
        response = self.client.post(
            "/api/auth/logout/",
            {},
            format="json",
            HTTP_ORIGIN=TRUSTED_ORIGIN,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cookie = response.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]
        self.assertEqual(cookie["max-age"], 0)
        self.assertEqual(cookie["path"], "/api/auth/")

    @auth_security_overrides()
    def test_logout_untrusted_origin_rejects_without_cookie_clear(self):
        refresh_token = str(RefreshToken.for_user(self.user))
        self.client.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = refresh_token

        response = self.client.post(
            "/api/auth/logout/",
            {},
            format="json",
            HTTP_ORIGIN=UNTRUSTED_ORIGIN,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn(settings.REFRESH_TOKEN_COOKIE_NAME, response.cookies)


class AuthSecuritySettingsTests(APITestCase):
    def test_cache_config_uses_redis_when_cache_url_is_configured(self):
        cache_config = build_default_cache_config("redis://redis:6379/0")

        self.assertEqual(
            cache_config["BACKEND"],
            "django_redis.cache.RedisCache",
        )
        self.assertEqual(cache_config["LOCATION"], "redis://redis:6379/0")
        self.assertEqual(
            cache_config["OPTIONS"]["CLIENT_CLASS"],
            "django_redis.client.DefaultClient",
        )

    def test_cache_config_uses_locmem_only_without_cache_url(self):
        cache_config = build_default_cache_config(None)

        self.assertEqual(
            cache_config["BACKEND"],
            "django.core.cache.backends.locmem.LocMemCache",
        )

    def test_production_auth_defaults_are_secure(self):
        self.assertIs(production_settings.REFRESH_TOKEN_COOKIE_SECURE, True)
        self.assertIs(production_settings.AUTH_COOKIE_REQUIRE_ORIGIN, True)
        self.assertIs(production_settings.CSRF_COOKIE_SECURE, True)

    def test_production_cache_backend_is_redis(self):
        self.assertEqual(
            production_settings.CACHES["default"]["BACKEND"],
            "django_redis.cache.RedisCache",
        )
        self.assertNotEqual(
            production_settings.CACHES["default"]["BACKEND"],
            "django.core.cache.backends.locmem.LocMemCache",
        )

    def test_login_rate_throttle_uses_default_cache_and_login_rate(self):
        throttle = LoginRateThrottle()

        self.assertIs(throttle.cache, cache)
        self.assertEqual(throttle.scope, "login")
        self.assertEqual(
            settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["login"],
            "5/5m",
        )


class UserInvitationTests(APITestCase):
    def create_user_with_role(self, username, role, *, is_active=True, password=None):
        user_model = get_user_model()
        user = user_model.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password=password,
        )
        user.is_active = is_active
        if password is None:
            user.set_unusable_password()
        user.save(update_fields=["is_active", "password"])
        user.profile.role = role
        user.profile.save(update_fields=["role"])
        return user

    def setUp(self):
        self.admin_user = self.create_user_with_role(
            "invite-admin",
            UserProfile.Role.ADMIN,
            password="StrongPass123!",
        )
        self.technician_user = self.create_user_with_role(
            "invite-technician",
            UserProfile.Role.TECHNICIAN,
            password="StrongPass123!",
        )
        self.inactive_user = self.create_user_with_role(
            "inactive-imported",
            UserProfile.Role.REQUESTER,
            is_active=False,
        )

    def create_invitation(self, user=None, actor=None):
        self.client.force_authenticate(user=actor or self.admin_user)
        response = self.client.post(
            "/api/auth/invitations/",
            {"user_id": (user or self.inactive_user).id},
            format="json",
        )
        self.client.force_authenticate(user=None)
        return response

    def token_from_activation_url(self, activation_url):
        return activation_url.split("token=", 1)[1]

    def test_admin_can_create_invitation_for_inactive_unusable_user(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.create_invitation()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        token = self.token_from_activation_url(response.data["activation_url"])
        invitation = UserInvitation.objects.get(id=response.data["invitation_id"])

        self.assertNotEqual(invitation.token_hash, token)
        self.assertEqual(len(invitation.token_hash), 64)
        self.assertEqual(invitation.status, UserInvitation.Status.PENDING)

        audit_log = AuditLog.objects.filter(
            entity_type="accounts.UserInvitation",
            metadata__operation="user_invitation_create",
        ).first()
        self.assertIsNotNone(audit_log)
        self.assertNotIn(token, str(audit_log.metadata))
        self.assertEqual(response.data["email_delivery"]["status"], "skipped")
        self.assertEqual(response.data["email_delivery"]["reason"], "email_disabled")

    @override_settings(
        INVITATION_EMAIL_ENABLED=True,
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        DEFAULT_FROM_EMAIL="no-reply@example.test",
    )
    def test_invitation_create_sends_email_when_enabled(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.create_invitation()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        token = self.token_from_activation_url(response.data["activation_url"])
        self.assertEqual(response.data["email_delivery"]["status"], "sent")
        self.assertEqual(response.data["email_delivery"]["attempted"], True)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(response.data["activation_url"], mail.outbox[0].body)
        self.assertNotIn("StrongPass123!", mail.outbox[0].body)
        self.assertNotIn("NewStrongPass123!", mail.outbox[0].body)

        audit_log = AuditLog.objects.filter(
            entity_type="accounts.UserInvitation",
            metadata__operation="user_invitation_create",
        ).first()
        self.assertIsNotNone(audit_log)
        self.assertEqual(audit_log.metadata["email_delivery_status"], "sent")
        self.assertNotIn(token, str(audit_log.metadata))
        self.assertNotIn(response.data["activation_url"], str(audit_log.metadata))

    @override_settings(
        INVITATION_EMAIL_ENABLED=True,
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    )
    def test_invitation_email_failure_does_not_rollback_invitation(self):
        with patch(
            "apps.accounts.emailing.send_mail",
            side_effect=TimeoutError("timeout"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.create_invitation()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        invitation = UserInvitation.objects.get(id=response.data["invitation_id"])
        self.assertEqual(invitation.status, UserInvitation.Status.PENDING)
        self.assertEqual(response.data["email_delivery"]["status"], "failed")
        self.assertEqual(response.data["email_delivery"]["reason"], "connection_timeout")

        token = self.token_from_activation_url(response.data["activation_url"])
        audit_log = AuditLog.objects.filter(
            entity_type="accounts.UserInvitation",
            metadata__operation="user_invitation_create",
        ).first()
        self.assertIsNotNone(audit_log)
        self.assertEqual(audit_log.metadata["email_delivery_status"], "failed")
        self.assertEqual(
            audit_log.metadata["email_delivery_error_code"],
            "connection_timeout",
        )
        self.assertNotIn(token, str(audit_log.metadata))
        self.assertNotIn(response.data["activation_url"], str(audit_log.metadata))

    @override_settings(INVITATION_EMAIL_ENABLED=True)
    def test_invitation_email_skipped_when_recipient_email_missing(self):
        self.inactive_user.email = ""
        self.inactive_user.save(update_fields=["email"])

        response = self.create_invitation()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["email_delivery"]["status"], "skipped")
        self.assertEqual(
            response.data["email_delivery"]["reason"],
            "missing_recipient_email",
        )

    def test_non_admin_cannot_create_invitation(self):
        response = self.create_invitation(actor=self.technician_user)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_list_invitations(self):
        create_response = self.create_invitation()

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/api/auth/invitations/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], create_response.data["invitation_id"])
        self.assertEqual(response.data[0]["username"], self.inactive_user.username)

    def test_non_admin_cannot_list_invitations(self):
        self.client.force_authenticate(user=self.technician_user)

        response = self.client.get("/api/auth/invitations/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invitation_list_response_excludes_token_hash(self):
        create_response = self.create_invitation()
        token = self.token_from_activation_url(create_response.data["activation_url"])

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/api/auth/invitations/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        serialized = str(response.data)
        self.assertNotIn("token_hash", serialized)
        self.assertNotIn(token, serialized)

    def test_invitation_list_marks_expired_invitation(self):
        create_response = self.create_invitation()
        invitation = UserInvitation.objects.get(id=create_response.data["invitation_id"])
        invitation.expires_at = timezone.now() - timezone.timedelta(minutes=1)
        invitation.save(update_fields=["expires_at"])

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/api/auth/invitations/", {"status": "pending"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        invitation_item = next(item for item in response.data if item["id"] == invitation.id)
        self.assertTrue(invitation_item["is_expired"])

    def test_cannot_create_invitation_for_active_user(self):
        response = self.create_invitation(user=self.technician_user)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_creating_new_invitation_revokes_previous_pending(self):
        first_response = self.create_invitation()
        second_response = self.create_invitation()

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_201_CREATED)
        first_invitation = UserInvitation.objects.get(id=first_response.data["invitation_id"])
        second_invitation = UserInvitation.objects.get(id=second_response.data["invitation_id"])
        self.assertEqual(first_invitation.status, UserInvitation.Status.REVOKED)
        self.assertEqual(second_invitation.status, UserInvitation.Status.PENDING)

    def test_accept_invitation_sets_password_and_activates_user(self):
        response = self.create_invitation()
        token = self.token_from_activation_url(response.data["activation_url"])

        with self.captureOnCommitCallbacks(execute=True):
            accept_response = self.client.post(
                "/api/auth/invitations/accept/",
                {
                    "token": token,
                    "password": "NewStrongPass123!",
                    "password_confirm": "NewStrongPass123!",
                },
                format="json",
            )

        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)
        self.inactive_user.refresh_from_db()
        self.assertTrue(self.inactive_user.is_active)
        self.assertTrue(self.inactive_user.has_usable_password())
        invitation = UserInvitation.objects.get(id=response.data["invitation_id"])
        self.assertEqual(invitation.status, UserInvitation.Status.ACCEPTED)
        self.assertIsNotNone(invitation.accepted_at)
        self.assertTrue(
            AuditLog.objects.filter(
                entity_type="accounts.UserInvitation",
                metadata__operation="user_invitation_accept",
            ).exists(),
        )

    def test_accept_invitation_rejects_expired_token(self):
        response = self.create_invitation()
        token = self.token_from_activation_url(response.data["activation_url"])
        invitation = UserInvitation.objects.get(id=response.data["invitation_id"])
        invitation.expires_at = timezone.now() - timezone.timedelta(minutes=1)
        invitation.save(update_fields=["expires_at"])

        accept_response = self.client.post(
            "/api/auth/invitations/accept/",
            {
                "token": token,
                "password": "NewStrongPass123!",
                "password_confirm": "NewStrongPass123!",
            },
            format="json",
        )

        self.assertEqual(accept_response.status_code, status.HTTP_410_GONE)

    def test_accept_invitation_rejects_reused_token(self):
        response = self.create_invitation()
        token = self.token_from_activation_url(response.data["activation_url"])
        payload = {
            "token": token,
            "password": "NewStrongPass123!",
            "password_confirm": "NewStrongPass123!",
        }

        first_response = self.client.post("/api/auth/invitations/accept/", payload, format="json")
        second_response = self.client.post("/api/auth/invitations/accept/", payload, format="json")

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_accept_invitation_rejects_invalid_token(self):
        response = self.client.post(
            "/api/auth/invitations/accept/",
            {
                "token": "invalid-token",
                "password": "NewStrongPass123!",
                "password_confirm": "NewStrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_accept_invitation_rejects_password_mismatch(self):
        response = self.create_invitation()
        token = self.token_from_activation_url(response.data["activation_url"])

        accept_response = self.client.post(
            "/api/auth/invitations/accept/",
            {
                "token": token,
                "password": "NewStrongPass123!",
                "password_confirm": "DifferentPass123!",
            },
            format="json",
        )

        self.assertEqual(accept_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_accept_invitation_uses_django_password_validation(self):
        response = self.create_invitation()
        token = self.token_from_activation_url(response.data["activation_url"])

        accept_response = self.client.post(
            "/api/auth/invitations/accept/",
            {
                "token": token,
                "password": "123",
                "password_confirm": "123",
            },
            format="json",
        )

        self.assertEqual(accept_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", accept_response.data)

    def test_token_hash_only_no_raw_token_in_db_or_audit(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.create_invitation()

        token = self.token_from_activation_url(response.data["activation_url"])
        self.assertFalse(UserInvitation.objects.filter(token_hash=token).exists())
        self.assertFalse(AuditLog.objects.filter(metadata__icontains=token).exists())

    def test_revoke_invitation_admin_only_and_rejects_accepted(self):
        response = self.create_invitation()
        invitation_id = response.data["invitation_id"]

        self.client.force_authenticate(user=self.technician_user)
        forbidden_response = self.client.post(
            f"/api/auth/invitations/{invitation_id}/revoke/",
            {},
            format="json",
        )
        self.assertEqual(forbidden_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin_user)
        revoke_response = self.client.post(
            f"/api/auth/invitations/{invitation_id}/revoke/",
            {},
            format="json",
        )
        self.assertEqual(revoke_response.status_code, status.HTTP_200_OK)

        accepted_response = self.create_invitation()
        accepted_id = accepted_response.data["invitation_id"]
        token = self.token_from_activation_url(accepted_response.data["activation_url"])
        self.client.force_authenticate(user=None)
        self.client.post(
            "/api/auth/invitations/accept/",
            {
                "token": token,
                "password": "NewStrongPass123!",
                "password_confirm": "NewStrongPass123!",
            },
            format="json",
        )
        self.client.force_authenticate(user=self.admin_user)
        accepted_revoke_response = self.client.post(
            f"/api/auth/invitations/{accepted_id}/revoke/",
            {},
            format="json",
        )
        self.assertEqual(accepted_revoke_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_imported_inactive_user_can_receive_invitation(self):
        Employee.objects.create(
            user=self.inactive_user,
            full_name="Imported Invite User",
            email="imported.invite@example.com",
            imported_from_excel=True,
        )

        response = self.create_invitation(user=self.inactive_user)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("/activate-account?token=", response.data["activation_url"])
