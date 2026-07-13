from __future__ import annotations

import logging
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Iterable, Mapping
from uuid import UUID

from django.db import transaction
from django.db.models import Model

from apps.audit.models import AuditLog

logger = logging.getLogger(__name__)


SENSITIVE_FIELD_KEYWORDS = (
    "password",
    "token",
    "secret",
    "authorization",
    "credential",
    "api_key",
    "apikey",
    "private_key",
    "refresh",
    "access",
    "license_key",
)


def is_sensitive_field(field_name: str) -> bool:
    normalized = field_name.lower()

    return any(keyword in normalized for keyword in SENSITIVE_FIELD_KEYWORDS)


def normalize_json_value(value: Any) -> Any:
    if isinstance(value, Model):
        return str(value.pk)

    if isinstance(value, (datetime, date, time)):
        return value.isoformat()

    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, UUID):
        return str(value)

    if isinstance(value, Mapping):
        normalized_dict = {}

        for key, item in value.items():
            key_as_string = str(key)

            if is_sensitive_field(key_as_string):
                normalized_dict[key_as_string] = "***REDACTED***"
            else:
                normalized_dict[key_as_string] = normalize_json_value(item)

        return normalized_dict

    if isinstance(value, (list, tuple, set)):
        return [normalize_json_value(item) for item in value]

    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    return str(value)


def serialize_instance(
    instance: Model | None,
    *,
    fields: Iterable[str] | None = None,
    exclude: Iterable[str] | None = None,
) -> dict[str, Any]:
    if instance is None:
        return {}

    include_fields = set(fields) if fields else None
    exclude_fields = set(exclude or [])

    data: dict[str, Any] = {}

    for field in instance._meta.concrete_fields:
        field_name = field.name
        value_attribute = field.attname

        if include_fields and (
            field_name not in include_fields and value_attribute not in include_fields
        ):
            continue
        
        if field_name in exclude_fields or value_attribute in exclude_fields:
            continue

        if is_sensitive_field(field_name) or is_sensitive_field(value_attribute):
            data[field_name] = "***REDACTED***"
            continue

        value = getattr(instance, value_attribute, None)
        data[field_name] = normalize_json_value(value)

    return data


def calculate_changes(
    before: Mapping[str, Any] | None,
    after: Mapping[str, Any] | None,
) -> dict[str, dict[str, Any]]:
    before_data = normalize_json_value(before or {})
    after_data = normalize_json_value(after or {})

    if not isinstance(before_data, Mapping) or not isinstance(after_data, Mapping):
        return {}

    changes: dict[str, dict[str, Any]] = {}

    keys = set(before_data.keys()) | set(after_data.keys())

    for key in sorted(keys):
        before_value = before_data.get(key)
        after_value = after_data.get(key)

        if before_value == after_value:
            continue

        if is_sensitive_field(str(key)):
            changes[str(key)] = {
                "before": "***REDACTED***",
                "after": "***REDACTED***",
            }
        else:
            changes[str(key)] = {
                "before": before_value,
                "after": after_value,
            }

    return changes


def get_entity_type(instance: Model | None) -> str:
    if instance is None:
        return ""

    return f"{instance._meta.app_label}.{instance.__class__.__name__}"


def get_entity_id(instance: Model | None) -> str:
    if instance is None or instance.pk is None:
        return ""

    return str(instance.pk)


def get_entity_repr(instance: Model | None) -> str:
    if instance is None:
        return ""

    return str(instance)[:255]


def get_request_actor(request: Any):
    if request is None:
        return None

    user = getattr(request, "user", None)

    if user is not None and getattr(user, "is_authenticated", False):
        return user

    return None


def get_django_request(request: Any):
    if request is None:
        return None

    return getattr(request, "_request", request)


def get_request_method(request: Any) -> str:
    django_request = get_django_request(request)

    if django_request is None:
        return ""

    return str(getattr(django_request, "method", "") or "")[:16]


def get_request_path(request: Any) -> str:
    django_request = get_django_request(request)

    if django_request is None:
        return ""

    get_full_path = getattr(django_request, "get_full_path", None)

    if callable(get_full_path):
        return str(get_full_path())[:512]

    return str(getattr(django_request, "path", "") or "")[:512]


def get_request_meta(request: Any) -> dict[str, Any]:
    django_request = get_django_request(request)

    if django_request is None:
        return {}

    return getattr(django_request, "META", {}) or {}


def get_client_ip(request: Any) -> str | None:
    meta = get_request_meta(request)

    forwarded_for = meta.get("HTTP_X_FORWARDED_FOR")

    if forwarded_for:
        return str(forwarded_for).split(",")[0].strip() or None

    remote_addr = meta.get("REMOTE_ADDR")

    if remote_addr:
        return str(remote_addr).strip() or None

    return None


def get_user_agent(request: Any) -> str:
    meta = get_request_meta(request)

    return str(meta.get("HTTP_USER_AGENT", "") or "")


def create_audit_log(
    *,
    request: Any = None,
    action: str = AuditLog.Action.OTHER,
    instance: Model | None = None,
    before: Mapping[str, Any] | None = None,
    after: Mapping[str, Any] | None = None,
    changes: Mapping[str, Any] | None = None,
    metadata: Mapping[str, Any] | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    entity_repr: str | None = None,
    skip_if_no_changes: bool = False,
) -> AuditLog | None:
    
    before_data = normalize_json_value(before or {})

    if after is None and instance is not None:
        after_data = serialize_instance(instance)
    else:
        after_data = normalize_json_value(after or {})

    if changes is None:
        changes_data = calculate_changes(before_data, after_data)
    else:
        changes_data = normalize_json_value(changes)

    if skip_if_no_changes and not changes_data:
        return None
    created_log: AuditLog | None = None

    def write_log():
        nonlocal created_log

        try:
            created_log = AuditLog.objects.create(
                actor=get_request_actor(request),
                action=action,
                entity_type=entity_type or get_entity_type(instance),
                entity_id=str(entity_id or get_entity_id(instance)),
                entity_repr=str(entity_repr or get_entity_repr(instance))[:255],
                before=before_data,
                after=after_data,
                changes=changes_data,
                request_method=get_request_method(request),
                request_path=get_request_path(request),
                ip_address=get_client_ip(request),
                user_agent=get_user_agent(request),
                metadata=normalize_json_value(metadata or {}),
            )
        except Exception:
            logger.exception(
                "Audit log creation failed. action=%s entity_type=%s entity_id=%s",
                action,
                entity_type or get_entity_type(instance),
                entity_id or get_entity_id(instance),
            )

    transaction.on_commit(write_log)

    return created_log