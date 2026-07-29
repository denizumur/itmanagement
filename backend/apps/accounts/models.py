from django.conf import settings
from django.db import models
from django.utils import timezone


class UserProfile(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        TECHNICIAN = "technician", "Technician"
        VIEWER = "viewer", "Viewer"
        APPROVER = "approver", "Approver"
        REQUESTER = "requester", "Requester"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.TECHNICIAN,
    )
    phone = models.CharField(max_length=30, blank=True)
    department = models.CharField(max_length=120, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Kullanıcı Profili"
        verbose_name_plural = "Kullanıcı Profilleri"

    def __str__(self):
        return f"{self.user.username} - {self.role}"


class UserInvitation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REVOKED = "revoked", "Revoked"
        EXPIRED = "expired", "Expired"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    token_hash = models.CharField(max_length=128, unique=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_invitations",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["user", "status"],
                name="accounts_i_user_id_875b2f_idx",
            ),
            models.Index(
                fields=["status", "expires_at"],
                name="accounts_i_status_ae0eb5_idx",
            ),
        ]

    def mark_expired_if_needed(self):
        if self.status == self.Status.PENDING and self.expires_at <= timezone.now():
            self.status = self.Status.EXPIRED
            self.save(update_fields=["status", "updated_at"])
            return True

        return False
