import { IconCheck, IconX } from "@tabler/icons-react";

export type ToastType = "success" | "error";

interface AppToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
}

export function AppToast({ type, message, onClose }: AppToastProps) {
  const isSuccess = type === "success";

  return (
    <div className="fixed bottom-lg right-lg z-50 w-[min(100%-2rem,420px)] rounded-panel border border-border bg-surface-1 p-md shadow-popover">
      <div className="flex items-start gap-sm">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            isSuccess ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
          }`}
        >
          {isSuccess ? (
            <IconCheck size={18} aria-hidden={true} />
          ) : (
            <IconX size={18} aria-hidden={true} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-text-primary">{message}</p>
        </div>

        <button
          type="button"
          className="rounded-lg px-xs py-[2px] text-caption font-semibold text-text-secondary transition hover:bg-surface-2 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/25"
          onClick={onClose}
        >
          Kapat
        </button>
      </div>
    </div>
  );
}