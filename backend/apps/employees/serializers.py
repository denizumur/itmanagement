from rest_framework import serializers

from apps.employees.models import Employee


class EmployeeListSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="full_name", read_only=True)

    username = serializers.CharField(source="user.username", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)

    department_name = serializers.CharField(source="department.name", read_only=True)
    job_title_name = serializers.CharField(source="job_title.name", read_only=True)

    manager_name = serializers.CharField(source="manager.full_name", read_only=True)
    manager_email = serializers.EmailField(source="manager.email", read_only=True)

    sync_source_label = serializers.CharField(
        source="get_sync_source_display",
        read_only=True,
    )

    class Meta:
        model = Employee
        fields = [
            "id",
            "user",
            "username",
            "user_email",
            "full_name",
            "name",
            "email",
            "phone",
            "department",
            "department_name",
            "job_title",
            "job_title_name",
            "manager",
            "manager_name",
            "manager_email",
            "external_hr_id",
            "sync_source",
            "sync_source_label",
            "is_active",
        ]