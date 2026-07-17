from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from apps.accounts.models import UserProfile
from apps.assignments.models import Assignment
from apps.employees.models import Employee
from apps.inventory.models import Asset, AssetCategory
from apps.tickets.models import (
    TICKET_ATTACHMENT_MAX_FILES_PER_TICKET,
    Ticket,
    TicketApproval,
    TicketAttachment,
    TicketComment,
)

User = get_user_model()


class TicketApiTests(APITestCase):
    def create_user_with_role(self, username, role):
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="StrongPass123!",
        )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.save(update_fields=["role"])

        return User.objects.get(pk=user.pk)

    def setUp(self):
        self.requester = self.create_user_with_role(
            "requester-user",
            UserProfile.Role.REQUESTER,
        )
        self.technician = self.create_user_with_role(
            "technician-user",
            UserProfile.Role.TECHNICIAN,
        )
        self.viewer = self.create_user_with_role(
            "viewer-user",
            UserProfile.Role.VIEWER,
        )
        self.approver = self.create_user_with_role(
            "approver-user",
            UserProfile.Role.APPROVER,
        )
        self.admin = self.create_user_with_role(
            "admin-user",
            UserProfile.Role.ADMIN,
        )

        self.approver_employee = Employee.objects.create(
            user=self.approver,
            full_name="Approver Manager",
            email="approver@example.com",
            is_active=True,
        )

        self.employee = Employee.objects.create(
            user=self.requester,
            full_name="Requester Personel",
            email="requester@example.com",
            is_active=True,
        )

        self.asset_category = AssetCategory.objects.create(name="Laptop")

    def create_asset(self, name="Demo Laptop", inventory_code="IT-LPT-001"):
        return Asset.objects.create(
            category=self.asset_category,
            name=name,
            inventory_code=inventory_code,
            serial_number=f"SN-{inventory_code}",
            status=Asset.Status.ACTIVE,
        )

    def create_png_file(self, name="screen.png", content=b"fake-png-content"):
        return SimpleUploadedFile(
            name,
            content,
            content_type="image/png",
        )

    def create_pdf_file(self, name="document.pdf", content=b"%PDF-1.4 fake"):
        return SimpleUploadedFile(
            name,
            content,
            content_type="application/pdf",
        )

    def test_requester_can_create_ticket_for_own_employee_profile_without_manager(self):
        self.client.force_authenticate(user=self.requester)

        response = self.client.post(
            "/api/tickets/",
            {
                "title": "Laptop açılmıyor",
                "description": "Laptop sabah açılmadı, güç ışığı yanmıyor.",
                "category": Ticket.Category.HARDWARE,
                "priority": Ticket.Priority.NORMAL,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Ticket.objects.count(), 1)

        ticket = Ticket.objects.get()

        self.assertEqual(ticket.employee, self.employee)
        self.assertEqual(ticket.created_by, self.requester)
        self.assertEqual(ticket.status, Ticket.Status.OPEN)
        self.assertEqual(
            ticket.approval_status,
            Ticket.ApprovalStatus.NOT_REQUIRED,
        )
        self.assertIsNone(ticket.assigned_to)
        self.assertEqual(TicketApproval.objects.count(), 0)

    def test_requester_without_employee_mapping_gets_400_when_creating_ticket(self):
        requester_without_employee = self.create_user_with_role(
            "requester-without-employee",
            UserProfile.Role.REQUESTER,
        )

        self.client.force_authenticate(user=requester_without_employee)

        response = self.client.post(
            "/api/tickets/",
            {
                "title": "VPN sorunu",
                "description": "VPN bağlantısı kurulamıyor, hata alıyorum.",
                "category": Ticket.Category.ACCESS,
                "priority": Ticket.Priority.HIGH,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Ticket.objects.count(), 0)
        self.assertIn("employee", response.data)

    def test_requester_cannot_view_it_ticket_queue(self):
        Ticket.objects.create(
            employee=self.employee,
            title="Mouse çalışmıyor",
            description="Mouse tıklamaları bazen algılanmıyor.",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.get("/api/tickets/queue/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_technician_can_view_queue_and_update_ticket_status(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Yazıcı problemi",
            description="Departman yazıcısından çıktı alınamıyor.",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.HIGH,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        queue_response = self.client.get("/api/tickets/queue/")

        self.assertEqual(queue_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(queue_response.data), 1)
        self.assertEqual(queue_response.data[0]["id"], ticket.id)

        status_response = self.client.post(
            f"/api/tickets/{ticket.id}/status/",
            {
                "status": Ticket.Status.IN_PROGRESS,
            },
            format="json",
        )

        self.assertEqual(status_response.status_code, status.HTTP_200_OK)

        ticket.refresh_from_db()

        self.assertEqual(ticket.status, Ticket.Status.IN_PROGRESS)

    def test_requester_cannot_see_internal_comments(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="E-posta erişimi",
            description="Kurumsal e-posta hesabıma erişemiyorum.",
            category=Ticket.Category.ACCESS,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )

        public_comment = TicketComment.objects.create(
            ticket=ticket,
            author=self.technician,
            body="Talebin alındı, kontrol ediyoruz.",
            is_internal=False,
        )
        TicketComment.objects.create(
            ticket=ticket,
            author=self.technician,
            body="IT iç notu: önce hesap kilidini kontrol et.",
            is_internal=True,
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.get(f"/api/tickets/{ticket.id}/comments/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], public_comment.id)
        self.assertFalse(response.data[0]["is_internal"])

    def test_requester_internal_comment_payload_is_forced_to_public(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="E-posta şifre sorunu",
            description="E-posta şifremi sıfırlamam gerekiyor.",
            category=Ticket.Category.ACCESS,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/comments/",
            {
                "body": "Kullanıcı olarak ek yorum yazıyorum.",
                "is_internal": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["is_internal"])

        comment = TicketComment.objects.get(id=response.data["id"])

        self.assertFalse(comment.is_internal)

    def test_technician_can_create_internal_comment(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="VPN erişim sorunu",
            description="VPN bağlantısı sık sık kopuyor.",
            category=Ticket.Category.NETWORK,
            priority=Ticket.Priority.HIGH,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/comments/",
            {
                "body": "İç not: logları kontrol et.",
                "is_internal": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["is_internal"])

    def test_empty_ticket_comment_returns_400(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Boş yorum testi",
            description="Boş yorum gönderimi engellenmeli.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/comments/",
            {
                "body": "   ",
                "is_internal": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("body", response.data)

    def test_ticket_with_approver_manager_requires_approval_and_stays_out_of_it_queue(self):
        self.employee.manager = self.approver_employee
        self.employee.save(update_fields=["manager"])

        self.client.force_authenticate(user=self.requester)

        create_response = self.client.post(
            "/api/tickets/",
            {
                "title": "Yeni muhasebe yazılımı erişimi",
                "description": "Muhasebe raporları için yeni yazılım erişimine ihtiyacım var.",
                "category": Ticket.Category.ACCESS,
                "priority": Ticket.Priority.HIGH,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        ticket = Ticket.objects.get()

        self.assertEqual(ticket.approval_status, Ticket.ApprovalStatus.PENDING)
        self.assertEqual(ticket.status, Ticket.Status.OPEN)

        approval = TicketApproval.objects.get(ticket=ticket)

        self.assertEqual(approval.status, TicketApproval.Status.PENDING)
        self.assertEqual(approval.approver, self.approver_employee)
        self.assertEqual(approval.approver_user, self.approver)

        self.client.force_authenticate(user=self.technician)

        queue_response = self.client.get("/api/tickets/queue/")

        self.assertEqual(queue_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(queue_response.data), 0)

        self.client.force_authenticate(user=self.approver)

        approvals_response = self.client.get("/api/tickets/approvals/")

        self.assertEqual(approvals_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(approvals_response.data), 1)
        self.assertEqual(approvals_response.data[0]["ticket"]["id"], ticket.id)

    def test_approver_can_approve_ticket_and_then_it_queue_can_see_it(self):
        self.employee.manager = self.approver_employee
        self.employee.save(update_fields=["manager"])

        self.client.force_authenticate(user=self.requester)

        create_response = self.client.post(
            "/api/tickets/",
            {
                "title": "ERP erişim talebi",
                "description": "ERP muhasebe modülüne erişim talep ediyorum.",
                "category": Ticket.Category.ACCESS,
                "priority": Ticket.Priority.NORMAL,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        ticket = Ticket.objects.get()

        self.client.force_authenticate(user=self.approver)

        approve_response = self.client.post(
            f"/api/tickets/{ticket.id}/approve/",
            {
                "decision_note": "Departman ihtiyacı uygun görüldü.",
            },
            format="json",
        )

        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)

        ticket.refresh_from_db()
        approval = TicketApproval.objects.get(ticket=ticket)

        self.assertEqual(ticket.approval_status, Ticket.ApprovalStatus.APPROVED)
        self.assertEqual(ticket.status, Ticket.Status.OPEN)
        self.assertEqual(approval.status, TicketApproval.Status.APPROVED)
        self.assertEqual(
            approval.decision_note,
            "Departman ihtiyacı uygun görüldü.",
        )
        self.assertIsNotNone(approval.decided_at)

        self.client.force_authenticate(user=self.technician)

        queue_response = self.client.get("/api/tickets/queue/")

        self.assertEqual(queue_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(queue_response.data), 1)
        self.assertEqual(queue_response.data[0]["id"], ticket.id)

    def test_approver_can_reject_ticket_and_it_queue_cannot_see_it(self):
        self.employee.manager = self.approver_employee
        self.employee.save(update_fields=["manager"])

        self.client.force_authenticate(user=self.requester)

        create_response = self.client.post(
            "/api/tickets/",
            {
                "title": "Yeni monitör talebi",
                "description": "Çift ekran kullanmak için yeni monitör talep ediyorum.",
                "category": Ticket.Category.HARDWARE,
                "priority": Ticket.Priority.NORMAL,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        ticket = Ticket.objects.get()

        self.client.force_authenticate(user=self.approver)

        reject_response = self.client.post(
            f"/api/tickets/{ticket.id}/reject/",
            {
                "decision_note": "Bu ay bütçe uygun değil.",
            },
            format="json",
        )

        self.assertEqual(reject_response.status_code, status.HTTP_200_OK)

        ticket.refresh_from_db()
        approval = TicketApproval.objects.get(ticket=ticket)

        self.assertEqual(ticket.approval_status, Ticket.ApprovalStatus.REJECTED)
        self.assertEqual(ticket.status, Ticket.Status.CLOSED)
        self.assertIsNotNone(ticket.closed_at)
        self.assertEqual(approval.status, TicketApproval.Status.REJECTED)
        self.assertEqual(approval.decision_note, "Bu ay bütçe uygun değil.")
        self.assertIsNotNone(approval.decided_at)

        self.client.force_authenticate(user=self.technician)

        queue_response = self.client.get("/api/tickets/queue/")

        self.assertEqual(queue_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(queue_response.data), 0)

    def test_non_assigned_approver_cannot_access_someone_elses_pending_ticket(self):
        other_approver = self.create_user_with_role(
            "other-approver",
            UserProfile.Role.APPROVER,
        )
        Employee.objects.create(
            user=other_approver,
            full_name="Other Approver",
            email="other.approver@example.com",
            is_active=True,
        )

        self.employee.manager = self.approver_employee
        self.employee.save(update_fields=["manager"])

        self.client.force_authenticate(user=self.requester)

        create_response = self.client.post(
            "/api/tickets/",
            {
                "title": "Yetki talebi",
                "description": "Finans raporlarına erişim yetkisi istiyorum.",
                "category": Ticket.Category.ACCESS,
                "priority": Ticket.Priority.HIGH,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        ticket = Ticket.objects.get()

        self.client.force_authenticate(user=other_approver)

        approve_response = self.client.post(
            f"/api/tickets/{ticket.id}/approve/",
            {
                "decision_note": "Ben bu talebin yöneticisi değilim.",
            },
            format="json",
        )

        self.assertEqual(approve_response.status_code, status.HTTP_404_NOT_FOUND)

        ticket.refresh_from_db()

        self.assertEqual(ticket.approval_status, Ticket.ApprovalStatus.PENDING)

    def test_ticket_table_endpoint_returns_paginated_queue_for_technician(self):
        visible_ticket = Ticket.objects.create(
            employee=self.employee,
            title="Görünen queue ticket",
            description="Onay gerektirmeyen açık ticket.",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.URGENT,
            status=Ticket.Status.OPEN,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            created_by=self.requester,
        )
        Ticket.objects.create(
            employee=self.employee,
            title="Kapalı ticket görünmemeli",
            description="Kapalı ticket queue table içinde görünmemeli.",
            category=Ticket.Category.SOFTWARE,
            priority=Ticket.Priority.NORMAL,
            status=Ticket.Status.CLOSED,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            created_by=self.requester,
        )
        Ticket.objects.create(
            employee=self.employee,
            title="Onay bekleyen ticket görünmemeli",
            description="Pending approval ticket IT queue dışında kalmalı.",
            category=Ticket.Category.ACCESS,
            priority=Ticket.Priority.HIGH,
            status=Ticket.Status.OPEN,
            approval_status=Ticket.ApprovalStatus.PENDING,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.get("/api/tickets/table/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], visible_ticket.id)

    def test_requester_ticket_table_returns_only_own_tickets(self):
        other_requester = self.create_user_with_role(
            "other-requester",
            UserProfile.Role.REQUESTER,
        )
        other_employee = Employee.objects.create(
            user=other_requester,
            full_name="Other Requester Personel",
            email="other.requester@example.com",
            is_active=True,
        )

        own_ticket = Ticket.objects.create(
            employee=self.employee,
            title="Benim ticket",
            description="Requester kendi ticketını görmeli.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )
        Ticket.objects.create(
            employee=other_employee,
            title="Başka requester ticket",
            description="Requester başka personelin ticketını görmemeli.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            created_by=other_requester,
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.get("/api/tickets/table/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], own_ticket.id)

    def test_ticket_table_supports_search_status_priority_and_ordering(self):
        Ticket.objects.create(
            employee=self.employee,
            title="VPN özel arama ticket",
            description="VPN bağlantısı kopuyor.",
            category=Ticket.Category.NETWORK,
            priority=Ticket.Priority.HIGH,
            status=Ticket.Status.IN_PROGRESS,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            created_by=self.requester,
        )
        Ticket.objects.create(
            employee=self.employee,
            title="Mouse sorunu",
            description="Mouse tıklama problemi.",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.NORMAL,
            status=Ticket.Status.OPEN,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.get(
            "/api/tickets/table/",
            {
                "search": "VPN",
                "status": Ticket.Status.IN_PROGRESS,
                "priority": Ticket.Priority.HIGH,
                "ordering": "-created_at",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], "VPN özel arama ticket")

    def test_ticket_summary_endpoint_returns_queue_counts(self):
        Ticket.objects.create(
            employee=self.employee,
            title="Acil açık ticket",
            description="Acil açık ticket açıklaması.",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.URGENT,
            status=Ticket.Status.OPEN,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            created_by=self.requester,
        )
        Ticket.objects.create(
            employee=self.employee,
            title="İşlemde yüksek ticket",
            description="İşlemde yüksek ticket açıklaması.",
            category=Ticket.Category.SOFTWARE,
            priority=Ticket.Priority.HIGH,
            status=Ticket.Status.IN_PROGRESS,
            approval_status=Ticket.ApprovalStatus.APPROVED,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.get("/api/tickets/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual(response.data["open"], 1)
        self.assertEqual(response.data["in_progress"], 1)
        self.assertEqual(response.data["urgent"], 1)
        self.assertEqual(response.data["high"], 1)
        self.assertEqual(response.data["high_or_urgent"], 2)

    def test_legacy_ticket_queue_still_returns_array(self):
        Ticket.objects.create(
            employee=self.employee,
            title="Legacy queue ticket",
            description="Legacy queue array response kontrolü.",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.get("/api/tickets/queue/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_requester_context_returns_own_active_assignments_and_approval_preview(self):
        asset = self.create_asset(
            name="Requester Laptop",
            inventory_code="IT-REQ-001",
        )
        Assignment.objects.create(
            asset=asset,
            employee=self.employee,
            assigned_by=self.admin,
        )
        self.employee.manager = self.approver_employee
        self.employee.save(update_fields=["manager"])

        self.client.force_authenticate(user=self.requester)

        response = self.client.get("/api/tickets/requester-context/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["employee"]["id"], self.employee.id)
        self.assertEqual(len(response.data["active_assignments"]), 1)
        self.assertEqual(
            response.data["active_assignments"][0]["asset_id"],
            asset.id,
        )
        self.assertTrue(response.data["approval_preview"]["requires_approval"])
        self.assertEqual(
            response.data["approval_preview"]["approver_name"],
            self.approver_employee.full_name,
        )
        self.assertIn("limits", response.data)
        self.assertIn("image/png", response.data["limits"]["allowed_mime_types"])

    def test_requester_context_without_approver_manager_does_not_require_approval(self):
        self.client.force_authenticate(user=self.requester)

        response = self.client.get("/api/tickets/requester-context/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["approval_preview"]["requires_approval"])
        self.assertIsNone(response.data["approval_preview"]["approver_name"])

    def test_non_requester_cannot_access_requester_context(self):
        self.client.force_authenticate(user=self.technician)

        response = self.client.get("/api/tickets/requester-context/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_requester_can_create_ticket_with_own_active_assignment_asset(self):
        asset = self.create_asset(
            name="Assigned Laptop",
            inventory_code="IT-ASSIGNED-001",
        )
        Assignment.objects.create(
            asset=asset,
            employee=self.employee,
            assigned_by=self.admin,
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.post(
            "/api/tickets/",
            {
                "title": "Laptop ekran sorunu",
                "description": "Zimmetimdeki laptop ekranında görüntü gidip geliyor.",
                "category": Ticket.Category.HARDWARE,
                "priority": Ticket.Priority.NORMAL,
                "asset": asset.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        ticket = Ticket.objects.get(id=response.data["id"])

        self.assertEqual(ticket.asset_id, asset.id)
        self.assertEqual(ticket.employee_id, self.employee.id)

    def test_requester_cannot_create_ticket_with_unassigned_asset(self):
        unassigned_asset = self.create_asset(
            name="Someone Else Laptop",
            inventory_code="IT-OTHER-001",
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.post(
            "/api/tickets/",
            {
                "title": "Başka cihaz sorunu",
                "description": "Bana zimmetli olmayan bir cihaz için kayıt açmaya çalışıyorum.",
                "category": Ticket.Category.HARDWARE,
                "priority": Ticket.Priority.NORMAL,
                "asset": unassigned_asset.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("asset", response.data)
        self.assertEqual(Ticket.objects.count(), 0)

    def test_requester_can_upload_attachment_to_own_ticket(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Ekran hatası",
            description="Ekranda hata mesajı var.",
            category=Ticket.Category.SOFTWARE,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/attachments/",
            {
                "file": self.create_png_file(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(TicketAttachment.objects.count(), 1)
        self.assertEqual(response.data["original_filename"], "screen.png")
        self.assertEqual(response.data["mime_type"], "image/png")
        self.assertEqual(response.data["uploaded_by"], self.requester.id)

    def test_requester_cannot_upload_attachment_to_someone_elses_ticket(self):
        other_requester = self.create_user_with_role(
            "attachment-other-requester",
            UserProfile.Role.REQUESTER,
        )
        other_employee = Employee.objects.create(
            user=other_requester,
            full_name="Other Requester",
            email="other@example.com",
            is_active=True,
        )
        ticket = Ticket.objects.create(
            employee=other_employee,
            title="Başkasının ticketı",
            description="Başka requester ticketı.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            created_by=other_requester,
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/attachments/",
            {
                "file": self.create_png_file(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(TicketAttachment.objects.count(), 0)

    def test_attachment_rejects_unsupported_mime_type(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Dosya tipi testi",
            description="Desteklenmeyen dosya tipi reddedilmeli.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )
        uploaded_file = SimpleUploadedFile(
            "malware.exe",
            b"fake-exe",
            content_type="application/x-msdownload",
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/attachments/",
            {
                "file": uploaded_file,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)
        self.assertEqual(TicketAttachment.objects.count(), 0)

    def test_attachment_rejects_files_larger_than_limit(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Büyük dosya testi",
            description="Limit üstü dosya reddedilmeli.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )
        oversized_file = SimpleUploadedFile(
            "large.pdf",
            b"x" * (5 * 1024 * 1024 + 1),
            content_type="application/pdf",
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/attachments/",
            {
                "file": oversized_file,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)
        self.assertEqual(TicketAttachment.objects.count(), 0)

    def test_ticket_attachment_limit_per_ticket_is_enforced(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Dosya sayısı limiti",
            description="Ticket başına dosya limiti test edilir.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )

        for index in range(TICKET_ATTACHMENT_MAX_FILES_PER_TICKET):
            TicketAttachment.objects.create(
                ticket=ticket,
                file=self.create_pdf_file(name=f"existing-{index}.pdf"),
                original_filename=f"existing-{index}.pdf",
                mime_type="application/pdf",
                size_bytes=100,
                uploaded_by=self.requester,
            )

        self.client.force_authenticate(user=self.requester)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/attachments/",
            {
                "file": self.create_png_file(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)

    def test_requester_can_list_and_download_own_ticket_attachment(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Download testi",
            description="Kendi attachment download testidir.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )
        attachment = TicketAttachment.objects.create(
            ticket=ticket,
            file=self.create_pdf_file(),
            original_filename="document.pdf",
            mime_type="application/pdf",
            size_bytes=100,
            uploaded_by=self.requester,
        )

        self.client.force_authenticate(user=self.requester)

        list_response = self.client.get(f"/api/tickets/{ticket.id}/attachments/")

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["id"], attachment.id)

        download_response = self.client.get(
            f"/api/tickets/attachments/{attachment.id}/download/"
        )

        self.assertEqual(download_response.status_code, status.HTTP_200_OK)
        self.assertEqual(download_response["Content-Type"], "application/pdf")

    def test_viewer_cannot_download_ticket_attachment(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Viewer download testi",
            description="Viewer attachment indirmemeli.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )
        attachment = TicketAttachment.objects.create(
            ticket=ticket,
            file=self.create_pdf_file(),
            original_filename="document.pdf",
            mime_type="application/pdf",
            size_bytes=100,
            uploaded_by=self.requester,
        )

        self.client.force_authenticate(user=self.viewer)

        response = self.client.get(
            f"/api/tickets/attachments/{attachment.id}/download/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)



    def test_technician_can_download_ticket_attachment(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Technician download testi",
            description="Technician attachment indirebilir.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )
        attachment = TicketAttachment.objects.create(
            ticket=ticket,
            file=self.create_pdf_file(),
            original_filename="document.pdf",
            mime_type="application/pdf",
            size_bytes=100,
            uploaded_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.get(
            f"/api/tickets/attachments/{attachment.id}/download/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_technician_can_read_ticket_context(self):
        asset = self.create_asset(
            name="Context Laptop",
            inventory_code="IT-CTX-001",
        )
        Assignment.objects.create(
            asset=asset,
            employee=self.employee,
            assigned_by=self.admin,
        )
        ticket = Ticket.objects.create(
            employee=self.employee,
            asset=asset,
            title="Context ticket",
            description="Teknisyen workspace context endpoint testi.",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.HIGH,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            status=Ticket.Status.OPEN,
            created_by=self.requester,
        )
        TicketComment.objects.create(
            ticket=ticket,
            author=self.technician,
            body="Public reply",
            is_internal=False,
        )
        TicketComment.objects.create(
            ticket=ticket,
            author=self.technician,
            body="Internal note",
            is_internal=True,
        )
        TicketAttachment.objects.create(
            ticket=ticket,
            file=self.create_pdf_file(),
            original_filename="context.pdf",
            mime_type="application/pdf",
            size_bytes=100,
            uploaded_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.get(f"/api/tickets/{ticket.id}/context/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["ticket"]["id"], ticket.id)
        self.assertEqual(response.data["requester"]["id"], self.employee.id)
        self.assertEqual(response.data["asset"]["id"], asset.id)
        self.assertEqual(len(response.data["active_assignments"]), 1)
        self.assertEqual(response.data["comments_summary"]["total"], 2)
        self.assertEqual(response.data["comments_summary"]["public"], 1)
        self.assertEqual(response.data["comments_summary"]["internal"], 1)
        self.assertEqual(response.data["attachments_summary"]["total"], 1)
        self.assertTrue(response.data["actions"]["can_update_status"])
        self.assertTrue(response.data["actions"]["can_add_internal_note"])
        self.assertIn(
            Ticket.Status.RESOLVED,
            response.data["transition_rules"]["requires_solution_note_for"],
        )

    def test_viewer_can_read_ticket_context_but_actions_are_read_only(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Viewer context ticket",
            description="Viewer context okuyabilir ama aksiyon alamaz.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            status=Ticket.Status.OPEN,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.viewer)

        response = self.client.get(f"/api/tickets/{ticket.id}/context/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["actions"]["can_view_context"])
        self.assertTrue(response.data["actions"]["is_read_only"])
        self.assertFalse(response.data["actions"]["can_update_status"])
        self.assertFalse(response.data["actions"]["can_assign_ticket"])
        self.assertFalse(response.data["actions"]["can_add_internal_note"])

    def test_requester_cannot_read_technician_ticket_context(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Requester context forbidden",
            description="Requester teknisyen context endpointine erişmemeli.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            status=Ticket.Status.OPEN,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.get(f"/api/tickets/{ticket.id}/context/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_ticket_context_for_pending_approval_blocks_it_actions(self):
        self.employee.manager = self.approver_employee
        self.employee.save(update_fields=["manager"])

        self.client.force_authenticate(user=self.requester)

        create_response = self.client.post(
            "/api/tickets/",
            {
                "title": "Pending context ticket",
                "description": "Onay bekleyen ticket context aksiyonları kapalı olmalı.",
                "category": Ticket.Category.ACCESS,
                "priority": Ticket.Priority.HIGH,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        ticket = Ticket.objects.get(id=create_response.data["id"])

        self.client.force_authenticate(user=self.technician)

        response = self.client.get(f"/api/tickets/{ticket.id}/context/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["actions"]["can_update_status"])
        self.assertFalse(response.data["actions"]["can_assign_ticket"])
        self.assertIsNotNone(response.data["actions"]["blocked_reason"])

    def test_resolved_status_requires_solution_note(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Resolve note required",
            description="Resolved durumunda çözüm notu zorunlu olmalı.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            status=Ticket.Status.OPEN,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/status/",
            {
                "status": Ticket.Status.RESOLVED,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("solution_note", response.data)

        ticket.refresh_from_db()
        self.assertEqual(ticket.status, Ticket.Status.OPEN)
        self.assertEqual(ticket.resolution_note, "")

    def test_technician_can_resolve_ticket_with_solution_note(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Resolve with note",
            description="Çözüm notuyla resolved yapılmalı.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            status=Ticket.Status.OPEN,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/status/",
            {
                "status": Ticket.Status.RESOLVED,
                "solution_note": "Kullanıcının VPN profili yenilendi.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ticket.refresh_from_db()

        self.assertEqual(ticket.status, Ticket.Status.RESOLVED)
        self.assertEqual(ticket.resolution_note, "Kullanıcının VPN profili yenilendi.")
        self.assertEqual(ticket.resolved_by, self.technician)
        self.assertIsNotNone(ticket.resolved_at)
        self.assertIsNone(ticket.closed_at)

        solution_comment = TicketComment.objects.get(
            ticket=ticket,
            body="Çözüm notu: Kullanıcının VPN profili yenilendi.",
        )

        self.assertFalse(solution_comment.is_internal)
        self.assertEqual(solution_comment.author, self.technician)

    def test_closed_status_requires_solution_note_when_ticket_has_no_existing_note(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Close note required",
            description="Closed durumunda çözüm notu zorunlu olmalı.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            status=Ticket.Status.OPEN,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/status/",
            {
                "status": Ticket.Status.CLOSED,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("solution_note", response.data)

    def test_technician_can_close_resolved_ticket_without_new_solution_note(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Close existing resolved ticket",
            description="Çözüm notu olan ticket kapatılabilir.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            status=Ticket.Status.RESOLVED,
            resolution_note="Önceden çözüm notu girildi.",
            resolved_by=self.technician,
            resolved_at=timezone.now(),
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/status/",
            {
                "status": Ticket.Status.CLOSED,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ticket.refresh_from_db()

        self.assertEqual(ticket.status, Ticket.Status.CLOSED)
        self.assertEqual(ticket.resolution_note, "Önceden çözüm notu girildi.")
        self.assertEqual(ticket.closed_by, self.technician)
        self.assertIsNotNone(ticket.closed_at)

    def test_reopening_ticket_clears_resolution_fields(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Reopen ticket",
            description="Yeniden açılan ticket çözüm alanlarını temizlemeli.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            status=Ticket.Status.RESOLVED,
            resolution_note="Eski çözüm.",
            resolved_by=self.technician,
            resolved_at=timezone.now(),
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        response = self.client.post(
            f"/api/tickets/{ticket.id}/status/",
            {
                "status": Ticket.Status.IN_PROGRESS,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ticket.refresh_from_db()

        self.assertEqual(ticket.status, Ticket.Status.IN_PROGRESS)
        self.assertEqual(ticket.resolution_note, "")
        self.assertIsNone(ticket.resolved_by)
        self.assertIsNone(ticket.resolved_at)
        self.assertIsNone(ticket.closed_by)
        self.assertIsNone(ticket.closed_at)    