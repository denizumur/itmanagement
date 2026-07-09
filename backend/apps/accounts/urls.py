from django.urls import path

from apps.accounts.views import (
    CookieLoginView,
    CookieRefreshView,
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

    path("me/", MeView.as_view(), name="me"),
]