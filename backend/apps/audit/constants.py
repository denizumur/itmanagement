AUDITED_ENTITY_TYPES = [
    ("inventory.Asset", "Varlıklar"),
    ("assignments.Assignment", "Zimmetler"),
    ("maintenance.MaintenanceRecord", "Bakım / Onarım"),
    ("licensing.LicenseSubscription", "Lisanslar"),
    ("tickets.Ticket", "Ticketlar"),
    ("tickets.TicketApproval", "Ticket Onayları"),
    ("tickets.TicketComment", "Ticket Yorumları"),
    ("tickets.TicketAttachment", "Ticket Ekleri"),
    ("employees.Employee", "Personel"),
]

ENTITY_TYPE_LABELS = dict(AUDITED_ENTITY_TYPES)

CRITICAL_AUDIT_ACTIONS = [
    "delete",
    "restore",
    "export",
    "dispose",
]