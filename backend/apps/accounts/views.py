from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView as SimpleJWTTokenRefreshView

from apps.accounts.serializers import (
    CustomTokenObtainPairSerializer,
    CurrentUserSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RefreshTokenView(SimpleJWTTokenRefreshView):
    pass


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)


def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_COOKIE_MAX_AGE,
        httponly=True,
        secure=settings.REFRESH_TOKEN_COOKIE_SECURE,
        samesite=settings.REFRESH_TOKEN_COOKIE_SAMESITE,
        path="/api/auth/",
    )


def clear_refresh_cookie(response):
    response.delete_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        path="/api/auth/",
        samesite=settings.REFRESH_TOKEN_COOKIE_SAMESITE,
    )


class CookieLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CustomTokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        refresh_token = data.get("refresh")

        response = Response(
            {
                "access": data.get("access"),
                "user": data.get("user"),
            },
            status=status.HTTP_200_OK,
        )

        set_refresh_cookie(response, refresh_token)

        return response


class CookieRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(settings.REFRESH_TOKEN_COOKIE_NAME)

        if not refresh_token:
            return Response(
                {"detail": "Refresh token cookie bulunamadı."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        response = Response(
            {
                "access": data.get("access"),
            },
            status=status.HTTP_200_OK,
        )

        new_refresh = data.get("refresh")
        if new_refresh:
            set_refresh_cookie(response, new_refresh)

        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response({"detail": "Çıkış yapıldı."})
        clear_refresh_cookie(response)

        return response