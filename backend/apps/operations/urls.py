from django.urls import path

from apps.operations.views import (
    AdminConsoleUserChangeRoleAPIView,
    AdminConsoleUserDeactivateAPIView,
    AdminConsoleOverviewAPIView,
    AdminConsoleUserReactivateAPIView,
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
    path(
        "users/<int:pk>/deactivate/",
        AdminConsoleUserDeactivateAPIView.as_view(),
        name="admin-console-user-deactivate",
    ),
    path(
        "users/<int:pk>/reactivate/",
        AdminConsoleUserReactivateAPIView.as_view(),
        name="admin-console-user-reactivate",
    ),
    path(
        "users/<int:pk>/change-role/",
        AdminConsoleUserChangeRoleAPIView.as_view(),
        name="admin-console-user-change-role",
    ),
]
