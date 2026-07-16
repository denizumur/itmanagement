import {
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
  IconPaperclip,
  IconRefresh,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useMemo, useState } from "react";
import { TicketProgressStepper } from "./TicketProgressStepper";
import {
  getRequesterCategoryOption,
  requesterCategoryOptions,
  requesterPriorityOptions,
  type RequesterCategoryKey,
} from "../../lib/ticketLabels";
import {
  useCreateTicket,
  useUploadTicketAttachment,
} from "../../hooks/useTickets";
import type {
  Ticket,
  TicketCreatePayload,
  TicketPriority,
  TicketRequesterContext,
} from "../../types/tickets";

type RequesterTicketFormProps = {
  requesterContext?: TicketRequesterContext;
  isContextLoading: boolean;
  isContextError: boolean;
  onRefreshContext: () => void;
  onCreated: (ticket: Ticket) => Promise<void> | void;
};

type SuccessState = {
  ticket: Ticket;
  failedUploads: string[];
};

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return "İşlem sırasında bir hata oluştu.";
  }

  const response = (
    error as {
      response?: {
        data?: unknown;
      };
    }
  ).response;

  const data = response?.data;

  if (!data) {
    return "İşlem sırasında bir hata oluştu.";
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object" && "detail" in data) {
    const detail = (data as { detail?: unknown }).detail;

    if (typeof detail === "string") {
      return detail;
    }
  }

  if (typeof data === "object") {
    const firstEntry = Object.entries(data as Record<string, unknown>)[0];

    if (firstEntry) {
      const [, value] = firstEntry;

      if (Array.isArray(value)) {
        return value.join(", ");
      }

      if (typeof value === "string") {
        return value;
      }
    }
  }

  return "İşlem sırasında bir hata oluştu.";
}

