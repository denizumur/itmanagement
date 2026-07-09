from django.core.management.base import BaseCommand

from apps.employees.models import Department, Employee, JobTitle


DEMO_EMPLOYEES = [
    {
        "full_name": "DEMO - Ahmet Yılmaz",
        "employee_code": "DEMO-PER-001",
        "department": "GENEL MÜDÜRLÜK",
        "job_title": "GENEL MÜDÜR",
        "email": "ahmet.yilmaz.demo@example.com",
    },
    {
        "full_name": "DEMO - Ayşe Demir",
        "employee_code": "DEMO-PER-002",
        "department": "İDARİ VE MALİ İŞLER MÜDÜRLÜĞÜ",
        "job_title": "MUHASEBE PERSONELİ",
        "email": "ayse.demir.demo@example.com",
    },
    {
        "full_name": "DEMO - Mehmet Kaya",
        "employee_code": "DEMO-PER-003",
        "department": "REKLAM VE PAZARLAMA MÜDÜRLÜĞÜ",
        "job_title": "GRAFİKER",
        "email": "mehmet.kaya.demo@example.com",
    },
    {
        "full_name": "DEMO - Zeynep Arslan",
        "employee_code": "DEMO-PER-004",
        "department": "İŞLETMELER MÜDÜRLÜĞÜ",
        "job_title": "MAĞAZA SATIŞ PERSONELİ",
        "email": "zeynep.arslan.demo@example.com",
    },
    {
        "full_name": "DEMO - Burak Çelik",
        "employee_code": "DEMO-PER-005",
        "department": "İDARİ VE MALİ İŞLER MÜDÜRLÜĞÜ",
        "job_title": "BİLGİ İŞLEM",
        "email": "burak.celik.demo@example.com",
    },
]


class Command(BaseCommand):
    help = "Demo personel kayıtlarını oluşturur."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for item in DEMO_EMPLOYEES:
            department = Department.objects.get(name=item["department"])
            job_title = JobTitle.objects.get(name=item["job_title"])

            _, created = Employee.objects.update_or_create(
                employee_code=item["employee_code"],
                defaults={
                    "full_name": item["full_name"],
                    "department": department,
                    "job_title": job_title,
                    "email": item["email"],
                    "is_active": True,
                    "imported_from_excel": False,
                    "notes": "Demo personel kaydıdır.",
                },
            )

            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo personel seed tamamlandı. "
                f"Oluşturulan: {created_count}, Güncellenen: {updated_count}"
            )
        )