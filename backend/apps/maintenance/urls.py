from rest_framework.routers import DefaultRouter

from apps.maintenance.views import MaintenanceRecordViewSet

router = DefaultRouter()
router.register("records", MaintenanceRecordViewSet, basename="maintenance-record")

urlpatterns = router.urls