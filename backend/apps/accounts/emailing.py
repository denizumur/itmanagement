import logging
from smtplib import SMTPAuthenticationError, SMTPException

from django.conf import settings
from django.core.mail import send_mail


logger = logging.getLogger(__name__)


def mask_email(email):
    if not email or "@" not in email:
        return ""

    local_part, domain = email.split("@", 1)
    if not local_part:
        return f"***@{domain}"

    visible = local_part[:1]
    return f"{visible}***@{domain}"


def invitation_email_enabled():
    return bool(getattr(settings, "INVITATION_EMAIL_ENABLED", False))


def classify_email_error(exc):
    if isinstance(exc, SMTPAuthenticationError):
        return "smtp_auth_failed"
    if isinstance(exc, TimeoutError):
        return "connection_timeout"
    if isinstance(exc, SMTPException):
        return "smtp_error"

    return "send_failed"


def build_invitation_email_body(*, user, activation_url):
    display_name = user.get_full_name() or user.username

    return (
        f"Merhaba {display_name},\n\n"
        "IT Envanter & Yönetim Platformu hesabınızı aktive etmeniz için "
        "davet edildiniz.\n\n"
        f"Aktivasyon linki:\n{activation_url}\n\n"
        "Bu link sürelidir ve yalnızca hesap aktivasyonu için kullanılmalıdır. "
        "Bu daveti beklemiyorsanız lütfen şirket IT/admin ekibiyle iletişime geçin.\n\n"
        "Bu e-postada şifre bulunmaz. Şifrenizi aktivasyon sayfasında siz belirlersiniz.\n"
    )


def send_invitation_email(*, user, invitation, activation_url, actor=None):
    recipient_email = (user.email or "").strip()
    masked_email = mask_email(recipient_email)

    if not invitation_email_enabled():
        return {
            "attempted": False,
            "status": "skipped",
            "reason": "email_disabled",
            "recipient_masked_email": masked_email,
        }

    if not recipient_email:
        return {
            "attempted": False,
            "status": "skipped",
            "reason": "missing_recipient_email",
            "recipient_masked_email": masked_email,
        }

    try:
        send_mail(
            subject="IT Envanter hesabınızı aktive edin",
            message=build_invitation_email_body(
                user=user,
                activation_url=activation_url,
            ),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
            recipient_list=[recipient_email],
            fail_silently=False,
        )
    except Exception as exc:  # pragma: no cover - exact SMTP classes vary by backend
        reason = classify_email_error(exc)
        logger.warning(
            "Invitation email delivery failed. invitation_id=%s user_id=%s actor_id=%s reason=%s",
            invitation.id,
            user.id,
            getattr(actor, "id", None),
            reason,
        )
        return {
            "attempted": True,
            "status": "failed",
            "reason": reason,
            "recipient_masked_email": masked_email,
        }

    return {
        "attempted": True,
        "status": "sent",
        "recipient_masked_email": masked_email,
    }
