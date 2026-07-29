from .base import *

DEBUG = False
REFRESH_TOKEN_COOKIE_SECURE = True
AUTH_COOKIE_REQUIRE_ORIGIN = True

PRODUCTION_CACHE_URL = env(
    "REDIS_URL",
    default=env("CACHE_URL", default="redis://redis:6379/0"),
)
CACHES = {
    "default": build_default_cache_config(PRODUCTION_CACHE_URL),
}

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = (
    "rest_framework.renderers.JSONRenderer",
)
