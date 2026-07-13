from django.conf import settings
from rest_framework import status
from rest_framework.response import Response


def get_allowed_auth_origins():
    configured_origins = getattr(settings, "AUTH_COOKIE_ALLOWED_ORIGINS", None)

    if configured_origins:
        return set(configured_origins)

    allowed_origins = set(getattr(settings, "CORS_ALLOWED_ORIGINS", []) or [])
    csrf_origins = set(getattr(settings, "CSRF_TRUSTED_ORIGINS", []) or [])

    return allowed_origins | csrf_origins


def validate_auth_origin(request):
    origin = request.headers.get("Origin")
    require_origin = getattr(
        settings,
        "AUTH_COOKIE_REQUIRE_ORIGIN",
        not settings.DEBUG,
    )

    if not origin:
        if require_origin:
            return Response(
                {"detail": "Origin header zorunludur."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return None

    allowed_origins = get_allowed_auth_origins()

    if origin not in allowed_origins:
        return Response(
            {"detail": "Bu origin auth işlemleri için izinli değil."},
            status=status.HTTP_403_FORBIDDEN,
        )

    return None