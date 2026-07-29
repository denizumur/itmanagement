from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import UserProfile
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
