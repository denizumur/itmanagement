from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

def health_check(request):
    return JsonResponse(
        {
            "status": "ok",
            "service": "it-inventory-backend akiyor",
        }
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    path("api/", include("apps.assignments.urls")),
    path("api/maintenance/", include("apps.maintenance.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/licensing/", include("apps.licensing.urls")),
    path("api/reminders/", include("apps.reminders.urls")),
    path("api/dashboard/", include("apps.dashboard.urls")),
    path("api/employees/", include("apps.employees.urls")),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
        ),
        path(
            "api/redoc/",
            SpectacularRedocView.as_view(url_name="schema"),
            name="redoc",
            ),
]