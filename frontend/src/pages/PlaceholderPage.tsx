import type { ReactNode } from "react";
import { AppShell } from "../components/layout/AppShell";

interface PlaceholderPageProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function PlaceholderPage({
  title,
  description,
  children,
}: PlaceholderPageProps) {
  return (
    <AppShell>
      <div className="mb-lg">
        <h1 className="text-display">{title}</h1>
        <p className="mt-sm text-text-secondary">{description}</p>
      </div>

      <div className="panel">
        <p className="text-h3">Modül hazırlık ekranı</p>
        <p className="mt-sm text-body text-text-secondary">
          Bu sayfanın route, layout ve navigasyon bağlantısı hazır. Veri listeleme,
          filtreleme ve CRUD ekranları sonraki fazda bu temel üzerine eklenecek.
        </p>

        {children && <div className="mt-lg">{children}</div>}
      </div>
    </AppShell>
  );
}