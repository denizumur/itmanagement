from django.test import TestCase

from apps.audit.models import AuditLog
from apps.audit.services import (
    calculate_changes,
    create_audit_log,
    normalize_json_value,
    serialize_instance,
)
from apps.licensing.models import LicenseSubscription


class AuditRedactionTests(TestCase):
    def test_normalize_json_value_redacts_sensitive_nested_fields(self):
        payload = {
            "name": "Microsoft 365",
            "license_key": "FULL-LICENSE-KEY-SHOULD-NOT-BE-STORED",
            "license_key_masked": "XXXX-XXXX-1234",
            "refresh_token": "refresh-token-value",
            "nested": {
                "api_key": "api-key-value",
                "safe_note": "Bu alan görünür kalabilir.",
            },
            "safe_field": "Güvenli değer",
        }

        normalized = normalize_json_value(payload)

        self.assertEqual(normalized["name"], "Microsoft 365")
        self.assertEqual(normalized["safe_field"], "Güvenli değer")
        self.assertEqual(normalized["nested"]["safe_note"], "Bu alan görünür kalabilir.")

        self.assertEqual(normalized["license_key"], "***REDACTED***")
        self.assertEqual(normalized["license_key_masked"], "***REDACTED***")
        self.assertEqual(normalized["refresh_token"], "***REDACTED***")
        self.assertEqual(normalized["nested"]["api_key"], "***REDACTED***")

    def test_calculate_changes_redacts_sensitive_fields(self):
        before = {
            "name": "Eski Lisans",
            "license_key_masked": "XXXX-XXXX-1111",
            "notes": "Eski not",
        }
        after = {
            "name": "Yeni Lisans",
            "license_key_masked": "XXXX-XXXX-2222",
            "notes": "Yeni not",
        }

        changes = calculate_changes(before, after)

        self.assertEqual(
            changes["license_key_masked"],
            {
                "before": "***REDACTED***",
                "after": "***REDACTED***",
            },
        )
        self.assertEqual(
            changes["name"],
            {
                "before": "Eski Lisans",
                "after": "Yeni Lisans",
            },
        )
        self.assertEqual(
            changes["notes"],
            {
                "before": "Eski not",
                "after": "Yeni not",
            },
        )

    def test_create_audit_log_persists_redacted_sensitive_values(self):
        subscription = LicenseSubscription.objects.create(
            name="QA Audit Redaction License",
            tracking_code="QA-AUDIT-RED-001",
            type=LicenseSubscription.Type.LICENSE,
            vendor="QA Vendor",
            license_key_masked="XXXX-XXXX-1234",
            seat_count=1,
            notes="Audit redaction test",
        )

        serialized = serialize_instance(subscription)

        self.assertEqual(serialized["license_key_masked"], "***REDACTED***")

        before = {
            "name": "QA Audit Redaction License",
            "license_key_masked": "XXXX-XXXX-1234",
            "notes": "Eski audit notu",
        }
        after = {
            "name": "QA Audit Redaction License Updated",
            "license_key_masked": "XXXX-XXXX-9876",
            "notes": "Yeni audit notu",
        }

        with self.captureOnCommitCallbacks(execute=True):
            create_audit_log(
                action=AuditLog.Action.UPDATE,
                instance=subscription,
                before=before,
                after=after,
                metadata={
                    "module": "audit",
                    "operation": "redaction_test",
                    "api_key": "metadata-api-key-should-not-leak",
                },
            )

        log = AuditLog.objects.get(
            entity_type="licensing.LicenseSubscription",
            entity_id=str(subscription.id),
            action=AuditLog.Action.UPDATE,
        )

        self.assertEqual(log.before["license_key_masked"], "***REDACTED***")
        self.assertEqual(log.after["license_key_masked"], "***REDACTED***")
        self.assertEqual(
            log.changes["license_key_masked"],
            {
                "before": "***REDACTED***",
                "after": "***REDACTED***",
            },
        )
        self.assertEqual(log.metadata["api_key"], "***REDACTED***")
        self.assertEqual(log.metadata["operation"], "redaction_test")
        self.assertEqual(log.after["notes"], "Yeni audit notu")