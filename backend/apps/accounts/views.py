from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView as SimpleJWTTokenRefreshView,
)

from apps.accounts.security import validate_auth_origin
from apps.accounts.serializers import (
    CustomTokenObtainPairSerializer,
    CurrentUserSerializer,
)
from apps.accounts.throttles import LoginRateThrottle


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]


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


def invalid_refresh_response(message="Oturum süresi doldu. Lütfen tekrar giriş yap."):
    response = Response(
        {"detail": message},
        status=status.HTTP_401_UNAUTHORIZED,
    )
    clear_refresh_cookie(response)

    return response


class CookieLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        origin_error = validate_auth_origin(request)
        if origin_error:
            return origin_error

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
        origin_error = validate_auth_origin(request)
        if origin_error:
            return origin_error

        refresh_token = request.COOKIES.get(settings.REFRESH_TOKEN_COOKIE_NAME)

        if not refresh_token:
            return invalid_refresh_response("Refresh token cookie bulunamadı.")

        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            return invalid_refresh_response()

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
        origin_error = validate_auth_origin(request)
        if origin_error:
            return origin_error

        response = Response({"detail": "Çıkış yapıldı."})

        refresh_token = (
            request.COOKIES.get(settings.REFRESH_TOKEN_COOKIE_NAME)
            or request.data.get("refresh")
        )

        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass

        clear_refresh_cookie(response)

        return response