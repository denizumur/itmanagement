from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.accounts.models import UserProfile


def get_user_role(user):
    if not user or not user.is_authenticated:
        return None

    if user.is_superuser:
        return UserProfile.Role.ADMIN

    profile = getattr(user, "profile", None)

    if not profile:
        return None

    return profile.role


class IsAdminRole(BasePermission):
    message = "Bu işlem için Admin yetkisi gerekir."

    def has_permission(self, request, view):
        return get_user_role(request.user) == UserProfile.Role.ADMIN


class IsTechnicianOrAdminRole(BasePermission):
    message = "Bu işlem için Admin veya Technician yetkisi gerekir."

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        return role in [
            UserProfile.Role.ADMIN,
            UserProfile.Role.TECHNICIAN,
        ]


class IsViewerOrAboveRole(BasePermission):
    message = "Bu işlem için giriş yapmış kullanıcı yetkisi gerekir."

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        return role in [
            UserProfile.Role.ADMIN,
            UserProfile.Role.TECHNICIAN,
            UserProfile.Role.VIEWER,
        ]


class ReadOnlyForViewerWriteForTechnician(BasePermission):
    """
    Viewer sadece GET/HEAD/OPTIONS yapabilir.
    Technician ve Admin yazabilir.
    """

    message = "Bu işlem için daha yüksek yetki gerekir."

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        if request.method in SAFE_METHODS:
            return role in [
                UserProfile.Role.ADMIN,
                UserProfile.Role.TECHNICIAN,
                UserProfile.Role.VIEWER,
            ]

        return role in [
            UserProfile.Role.ADMIN,
            UserProfile.Role.TECHNICIAN,
        ]