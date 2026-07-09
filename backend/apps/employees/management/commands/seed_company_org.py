from django.core.management.base import BaseCommand

from apps.employees.models import Department, JobTitle


DEPARTMENTS = [
    "GENEL MÜDÜRLÜK",
    "İDARİ VE MALİ İŞLER MÜDÜRLÜĞÜ",
    "İŞLETMELER MÜDÜRLÜĞÜ",
    "REKLAM VE PAZARLAMA MÜDÜRLÜĞÜ",
    "ÇALIŞANLAR",
]


JOB_TITLES = [
    "GENEL MÜDÜR",
    "İDARİ VE MALİ İŞLER MÜDÜRÜ",
    "İŞLETMELER MÜDÜRÜ",
    "REKLAM VE PAZARLAMA MÜDÜRÜ",
    "REKLAM ALANLARI ŞEFİ",
    "PAZARLAMA ŞEFİ",
    "BİLGİ İŞLEM",
    "İNSAN KAYNAKLARI PERSONELİ",
    "MUHASEBE PERSONELİ",
    "SATIN ALMA PERSONELİ",
    "İŞLETMELER MÜDÜRLÜĞÜ PERSONELİ",
    "MAĞAZA SATIŞ PERSONELİ",
    "BÜRO PERSONELİ",
    "GRAFİKER",
    "YÖNETİCİ ASİSTANI",
    "TEMİZLİK PERSONELİ",
    "ÇAYCI",
    "ÇALIŞAN",
]


class Command(BaseCommand):
    help = "Şirket departman ve meslek/görev başlangıç verilerini oluşturur."

    def handle(self, *args, **options):
        department_created_count = 0
        job_title_created_count = 0

        for index, name in enumerate(DEPARTMENTS, start=1):
            _, created = Department.objects.get_or_create(
                name=name,
                defaults={
                    "display_order": index,
                    "is_active": True,
                },
            )

            if created:
                department_created_count += 1

        for index, name in enumerate(JOB_TITLES, start=1):
            _, created = JobTitle.objects.get_or_create(
                name=name,
                defaults={
                    "display_order": index,
                    "is_active": True,
                },
            )

            if created:
                job_title_created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed tamamlandı. "
                f"Oluşturulan departman: {department_created_count}, "
                f"oluşturulan görev: {job_title_created_count}"
            )
        )