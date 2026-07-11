from rest_framework import serializers

from apps.employees.models import Employee


class EmployeeListSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="full_name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    job_title_name = serializers.CharField(source="job_title.name", read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "full_name",
            "name",
            "email",
            "department",
            "department_name",
            "job_title",
            "job_title_name",
            "is_active",
        ]