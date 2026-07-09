from rest_framework import serializers

from apps.inventory.models import Asset, AssetCategory


class AssetCategorySerializer(serializers.ModelSerializer):
    asset_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = AssetCategory
        fields = [
            "id",
            "name",
            "description",
            "custom_fields_schema",
            "is_active",
            "display_order",
            "asset_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "asset_count",
            "created_at",
            "updated_at",
        ]


class AssetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name",
        read_only=True,
    )
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    display_identifier = serializers.CharField(read_only=True)
    is_warranty_expired = serializers.BooleanField(read_only=True)
    is_maintenance_overdue = serializers.BooleanField(read_only=True)

    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )
    updated_by_username = serializers.CharField(
        source="updated_by.username",
        read_only=True,
    )

    class Meta:
        model = Asset
        fields = [
            "id",
            "category",
            "category_name",
            "name",
            "brand",
            "model",
            "serial_number",
            "inventory_code",
            "display_identifier",
            "status",
            "status_label",
            "location",
            "ip_address",
            "mac_address",
            "purchase_date",
            "purchase_price",
            "vendor_name",
            "warranty_end_date",
            "is_warranty_expired",
            "maintenance_enabled",
            "maintenance_frequency_days",
            "next_maintenance_due_date",
            "is_maintenance_overdue",
            "custom_fields",
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
            "display_identifier",
            "is_warranty_expired",
            "is_maintenance_overdue",
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
            "created_at",
            "updated_at",
            "is_deleted",
            "deleted_at",
        ]

    def validate_category(self, value):
        if not value.is_active:
            raise serializers.ValidationError(
                "Pasif kategoriye varlık eklenemez."
            )

        return value

    def validate(self, attrs):
        maintenance_enabled = attrs.get(
            "maintenance_enabled",
            getattr(self.instance, "maintenance_enabled", False),
        )
        maintenance_frequency_days = attrs.get(
            "maintenance_frequency_days",
            getattr(self.instance, "maintenance_frequency_days", None),
        )

        if maintenance_enabled and not maintenance_frequency_days:
            raise serializers.ValidationError(
                {
                    "maintenance_frequency_days": (
                        "Bakım takibi aktifse bakım sıklığı girilmelidir."
                    )
                }
            )

        purchase_date = attrs.get(
            "purchase_date",
            getattr(self.instance, "purchase_date", None),
        )
        warranty_end_date = attrs.get(
            "warranty_end_date",
            getattr(self.instance, "warranty_end_date", None),
        )

        if purchase_date and warranty_end_date and warranty_end_date < purchase_date:
            raise serializers.ValidationError(
                {
                    "warranty_end_date": (
                        "Garanti bitiş tarihi satın alma tarihinden önce olamaz."
                    )
                }
            )

        return attrs