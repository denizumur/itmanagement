import { IconInbox } from "@tabler/icons-react";

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="rounded-panel border border-dashed border-border bg-surface-1 px-lg py-xl text-center shadow-panel">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-text-secondary">
        <IconInbox size={22} aria-hidden={true} />
      </div>

      <p className="mt-md text-body font-semibold text-text-primary">
        Kayıt bulunamadı
      </p>

      <p className="mx-auto mt-xs max-w-md text-caption text-text-secondary">
        {message}
      </p>
    </div>
  );
}