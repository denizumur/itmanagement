import type {
  TicketApprovalStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "../types/tickets";

export type BadgeVariant =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export type RequesterCategoryKey =
  | "computer"
  | "printer"
  | "access"
  | "software"
  | "network"
  | "other";

export const ticketStatusMeta: Record<
  TicketStatus,
  {
    label: string;
    variant: BadgeVariant;
  }
> = {
  open: { label: "Gönderildi", variant: "accent" },
  in_progress: { label: "IT inceliyor", variant: "warning" },
  resolved: { label: "Çözüldü", variant: "success" },
  closed: { label: "Kapandı", variant: "neutral" },
};

export const ticketPriorityMeta: Record<
  TicketPriority,
  {
    label: string;
    requesterLabel: string;
    variant: BadgeVariant;
  }
> = {
  low: {
    label: "Düşük",
    requesterLabel: "Bekleyebilir",
    variant: "neutral",
  },
  normal: {
    label: "Normal",
    requesterLabel: "Bugün olursa iyi olur",
    variant: "accent",
  },
  high: {
    label: "Yüksek",
    requesterLabel: "Önemli",
    variant: "warning",
  },
  urgent: {
    label: "Acil",
    requesterLabel: "Acil, işim durdu",
    variant: "danger",
  },
};

export const ticketApprovalMeta: Record<
  TicketApprovalStatus,
  {
    label: string;
    requesterLabel: string;
    variant: BadgeVariant;
  }
> = {
  not_required: {
    label: "Onay gerekmiyor",
    requesterLabel: "IT ekibine iletildi",
    variant: "neutral",
  },
  pending: {
    label: "Onay bekliyor",
    requesterLabel: "Yönetici onayı bekliyor",
    variant: "warning",
  },
  approved: {
    label: "Onaylandı",
    requesterLabel: "Onaylandı",
    variant: "success",
  },
  rejected: {
    label: "Reddedildi",
    requesterLabel: "Onaylanmadı",
    variant: "danger",
  },
};

export const requesterPriorityOptions: Array<{
  value: TicketPriority;
  label: string;
  description: string;
}> = [
  {
    value: "low",
    label: "Bekleyebilir",
    description: "İşim devam ediyor, uygun olduğunda bakılabilir.",
  },
  {
    value: "normal",
    label: "Bugün olursa iyi olur",
    description: "İşimi etkiliyor ama tamamen durdurmadı.",
  },
  {
    value: "urgent",
    label: "Acil, işim durdu",
    description: "Çalışamıyorum veya kritik bir işi tamamlayamıyorum.",
  },
];

export const requesterCategoryOptions: Array<{
  key: RequesterCategoryKey;
  value: TicketCategory;
  label: string;
  icon: string;
  description: string;
  tip: string;
}> = [
  {
    key: "computer",
    value: "hardware",
    label: "Bilgisayarım / Donanım",
    icon: "💻",
    description: "Laptop, monitör, klavye, mouse veya fiziksel cihaz sorunu.",
    tip: "Cihaz kapanıp açılmıyorsa güç kablosunu ve adaptörü kontrol etmek ilk hızlı adımdır.",
  },
  {
    key: "printer",
    value: "hardware",
    label: "Yazıcı",
    icon: "🖨️",
    description: "Çıktı alamıyorum, toner, kağıt veya yazıcı bağlantısı sorunu.",
    tip: "Yazıcı görünmüyorsa aynı ağa bağlı olduğunuzdan ve yazıcının açık olduğundan emin olun.",
  },
  {
    key: "access",
    value: "access",
    label: "Şifre / Erişim Sorunu",
    icon: "🔐",
    description: "Şifre, hesap kilidi, yetki, VPN veya sisteme giriş problemi.",
    tip: "Şifre hatasında birkaç denemeden sonra hesap kilitlenebilir; hata mesajını ekran görüntüsüyle eklemek hızlandırır.",
  },
  {
    key: "software",
    value: "software",
    label: "Yeni Program İhtiyacım Var",
    icon: "📦",
    description: "Program kurulumu, lisans, uygulama hatası veya yazılım talebi.",
    tip: "Hangi programa neden ihtiyaç duyduğunuzu yazarsanız onay ve kurulum süreci daha hızlı ilerler.",
  },
  {
    key: "network",
    value: "network",
    label: "Ağ / İnternet",
    icon: "🌐",
    description: "İnternet, Wi-Fi, VPN, ortak klasör veya bağlantı problemi.",
    tip: "Sorun sadece sizde mi yoksa ekip arkadaşlarınızda da var mı? Bunu belirtmeniz çok yardımcı olur.",
  },
  {
    key: "other",
    value: "other",
    label: "Diğer",
    icon: "✨",
    description: "Yukarıdakilere uymayan her türlü IT destek ihtiyacı.",
    tip: "Konuyu kısa ama net anlatmanız doğru ekibe yönlendirmeyi kolaylaştırır.",
  },
];

export function getRequesterCategoryOption(key: RequesterCategoryKey) {
  return (
    requesterCategoryOptions.find((option) => option.key === key) ??
    requesterCategoryOptions[requesterCategoryOptions.length - 1]
  );
}

export function getTicketStatusMeta(status: TicketStatus) {
  return ticketStatusMeta[status];
}

export function getTicketPriorityMeta(priority: TicketPriority) {
  return ticketPriorityMeta[priority];
}

export function getTicketApprovalMeta(approvalStatus: TicketApprovalStatus) {
  return ticketApprovalMeta[approvalStatus];
}