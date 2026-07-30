from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
import hashlib
import secrets
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
    InvitationAcceptSerializer,
    InvitationCreateSerializer,
)
from apps.accounts.models import UserInvitation
from apps.accounts.permissions import IsAdminRole
from apps.accounts.throttles import LoginRateThrottle
from apps.audit.models import AuditLog
from apps.audit.services import create_audit_log


User = get_user_model()
INVITATION_TTL_DAYS = 7


def invitation_token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def frontend_base_url():
    return (
        getattr(settings, "FRONTEND_BASE_URL", "")
        or getattr(settings, "APP_FRONTEND_URL", "")
        or "http://localhost:5173"
    ).rstrip("/")


def activation_url(token):
    return f"{frontend_base_url()}/activate-account?token={token}"


def invitation_response(invitation):
    user = invitation.user
    created_by = invitation.created_by
    return {
        "id": invitation.id,
        "user_id": user.id,
        "username": user.username,
        "user_display_name": user.get_full_name() or user.username,
        "status": invitation.status,
        "expires_at": invitation.expires_at,
        "accepted_at": invitation.accepted_at,
        "revoked_at": invitation.revoked_at,
        "created_at": invitation.created_at,
        "created_by": created_by.username if created_by else "",
        "is_expired": (
            invitation.status == UserInvitation.Status.PENDING
            and invitation.expires_at <= timezone.now()
        ),
    }


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


class InvitationCreateView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        queryset = UserInvitation.objects.select_related("user", "created_by").order_by(
            "-created_at",
        )
        status_filter = request.query_params.get("status")
        user_id = request.query_params.get("user_id")
        search = (request.query_params.get("search") or "").strip()

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if user_id:
            queryset = queryset.filter(user_id=user_id)

        if search:
            queryset = queryset.filter(user__username__icontains=search)

        queryset = queryset[:100]

        return Response([invitation_response(invitation) for invitation in queryset])

    def post(self, request):
        serializer = InvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(id=serializer.validated_data["user_id"])
        except User.DoesNotExist:
            return Response({"detail": "Kullanıcı bulunamadı."}, status=status.HTTP_404_NOT_FOUND)

        if user.is_active:
            return Response({"detail": "Kullanıcı zaten aktif."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        UserInvitation.objects.filter(
            user=user,
            status=UserInvitation.Status.PENDING,
        ).update(
            status=UserInvitation.Status.REVOKED,
            revoked_at=now,
            updated_at=now,
        )

        token = secrets.token_urlsafe(32)
        invitation = UserInvitation.objects.create(
            user=user,
            token_hash=invitation_token_hash(token),
            created_by=request.user,
            expires_at=now + timezone.timedelta(days=INVITATION_TTL_DAYS),
            metadata={"operation": "user_invitation_create"},
        )

        create_audit_log(
            request=request,
            action=AuditLog.Action.CREATE,
            entity_type="accounts.UserInvitation",
            entity_id=str(invitation.id),
            entity_repr=f"Invitation {invitation.id}",
            metadata={
                "operation": "user_invitation_create",
                "user_id": user.id,
                "created_by": request.user.id,
                "expires_at": invitation.expires_at.isoformat(),
            },
        )

        return Response(
            {
                "invitation_id": invitation.id,
                "user_id": user.id,
                "expires_at": invitation.expires_at,
                "activation_url": activation_url(token),
            },
            status=status.HTTP_201_CREATED,
        )


class InvitationAcceptView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = InvitationAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]
        token_hash = invitation_token_hash(token)

        try:
            invitation = UserInvitation.objects.select_related("user").get(
                token_hash=token_hash,
            )
        except UserInvitation.DoesNotExist:
            return Response({"detail": "Davet token geçersiz."}, status=status.HTTP_400_BAD_REQUEST)

        if invitation.status != UserInvitation.Status.PENDING:
            return Response({"detail": "Davet token artık kullanılamaz."}, status=status.HTTP_400_BAD_REQUEST)

        if invitation.expires_at <= timezone.now():
            invitation.status = UserInvitation.Status.EXPIRED
            invitation.save(update_fields=["status", "updated_at"])
            return Response({"detail": "Davet token süresi doldu."}, status=status.HTTP_410_GONE)

        try:
            validate_password(serializer.validated_data["password"], invitation.user)
        except ValidationError as exc:
            return Response({"password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = invitation.user
            user.set_password(serializer.validated_data["password"])
            user.is_active = True
            user.save(update_fields=["password", "is_active"])

            invitation.status = UserInvitation.Status.ACCEPTED
            invitation.accepted_at = timezone.now()
            invitation.save(update_fields=["status", "accepted_at", "updated_at"])

            create_audit_log(
                action=AuditLog.Action.UPDATE,
                entity_type="accounts.UserInvitation",
                entity_id=str(invitation.id),
                entity_repr=f"Invitation {invitation.id}",
                metadata={
                    "operation": "user_invitation_accept",
                    "user_id": user.id,
                    "invitation_id": invitation.id,
                },
            )

        return Response({"detail": "Hesap aktive edildi."})


class InvitationRevokeView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        try:
            invitation = UserInvitation.objects.get(pk=pk)
        except UserInvitation.DoesNotExist:
            return Response({"detail": "Davet bulunamadı."}, status=status.HTTP_404_NOT_FOUND)

        if invitation.status != UserInvitation.Status.PENDING:
            return Response({"detail": "Sadece pending davet iptal edilebilir."}, status=status.HTTP_400_BAD_REQUEST)

        invitation.status = UserInvitation.Status.REVOKED
        invitation.revoked_at = timezone.now()
        invitation.save(update_fields=["status", "revoked_at", "updated_at"])

        create_audit_log(
            request=request,
            action=AuditLog.Action.UPDATE,
            entity_type="accounts.UserInvitation",
            entity_id=str(invitation.id),
            entity_repr=f"Invitation {invitation.id}",
            metadata={
                "operation": "user_invitation_revoke",
                "user_id": invitation.user_id,
                "invitation_id": invitation.id,
            },
        )

        return Response({"detail": "Davet iptal edildi."})
