from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.reminders.views import ReminderTableListAPIView, ReminderViewSet

router = DefaultRouter()
router.register("", ReminderViewSet, basename="reminder")

urlpatterns = [
    path("table/", ReminderTableListAPIView.as_view(), name="reminder-table"),
    path("", include(router.urls)),
]