function formatBytes(bytes: number) {
  if (!bytes) {
    return "0 KB";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.ceil(bytes / 1024)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function RequesterTicketForm({
  requesterContext,
  isContextLoading,
  isContextError,
  onRefreshContext,
  onCreated,
}: RequesterTicketFormProps) {
  const createTicketMutation = useCreateTicket();
  const uploadAttachmentMutation = useUploadTicketAttachment();

  const [selectedCategoryKey, setSelectedCategoryKey] =
    useState<RequesterCategoryKey>("computer");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<SuccessState | null>(null);

  const selectedCategory = useMemo(
    () => getRequesterCategoryOption(selectedCategoryKey),
    [selectedCategoryKey]
  );

  const limits = requesterContext?.limits;
  const maxFileSizeBytes = limits?.max_file_size_bytes ?? 5 * 1024 * 1024;
  const maxFilesPerTicket = limits?.max_files_per_ticket ?? 5;
  const allowedMimeTypes = limits?.allowed_mime_types ?? [
    "image/png",
    "image/jpeg",
    "application/pdf",
  ];

  const isSubmitting =
    createTicketMutation.isPending || uploadAttachmentMutation.isPending;

  function addFiles(fileList: FileList | File[]) {
    setError(null);

    const incomingFiles = Array.from(fileList);

    if (incomingFiles.length === 0) {
      return;
    }

    const invalidTypeFiles = incomingFiles.filter((file) => {
      if (!file.type) {
        return false;
      }

      return !allowedMimeTypes.includes(file.type);
    });

    if (invalidTypeFiles.length > 0) {
      setError("Sadece PNG, JPG/JPEG veya PDF dosyaları ekleyebilirsin.");
      return;
    }

    const oversizedFiles = incomingFiles.filter(
      (file) => file.size > maxFileSizeBytes
    );

    if (oversizedFiles.length > 0) {
      setError(
        `Dosya boyutu en fazla ${formatBytes(maxFileSizeBytes)} olabilir.`
      );
      return;
    }

    const remainingCount = maxFilesPerTicket - files.length;

    if (remainingCount <= 0) {
      setError(`Bir talep için en fazla ${maxFilesPerTicket} dosya eklenebilir.`);
      return;
    }

    const acceptedFiles = incomingFiles.slice(0, remainingCount);

    if (acceptedFiles.length < incomingFiles.length) {
      setError(
        `En fazla ${maxFilesPerTicket} dosya eklenebilir. Fazla dosyalar eklenmedi.`
      );
    }

    setFiles((current) => [...current, ...acceptedFiles]);
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      addFiles(event.target.files);
    }

    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();

    if (event.dataTransfer.files) {
      addFiles(event.dataTransfer.files);
    }
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!requesterContext || isSubmitting) {
      return;
    }

    setError(null);
    setSuccessState(null);

    try {
      const payload: TicketCreatePayload = {
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory.value,
        priority,
        asset: selectedAssetId ? Number(selectedAssetId) : null,
      };

      const createdTicket = await createTicketMutation.mutateAsync(payload);
      const failedUploads: string[] = [];

      for (const file of files) {
        try {
          await uploadAttachmentMutation.mutateAsync({
            ticketId: createdTicket.id,
            file,
          });
        } catch {
          failedUploads.push(file.name);
        }
      }

      setTitle("");
      setDescription("");
      setSelectedCategoryKey("computer");
      setPriority("normal");
      setSelectedAssetId("");
      setFiles([]);
      setSuccessState({
        ticket: createdTicket,
        failedUploads,
      });

      await onCreated(createdTicket);

      if (failedUploads.length > 0) {
        setError(
          `Talep oluşturuldu ama bazı dosyalar yüklenemedi: ${failedUploads.join(
            ", "
          )}`
        );
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  if (isContextLoading) {
    return (
      <section className="rounded-panel border border-border bg-surface-1 p-lg shadow-panel">
        <h2 className="text-h3 text-text-primary">Nasıl yardımcı olabiliriz?</h2>
        <p className="mt-sm text-body text-text-secondary">
          Bilgilerin yükleniyor. Zimmetli cihazların ve onay bilgilerin kontrol
          ediliyor.
        </p>
      </section>
    );
  }

  if (isContextError || !requesterContext) {
    return (
      <section className="rounded-panel border border-danger/30 bg-danger/10 p-lg shadow-panel">
        <div className="flex items-start gap-sm">
          <IconAlertTriangle size={20} className="mt-1 text-danger" />
          <div>
            <h2 className="text-h3 text-danger">Yardım formu yüklenemedi</h2>
            <p className="mt-sm text-body text-danger">
              Hesabın personel kaydıyla eşleşmemiş olabilir veya geçici bir
              bağlantı sorunu yaşanmış olabilir.
            </p>

            <button
              type="button"
              onClick={onRefreshContext}
              className="mt-md inline-flex items-center gap-xs rounded-app border border-danger/30 px-md py-sm text-body text-danger transition hover:bg-danger/10"
            >
              <IconRefresh size={16} aria-hidden={true} />
              Tekrar dene
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-panel border border-border bg-surface-1 p-lg shadow-panel">
      <div>
        <p className="text-caption font-semibold uppercase tracking-wide text-accent">
          Yeni yardım isteği
        </p>
        <h2 className="mt-xs text-h2 text-text-primary">
          Nasıl yardımcı olabiliriz?
        </h2>
        <p className="mt-sm text-body text-text-secondary">
          Sorunu IT diliyle anlatmak zorunda değilsin. Kısaca neye ihtiyacın
          olduğunu yazman yeterli.
        </p>
      </div>

      {requesterContext.approval_preview.requires_approval ? (
        <div className="mt-md rounded-2xl border border-warning/30 bg-warning-bg p-md text-body text-warning">
          <div className="flex gap-sm">
            <IconInfoCircle size={18} className="mt-1 shrink-0" />
            <p>
              Bu talep önce{" "}
              <strong>{requesterContext.approval_preview.approver_name}</strong>{" "}
              onayına gidecek. Onaylanınca IT ekibine düşecek.
            </p>
          </div>
        </div>
      ) : null}

      {successState ? (
        <div className="mt-md rounded-2xl border border-success/30 bg-success/10 p-md text-body text-success">
          <div className="flex gap-sm">
            <IconCheck size={18} className="mt-1 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="font-semibold">
                    Talebin alındı: #{successState.ticket.id}
                </p>
                <p className="mt-xs">
                    {successState.ticket.approval_status === "pending"
                    ? `Önce ${successState.ticket.pending_approver_name ?? "yöneticin"} onayına gidecek.`
                    : "IT ekibine iletildi. Durumu aşağıdaki listeden takip edebilirsin."}
                </p>
                <TicketProgressStepper
                ticket={successState.ticket}
                compact={false}
                className="mt-md"
                />
                
                {successState.failedUploads.length > 0 ? (
                    <p className="mt-md">
                        Ancak bazı dosyalar yüklenemedi:{" "}
                        {successState.failedUploads.join(", ")}
                    </p>
                ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <form className="mt-lg space-y-lg" onSubmit={handleSubmit}>
        <section>
          <label className="text-caption font-semibold text-text-secondary">
            Konu seç
          </label>

          <div className="mt-sm grid gap-sm sm:grid-cols-2">
            {requesterCategoryOptions.map((option) => {
              const isSelected = option.key === selectedCategoryKey;

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSelectedCategoryKey(option.key)}
                  className={`rounded-2xl border p-md text-left transition ${
                    isSelected
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-surface-0 text-text-primary hover:border-accent"
                  }`}
                >
                  <span className="text-2xl" aria-hidden={true}>
                    {option.icon}
                  </span>
                  <span className="mt-sm block font-semibold">{option.label}</span>
                  <span className="mt-xs block text-caption text-text-secondary">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-sm rounded-2xl border border-border bg-surface-2 p-md text-caption text-text-secondary">
            <strong>Hızlı ipucu:</strong> {selectedCategory.tip}
          </div>
        </section>

        <section>
          <label className="text-caption font-semibold text-text-secondary">
            Ne kadar acil?
          </label>

          <div className="mt-sm grid gap-sm">
            {requesterPriorityOptions.map((option) => {
              const isSelected = priority === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPriority(option.value)}
                  className={`rounded-2xl border p-md text-left transition ${
                    isSelected
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-surface-0 text-text-primary hover:border-accent"
                  }`}
                >
                  <span className="font-semibold">{option.label}</span>
                  <span className="mt-xs block text-caption text-text-secondary">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <label className="text-caption font-semibold text-text-secondary">
            Hangi cihazla ilgili?
          </label>

          <div className="mt-sm space-y-sm">
            <label className="flex cursor-pointer items-start gap-sm rounded-2xl border border-border bg-surface-0 p-md transition hover:border-accent">
              <input
                type="radio"
                name="asset"
                checked={selectedAssetId === ""}
                onChange={() => setSelectedAssetId("")}
                className="mt-1"
              />
              <span>
                <span className="block font-semibold text-text-primary">
                  Emin değilim / cihazla ilgili değil
                </span>
                <span className="mt-xs block text-caption text-text-secondary">
                  Hangi cihaz olduğunu bilmiyorsan bunu seçebilirsin.
                </span>
              </span>
            </label>

            {requesterContext.active_assignments.map((assignment) => (
              <label
                key={assignment.id}
                className="flex cursor-pointer items-start gap-sm rounded-2xl border border-border bg-surface-0 p-md transition hover:border-accent"
              >
                <input
                  type="radio"
                  name="asset"
                  checked={selectedAssetId === String(assignment.asset_id)}
                  onChange={() => setSelectedAssetId(String(assignment.asset_id))}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-text-primary">
                    {assignment.asset_name}
                  </span>
                  <span className="mt-xs block text-caption text-text-secondary">
                    {assignment.asset_display_identifier ||
                      assignment.asset_inventory_code ||
                      assignment.asset_serial_number ||
                      "Cihaz kodu yok"}
                    {assignment.asset_category
                      ? ` · ${assignment.asset_category}`
                      : ""}
                  </span>
                </span>
              </label>
            ))}

            {requesterContext.active_assignments.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface-2 p-md text-caption text-text-secondary">
                Üzerine zimmetli aktif cihaz görünmüyor. Sorun cihazla ilgiliyse
                açıklama alanında cihazı tarif edebilirsin.
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-md">
          <label>
            <span className="text-caption font-semibold text-text-secondary">
              Kısaca ne oldu?
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-xs w-full rounded-app border border-border bg-surface-0 px-md py-sm text-body text-text-primary outline-none transition placeholder:text-text-secondary focus:border-accent"
              placeholder="Örn. VPN'e bağlanamıyorum"
              required
            />
          </label>

          <label>
            <span className="text-caption font-semibold text-text-secondary">
              Biraz daha anlatır mısın?
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-xs min-h-[130px] w-full rounded-app border border-border bg-surface-0 px-md py-sm text-body text-text-primary outline-none transition placeholder:text-text-secondary focus:border-accent"
              placeholder="Ne zaman başladı, ekranda ne yazıyor, işini nasıl etkiliyor?"
              required
            />
          </label>
        </section>

        <section>
          <span className="text-caption font-semibold text-text-secondary">
            Ekran görüntüsü veya dosya ekle
          </span>

          <label
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="mt-sm flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-0 p-lg text-center transition hover:border-accent hover:bg-accent/5"
          >
            <IconUpload size={24} className="text-text-secondary" />
            <span className="mt-sm text-body font-semibold text-text-primary">
              Dosyayı buraya sürükle veya seç
            </span>
            <span className="mt-xs text-caption text-text-secondary">
              PNG, JPG/JPEG veya PDF · En fazla {limits?.max_file_size_mb ?? 5} MB
            </span>
            <input
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
              onChange={handleFileInputChange}
              className="sr-only"
            />
          </label>

          {files.length > 0 ? (
            <div className="mt-sm space-y-xs">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${file.lastModified}-${index}`}
                  className="flex items-center justify-between gap-sm rounded-app border border-border bg-surface-2 px-md py-sm text-caption text-text-secondary"
                >
                  <span className="inline-flex min-w-0 items-center gap-xs">
                    <IconPaperclip size={14} aria-hidden={true} />
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0">· {formatBytes(file.size)}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="rounded-full p-xs text-text-secondary transition hover:bg-danger/10 hover:text-danger"
                    aria-label="Dosyayı kaldır"
                  >
                    <IconX size={14} aria-hidden={true} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="rounded-app border border-danger/30 bg-danger-bg px-md py-sm text-body text-danger">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !title.trim() || !description.trim()}
          className="w-full rounded-app bg-accent px-md py-sm text-body font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Gönderiliyor..." : "Yardım isteğini gönder"}
        </button>
      </form>
    </section>
  );
}