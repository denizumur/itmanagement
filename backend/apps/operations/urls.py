from django.urls import path

from apps.operations.views import AdminConsoleOverviewAPIView

urlpatterns = [
    path(
        "overview/",
        AdminConsoleOverviewAPIView.as_view(),
        name="admin-console-overview",
    ),
]
