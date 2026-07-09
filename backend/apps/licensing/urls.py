from rest_framework.routers import DefaultRouter

from apps.licensing.views import LicenseSubscriptionViewSet

router = DefaultRouter()
router.register(
    "subscriptions",
    LicenseSubscriptionViewSet,
    basename="license-subscription",
)

urlpatterns = router.urls