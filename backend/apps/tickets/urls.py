from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.tickets.views import (
    TicketAttachmentDownloadAPIView,
    TicketTableListAPIView,
    TicketViewSet,
)

router = DefaultRouter()
router.register("", TicketViewSet, basename="tickets")

urlpatterns = [
    path("table/", TicketTableListAPIView.as_view(), name="ticket-table"),
    path(
        "attachments/<int:pk>/download/",
        TicketAttachmentDownloadAPIView.as_view(),
        name="ticket-attachment-download",
    ),
    *router.urls,
]