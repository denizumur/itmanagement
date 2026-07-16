from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.maintenance.views import (
    MaintenanceRecordTableListAPIView,
    MaintenanceRecordViewSet,
)

router = DefaultRouter()
router.register("records", MaintenanceRecordViewSet, basename="maintenance-record")

urlpatterns = [
    path(
        "records/table/",
        MaintenanceRecordTableListAPIView.as_view(),
        name="maintenance-record-table",
    ),
    *router.urls,
]