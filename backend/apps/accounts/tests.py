from django.core.cache import cache
from django.conf import settings
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.throttles import LoginRateThrottle
from config.settings import production as production_settings
from config.settings.base import build_default_cache_config


class CookieAuthHardeningTests(APITestCase):
    def setUp(self):
        cache.clear()

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
            all(code in {status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED} for code in first_five_status_codes),
            first_five_status_codes,
        )
        self.assertEqual(throttled_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @override_settings(
        AUTH_COOKIE_REQUIRE_ORIGIN=False,
        AUTH_COOKIE_ALLOWED_ORIGINS=["http://localhost:5173"],
        CORS_ALLOWED_ORIGINS=["http://localhost:5173"],
        CSRF_TRUSTED_ORIGINS=["http://localhost:5173"],
    )
    def test_cookie_refresh_rejects_untrusted_origin(self):
        response = self.client.post(
            "/api/auth/cookie-refresh/",
            {},
            format="json",
            HTTP_ORIGIN="http://evil.localhost",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.data.get("detail"),
            "Bu origin auth işlemleri için izinli değil.",
        )

    @override_settings(
        AUTH_COOKIE_REQUIRE_ORIGIN=False,
        AUTH_COOKIE_ALLOWED_ORIGINS=["http://localhost:5173"],
        CORS_ALLOWED_ORIGINS=["http://localhost:5173"],
        CSRF_TRUSTED_ORIGINS=["http://localhost:5173"],
    )
    def test_cookie_refresh_allows_trusted_origin_but_requires_refresh_cookie(self):
        response = self.client.post(
            "/api/auth/cookie-refresh/",
            {},
            format="json",
            HTTP_ORIGIN="http://localhost:5173",
        )

        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


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
        self.assertEqual(
            settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["login"],
            "5/5m",
        )
