from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("employees", "0002_employee_external_hr_id_employee_manager_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmployeeImportJob",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("import_id", models.CharField(db_index=True, max_length=100, unique=True)),
                ("file_name", models.CharField(max_length=255)),
                ("file_format", models.CharField(max_length=10)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("dry_run", "Dry-run"),
                            ("committed", "Committed"),
                            ("failed", "Failed"),
                            ("expired", "Expired"),
                        ],
                        db_index=True,
                        default="dry_run",
                        max_length=20,
                    ),
                ),
                ("mode", models.CharField(default="create_only", max_length=30)),
                ("total_rows", models.PositiveIntegerField(default=0)),
                ("valid_rows", models.PositiveIntegerField(default=0)),
                ("error_rows", models.PositiveIntegerField(default=0)),
                ("warning_rows", models.PositiveIntegerField(default=0)),
                ("created_count", models.PositiveIntegerField(default=0)),
                ("skipped_count", models.PositiveIntegerField(default=0)),
                ("created_department_count", models.PositiveIntegerField(default=0)),
                ("created_job_title_count", models.PositiveIntegerField(default=0)),
                ("created_user_count", models.PositiveIntegerField(default=0)),
                ("linked_user_count", models.PositiveIntegerField(default=0)),
                ("file_size", models.PositiveIntegerField(default=0)),
                ("unknown_headers", models.JSONField(blank=True, default=list)),
                ("summary", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("committed_at", models.DateTimeField(blank=True, null=True)),
                ("expires_at", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="employee_import_jobs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="employeeimportjob",
            index=models.Index(fields=["status", "created_at"], name="employees_e_status_f8cdf9_idx"),
        ),
        migrations.AddIndex(
            model_name="employeeimportjob",
            index=models.Index(fields=["actor", "created_at"], name="employees_e_actor_i_d59db1_idx"),
        ),
    ]
