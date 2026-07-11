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
    <div className="fixed bottom-lg right-lg z-50 max-w-sm rounded-panel border border-border bg-surface-2 p-md shadow-panel">
      <div className="flex items-start gap-sm">
        <span
          className={`inline-flex rounded-app p-xs ${
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
          <p className="text-body text-text-primary">{message}</p>
        </div>

        <button
          type="button"
          className="text-caption text-text-secondary transition hover:text-text-primary"
          onClick={onClose}
        >
          Kapat
        </button>
      </div>
    </div>
  );
}