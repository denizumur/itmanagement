from django.urls import path

from apps.notifications.views import NotificationCenterAPIView

urlpatterns = [
    path("", NotificationCenterAPIView.as_view(), name="notification-center"),
]