from rest_framework import serializers

from apps.inventory.models import Asset
from apps.maintenance.models import MaintenanceRecord


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    asset_inventory_code = serializers.CharField(
        source="asset.inventory_code",
        read_only=True,
    )
    asset_serial_number = serializers.CharField(
        source="asset.serial_number",
        read_only=True,
    )
    asset_category_name = serializers.CharField(
        source="asset.category.name",
        read_only=True,
    )

    type_label = serializers.CharField(
        source="get_type_display",
        read_only=True,
    )

    is_overdue = serializers.BooleanField(read_only=True)

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
        model = MaintenanceRecord
        fields = [
            "id",
            "asset",
            "asset_name",
            "asset_inventory_code",
            "asset_serial_number",
            "asset_category_name",
            "type",
            "type_label",
            "performed_at",
            "next_due_date",
            "frequency_days",
            "cost",
            "performed_by",
            "description",
            "asset_status_before",
            "asset_status_after",
            "is_overdue",
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "asset_status_before",
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
            "created_at",
            "updated_at",
            "is_overdue",
        ]

    def validate_asset(self, value):
        if value.is_deleted:
            raise serializers.ValidationError(
                "Silinmiş varlığa bakım kaydı girilemez."
            )

        return value

    def validate(self, attrs):
        record_type = attrs.get(
            "type",
            getattr(self.instance, "type", MaintenanceRecord.Type.MAINTENANCE),
        )
        performed_at = attrs.get(
            "performed_at",
            getattr(self.instance, "performed_at", None),
        )
        next_due_date = attrs.get(
            "next_due_date",
            getattr(self.instance, "next_due_date", None),
        )
        frequency_days = attrs.get(
            "frequency_days",
            getattr(self.instance, "frequency_days", None),
        )
        asset_status_after = attrs.get(
            "asset_status_after",
            getattr(self.instance, "asset_status_after", ""),
        )

        if next_due_date and performed_at and next_due_date < performed_at:
            raise serializers.ValidationError(
                {
                    "next_due_date": (
                        "Sonraki bakım tarihi işlem tarihinden önce olamaz."
                    )
                }
            )

        if record_type == MaintenanceRecord.Type.DISPOSAL:
            if next_due_date:
                raise serializers.ValidationError(
                    {
                        "next_due_date": (
                            "İmha kaydı için sonraki bakım tarihi girilemez."
                        )
                    }
                )

            if frequency_days:
                raise serializers.ValidationError(
                    {
                        "frequency_days": (
                            "İmha kaydı için bakım sıklığı girilemez."
                        )
                    }
                )

        if asset_status_after:
            valid_statuses = [choice[0] for choice in Asset.Status.choices]

            if asset_status_after not in valid_statuses:
                raise serializers.ValidationError(
                    {"asset_status_after": "Geçersiz varlık durumu."}
                )

        return attrs