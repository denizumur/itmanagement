interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="rounded-panel border border-border bg-surface-1 p-lg text-center text-text-secondary">
      {message}
    </div>
  );
}