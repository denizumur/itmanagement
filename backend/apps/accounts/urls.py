from django.urls import path

from apps.accounts.views import (
    CookieLoginView,
    CookieRefreshView,
    InvitationAcceptView,
    InvitationCreateView,
    InvitationRevokeView,
    LoginView,
    LogoutView,
    MeView,
    RefreshTokenView,
)

urlpatterns = [
    path("token/", LoginView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", RefreshTokenView.as_view(), name="token_refresh"),

    path("cookie-token/", CookieLoginView.as_view(), name="cookie_token_obtain_pair"),
    path("cookie-refresh/", CookieRefreshView.as_view(), name="cookie_token_refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("invitations/", InvitationCreateView.as_view(), name="invitation-create"),
    path("invitations/accept/", InvitationAcceptView.as_view(), name="invitation-accept"),
    path("invitations/<int:pk>/revoke/", InvitationRevokeView.as_view(), name="invitation-revoke"),

    path("me/", MeView.as_view(), name="me"),
]
