from django.urls import path

from apps.audit.views import (
    AuditLogDetailAPIView,
    AuditLogListAPIView,
    AuditLogSummaryAPIView,
)

urlpatterns = [
    path("logs/summary/", AuditLogSummaryAPIView.as_view(), name="audit-log-summary"),
    path("logs/<int:pk>/", AuditLogDetailAPIView.as_view(), name="audit-log-detail"),
    path("logs/", AuditLogListAPIView.as_view(), name="audit-log-list"),
]