from rest_framework import serializers

from apps.assignments.models import Assignment


class AssignmentSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    asset_inventory_code = serializers.CharField(
        source="asset.inventory_code",
        read_only=True,
    )
    asset_serial_number = serializers.CharField(
        source="asset.serial_number",
        read_only=True,
    )
    asset_status = serializers.CharField(source="asset.status", read_only=True)

    employee_full_name = serializers.CharField(
        source="employee.full_name",
        read_only=True,
    )
    employee_department = serializers.CharField(
        source="employee.department.name",
        read_only=True,
    )
    employee_job_title = serializers.CharField(
        source="employee.job_title.name",
        read_only=True,
    )

    assigned_by_username = serializers.CharField(
        source="assigned_by.username",
        read_only=True,
    )
    returned_by_username = serializers.CharField(
        source="returned_by.username",
        read_only=True,
    )

    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "asset",
            "asset_name",
            "asset_inventory_code",
            "asset_serial_number",
            "asset_status",
            "employee",
            "employee_full_name",
            "employee_department",
            "employee_job_title",
            "assigned_at",
            "returned_at",
            "is_active",
            "assigned_by",
            "assigned_by_username",
            "returned_by",
            "returned_by_username",
            "notes",
            "return_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "returned_at",
            "assigned_by",
            "assigned_by_username",
            "returned_by",
            "returned_by_username",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        if self.instance:
            if "asset" in attrs:
                raise serializers.ValidationError(
                    {"asset": "Zimmet oluşturulduktan sonra varlık değiştirilemez."}
                )

            if "employee" in attrs:
                raise serializers.ValidationError(
                    {"employee": "Zimmet oluşturulduktan sonra personel değiştirilemez."}
                )

            return attrs

        asset = attrs.get("asset")
        employee = attrs.get("employee")

        if asset and asset.is_deleted:
            raise serializers.ValidationError(
                {"asset": "Silinmiş varlık zimmetlenemez."}
            )

        if employee and not employee.is_active:
            raise serializers.ValidationError(
                {"employee": "Pasif personele zimmet yapılamaz."}
            )

        if asset:
            active_exists = Assignment.objects.filter(
                asset=asset,
                returned_at__isnull=True,
            ).exists()

            if active_exists:
                raise serializers.ValidationError(
                    {"asset": "Bu varlık zaten aktif olarak zimmetli."}
                )

        return attrs