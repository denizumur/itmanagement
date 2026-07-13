from rest_framework import serializers

from apps.licensing.models import LicenseSubscription

def has_masking_character(value):
    return any(marker in value for marker in ["*", "X", "x", "•"])

class LicenseSubscriptionSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source="get_type_display", read_only=True)
    billing_cycle_label = serializers.CharField(
        source="get_billing_cycle_display",
        read_only=True,
    )

    assigned_asset_name = serializers.CharField(
        source="assigned_asset.name",
        read_only=True,
        allow_null=True,
    )
    assigned_asset_inventory_code = serializers.CharField(
        source="assigned_asset.inventory_code",
        read_only=True,
        allow_null=True,
    )

    is_expired = serializers.BooleanField(read_only=True)
    days_until_end = serializers.IntegerField(read_only=True, allow_null=True)
    is_expiring_soon_30_days = serializers.BooleanField(read_only=True)

    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
        allow_null=True,
    )
    updated_by_username = serializers.CharField(
        source="updated_by.username",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = LicenseSubscription
        fields = [
            "id",
            "name",
            "tracking_code",
            "type",
            "type_label",
            "vendor",
            "license_key_masked",
            "seat_count",
            "assigned_asset",
            "assigned_asset_name",
            "assigned_asset_inventory_code",
            "start_date",
            "end_date",
            "renewal_cost",
            "billing_cycle",
            "billing_cycle_label",
            "auto_renew",
            "is_active",
            "is_expired",
            "days_until_end",
            "is_expiring_soon_30_days",
            "notes",
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
            "created_at",
            "updated_at",
            "is_deleted",
            "deleted_at",
        ]
        read_only_fields = [
            "id",
            "is_expired",
            "days_until_end",
            "is_expiring_soon_30_days",
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
            "created_at",
            "updated_at",
            "is_deleted",
            "deleted_at",
        ]

    def validate_assigned_asset(self, value):
        if value and value.is_deleted:
            raise serializers.ValidationError(
                "Silinmiş varlığa lisans/abonelik bağlanamaz."
            )

        return value

    def validate_license_key_masked(self, value):
        if value and not has_masking_character(value):
            raise serializers.ValidationError(
                "Tam lisans anahtarı saklama. Maskeli format kullan: XXXX-XXXX-1234."
            )

        return value

    def validate(self, attrs):
        start_date = attrs.get(
            "start_date",
            getattr(self.instance, "start_date", None),
        )
        end_date = attrs.get(
            "end_date",
            getattr(self.instance, "end_date", None),
        )

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "Bitiş tarihi başlangıç tarihinden önce olamaz."}
            )

        return attrs