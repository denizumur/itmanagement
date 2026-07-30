from django.urls import path

from apps.operations.views import (
    AdminConsoleOverviewAPIView,
    AdminConsoleUserDetailAPIView,
    AdminConsoleUserListAPIView,
)

urlpatterns = [
    path(
        "overview/",
        AdminConsoleOverviewAPIView.as_view(),
        name="admin-console-overview",
    ),
    path("users/", AdminConsoleUserListAPIView.as_view(), name="admin-console-users"),
    path(
        "users/<int:pk>/",
        AdminConsoleUserDetailAPIView.as_view(),
        name="admin-console-user-detail",
    ),
]
