from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import UserProfile


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        role = None
        if hasattr(user, "profile"):
            role = user.profile.role

        token["username"] = user.username
        token["email"] = user.email
        token["role"] = role

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user

        role = None
        if hasattr(user, "profile"):
            role = user.profile.role

        data["user"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_superuser": user.is_superuser,
            "role": role,
        }

        return data


class CurrentUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True)
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    is_superuser = serializers.BooleanField()
    role = serializers.SerializerMethodField()

    def get_role(self, user):
        if hasattr(user, "profile"):
            return user.profile.role

        return None


class InvitationCreateSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()


class InvitationAcceptSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Şifre tekrarı eşleşmiyor."},
            )

        return attrs
