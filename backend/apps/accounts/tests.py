from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase


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