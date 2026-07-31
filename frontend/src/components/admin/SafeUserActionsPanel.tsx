import {
  IconClipboard,
  IconShieldCheck,
  IconUserCancel,
  IconUserCheck,
  IconUserPlus,
  IconUserX,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { createUserInvitation, revokeUserInvitation } from "../../api/accounts";
import type { UserInvitationCreateResponse } from "../../api/accounts";
import {
  useChangeAdminUserRole,
  useDeactivateAdminUser,
  useReactivateAdminUser,
} from "../../hooks/useAdminUsers";
import type { AdminUserDetail } from "../../types/adminUsers";
import type { AuthUser, UserRole } from "../../types/auth";
import { UserActionModal } from "./UserActionModal";
import type { UserActionResult } from "./UserAuditTraceCard";

type AdminUserActionKind =
  | "deactivate"
  | "reactivate"
  | "change-role"
  | "create-invitation"
  | "revoke-invitation";

const ACTION_LABELS: Record<AdminUserActionKind, string> = {
  deactivate: "Pasifleştir",
  reactivate: "Yeniden aktifleştir",
  "change-role": "Rol değiştir",
  "create-invitation": "Davet oluştur",
  "revoke-invitation": "Daveti iptal et",
};

function expectedConfirmation(action: AdminUserActionKind, username: string) {
  if (action === "deactivate") {
    return `DEACTIVATE ${username}`;
  }
  if (action === "reactivate") {
    return `REACTIVATE ${username}`;
  }
  if (action === "change-role") {
    return `CHANGE ROLE ${username}`;
  }
  if (action === "create-invitation") {
    return `CREATE INVITATION ${username}`;
  }
  return `REVOKE INVITATION ${username}`;
}

function actionHelpText(action: AdminUserActionKind, user: AdminUserDetail) {
  if (action === "deactivate") {
    return `${user.username} hesabı pasif yapılır; rol, personel bağlantısı ve bekleyen davetler korunur.`;
  }
  if (action === "reactivate") {
    return `${user.username} hesabı yeniden aktif yapılır. Kullanılabilir kimlik bilgisi yoksa backend işlemi reddeder.`;
  }
  if (action === "change-role") {
    return `${user.username} için sadece rol güncellenir; aktiflik, personel bağlantısı ve kimlik bilgisi değişmez.`;
  }
  if (action === "create-invitation") {
    return `${user.username} için yeni aktivasyon daveti oluşturulur. Link sadece bu işlemden sonra geçici olarak gösterilir.`;
  }
  return `${user.username} için son bekleyen davet iptal edilir. Kullanıcı hesabı veya rolü değişmez.`;
}

function resultForAction(
  action: AdminUserActionKind,
  activationUrl?: string,
  emailDelivery?: UserInvitationCreateResponse["email_delivery"]
): UserActionResult {
  const timestamp = new Date().toISOString();

  if (action === "deactivate") {
    return {
      type: "deactivated",
      title: "Kullanıcı pasifleştirildi",
      description: "Kullanıcı artık giriş yapamaz. Kayıt ve personel bağlantısı korunur.",
      timestamp,
    };
  }
  if (action === "reactivate") {
    return {
      type: "reactivated",
      title: "Kullanıcı yeniden aktifleştirildi",
      description: "Kullanıcı tekrar giriş yapabilir. Audit kaydı oluşturuldu.",
      timestamp,
    };
  }
  if (action === "change-role") {
    return {
      type: "role_changed",
      title: "Kullanıcı rolü güncellendi",
      description: "Yetki seviyesi değiştirildi ve işlem audit log'a yazıldı.",
      timestamp,
    };
  }
  if (action === "create-invitation") {
    return {
      type: "invitation_created",
      title: "Davet oluşturuldu",
      description: "Aktivasyon linki bu panelde geçici olarak gösterilir.",
      timestamp,
      activationUrl,
      emailDelivery: emailDelivery
        ? {
            attempted: emailDelivery.attempted,
            status: emailDelivery.status,
            reason: emailDelivery.reason,
            recipientMaskedEmail: emailDelivery.recipient_masked_email,
          }
        : undefined,
    };
  }

  return {
    type: "invitation_revoked",
    title: "Bekleyen davet iptal edildi",
    description: "Kullanıcı hesabı ve rolü değiştirilmeden davet iptal edildi.",
    timestamp,
  };
}

function getActionError(error: unknown) {
  const maybeError = error as { response?: { data?: { detail?: string } } };
  return maybeError.response?.data?.detail ?? "İşlem tamamlanamadı.";
}

function ActionButton({
  children,
  disabled,
  tone = "accent",
  testId,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  tone?: "accent" | "success" | "danger";
  testId: string;
  onClick: () => void;
}) {
  const hoverTone = {
    accent: "hover:border-accent hover:text-accent focus:ring-accent/25",
    success: "hover:border-success hover:text-success focus:ring-success/25",
    danger: "hover:border-danger hover:text-danger focus:ring-danger/25",
  };

  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center gap-xs rounded-xl border border-border bg-surface-1 px-sm text-body font-semibold text-text-primary transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${hoverTone[tone]}`}
    >
      {children}
    </button>
  );
}

export function SafeUserActionsPanel({
  user,
  currentUser,
  onRefresh,
  onActionResult,
}: {
  user: AdminUserDetail;
  currentUser: AuthUser | null;
  onRefresh: () => Promise<void> | void;
  onActionResult: (result: UserActionResult) => void;
}) {
  const [actionKind, setActionKind] = useState<AdminUserActionKind | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | "">("");
  const [error, setError] = useState("");
  const [isInvitationSubmitting, setIsInvitationSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const deactivateMutation = useDeactivateAdminUser();
  const reactivateMutation = useReactivateAdminUser();
  const changeRoleMutation = useChangeAdminUserRole();
  const isSelf = currentUser?.id === user.id;
  const isSubmitting =
    deactivateMutation.isPending ||
    reactivateMutation.isPending ||
    changeRoleMutation.isPending ||
    isInvitationSubmitting;

  function openAction(action: AdminUserActionKind) {
    setActionKind(action);
    setReason("");
    setConfirmation("");
    setSelectedRole("");
    setError("");
    setCopied(false);
  }

  function closeAction() {
    setActionKind(null);
    setReason("");
    setConfirmation("");
    setError("");
  }

  async function submitAction() {
    if (!actionKind) {
      return;
    }

    setError("");
    try {
      let activationUrl: string | undefined;
      let emailDelivery: UserInvitationCreateResponse["email_delivery"];
      if (actionKind === "deactivate") {
        await deactivateMutation.mutateAsync({
          userId: user.id,
          payload: { reason, confirmation },
        });
      } else if (actionKind === "reactivate") {
        await reactivateMutation.mutateAsync({
          userId: user.id,
          payload: { reason, confirmation },
        });
      } else if (actionKind === "change-role" && selectedRole) {
        await changeRoleMutation.mutateAsync({
          userId: user.id,
          payload: { role: selectedRole, reason, confirmation },
        });
      } else if (actionKind === "create-invitation") {
        setIsInvitationSubmitting(true);
        const response = await createUserInvitation(user.id);
        activationUrl = response.activation_url;
        emailDelivery = response.email_delivery;
      } else if (
        actionKind === "revoke-invitation" &&
        user.activation.latest_invitation_id
      ) {
        setIsInvitationSubmitting(true);
        await revokeUserInvitation(user.activation.latest_invitation_id);
      }

      await onRefresh();
      onActionResult(resultForAction(actionKind, activationUrl, emailDelivery));
      closeAction();
    } catch (submitError) {
      setError(getActionError(submitError));
    } finally {
      setIsInvitationSubmitting(false);
    }
  }

  async function copyExpectedConfirmation() {
    if (!actionKind) {
      return;
    }
    try {
      await navigator.clipboard.writeText(expectedConfirmation(actionKind, user.username));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      className="rounded-panel border border-warning/25 bg-warning-bg/25 p-md"
      data-testid="admin-user-actions-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div>
          <h3 className="text-body font-semibold text-text-primary">
            Güvenli Aksiyonlar
          </h3>
          <p className="mt-xs text-caption text-text-secondary">
            İşlemler gerekçe, açık onay metni ve audit kaydı ile yürütülür.
            Silme, toplu işlem veya kimlik bilgisi sıfırlama yapılmaz.
          </p>
        </div>
        {isSelf ? (
          <span className="rounded-full border border-warning/25 bg-warning-bg px-sm py-xs text-[11px] font-semibold text-warning">
            Kendi hesabınız
          </span>
        ) : null}
      </div>

      <div className="mt-md grid gap-sm sm:grid-cols-2">
        <ActionButton
          testId="admin-user-deactivate"
          tone="danger"
          disabled={!user.is_active || isSelf}
          onClick={() => openAction("deactivate")}
        >
          <IconUserX size={16} aria-hidden={true} />
          Pasifleştir
        </ActionButton>
        <ActionButton
          testId="admin-user-reactivate"
          tone="success"
          disabled={user.is_active}
          onClick={() => openAction("reactivate")}
        >
          <IconUserCheck size={16} aria-hidden={true} />
          Yeniden aktifleştir
        </ActionButton>
        <ActionButton
          testId="admin-user-change-role"
          disabled={isSelf}
          onClick={() => openAction("change-role")}
        >
          <IconShieldCheck size={16} aria-hidden={true} />
          Rol değiştir
        </ActionButton>
        <ActionButton
          testId="admin-user-create-invitation"
          onClick={() => openAction("create-invitation")}
        >
          <IconUserPlus size={16} aria-hidden={true} />
          Davet oluştur
        </ActionButton>
        <ActionButton
          testId="admin-user-revoke-invitation"
          tone="danger"
          disabled={
            user.activation.latest_invitation_status !== "pending" ||
            !user.activation.latest_invitation_id
          }
          onClick={() => openAction("revoke-invitation")}
        >
          <IconUserCancel size={16} aria-hidden={true} />
          Daveti iptal et
        </ActionButton>
      </div>

      {isSelf ? (
        <p className="mt-sm text-caption text-text-secondary">
          Kendi hesabınızı pasifleştiremez veya kendi rolünüzü değiştiremezsiniz.
        </p>
      ) : null}
      {user.role === "admin" ? (
        <p className="mt-xs text-caption text-text-secondary">
          Admin rolündeki kullanıcılar için son aktif admin kontrolü backend
          tarafından uygulanır.
        </p>
      ) : null}

      {actionKind ? (
        <>
          <div className="mt-sm flex justify-end">
            <button
              type="button"
              onClick={copyExpectedConfirmation}
              className="inline-flex items-center gap-xs text-caption font-semibold text-accent transition hover:text-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
            >
              <IconClipboard size={14} aria-hidden={true} />
              {copied ? "Onay metni kopyalandı" : "Onay metnini kopyala"}
            </button>
          </div>
          <UserActionModal
            title={ACTION_LABELS[actionKind]}
            description={actionHelpText(actionKind, user)}
            expectedConfirmation={expectedConfirmation(actionKind, user.username)}
            reason={reason}
            confirmation={confirmation}
            error={error}
            isSubmitting={isSubmitting}
            reasonRequired={
              actionKind !== "create-invitation" &&
              actionKind !== "revoke-invitation"
            }
            currentRole={user.role}
            selectedRole={actionKind === "change-role" ? selectedRole : undefined}
            onSelectedRoleChange={
              actionKind === "change-role" ? setSelectedRole : undefined
            }
            onReasonChange={setReason}
            onConfirmationChange={setConfirmation}
            onSubmit={submitAction}
            onCancel={closeAction}
          />
        </>
      ) : null}
    </section>
  );
}
