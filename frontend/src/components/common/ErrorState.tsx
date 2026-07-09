interface ErrorStateProps {
  message: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="panel border-danger text-danger">
      <p className="text-h3">Bir hata oluştu</p>
      <p className="mt-sm text-body">{message}</p>
    </div>
  );
}