from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.licensing.views import (
    LicenseSubscriptionTableListAPIView,
    LicenseSubscriptionViewSet,
)

router = DefaultRouter()
router.register(
    "subscriptions",
    LicenseSubscriptionViewSet,
    basename="license-subscription",
)

urlpatterns = [
    path(
        "subscriptions/table/",
        LicenseSubscriptionTableListAPIView.as_view(),
        name="license-subscription-table",
    ),
    *router.urls,
]