import { useState } from "react";
import type { FormEvent } from "react";
import { IconLock, IconShieldCheck } from "@tabler/icons-react";
import { Link, useSearchParams } from "react-router";
import { acceptUserInvitation } from "../api/accounts";

export function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [errorMessage, setErrorMessage] = useState(token ? "" : "Davet token bulunamadı.");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!token) {
      setErrorMessage("Davet token bulunamadı.");
      return;
    }

    if (!password || !passwordConfirm) {
      setErrorMessage("Şifre alanları zorunludur.");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("Şifre tekrarı eşleşmiyor.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await acceptUserInvitation(token, password, passwordConfirm);
      setSuccessMessage(response.detail || "Hesap aktive edildi.");
      setPassword("");
      setPasswordConfirm("");
    } catch {
      setErrorMessage("Davet geçersiz, süresi dolmuş veya şifre güvenlik kurallarını karşılamıyor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page flex min-h-screen items-center justify-center p-lg">
      <div className="login-bg" aria-hidden="true" />
      <div className="login-vignette" aria-hidden="true" />

      <form onSubmit={handleSubmit} className="login-glass-card relative z-10 w-full max-w-md rounded-panel p-xl">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--login-glass-border)] bg-[color:var(--login-glass-bg-strong)] text-accent shadow-panel backdrop-blur-xl">
            <IconShieldCheck size={28} aria-hidden="true" />
          </div>
          <h1 className="mt-md text-display text-text-primary">Hesabı aktive et</h1>
          <p className="mt-sm text-caption text-text-secondary">
            Yeni şifreni belirledikten sonra giriş sayfasından oturum açabilirsin.
          </p>
        </div>

        <label className="mt-lg block text-caption text-text-secondary" htmlFor="activation-password">
          Yeni şifre
        </label>
        <div className="login-input-shell mt-sm flex items-center gap-md rounded-app px-md py-sm">
          <IconLock size={18} className="text-text-secondary" aria-hidden="true" />
          <input
            id="activation-password"
            data-testid="activate-account-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-text-primary placeholder:text-text-secondary focus:outline-none"
            autoComplete="new-password"
          />
        </div>

        <label className="mt-md block text-caption text-text-secondary" htmlFor="activation-password-confirm">
          Yeni şifre tekrar
        </label>
        <div className="login-input-shell mt-sm flex items-center gap-md rounded-app px-md py-sm">
          <IconLock size={18} className="text-text-secondary" aria-hidden="true" />
          <input
            id="activation-password-confirm"
            data-testid="activate-account-password-confirm"
            type="password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-text-primary placeholder:text-text-secondary focus:outline-none"
            autoComplete="new-password"
          />
        </div>

        {errorMessage ? (
          <p
            data-testid="activate-account-error"
            className="mt-md rounded-app border border-danger bg-danger-bg px-md py-sm text-caption text-danger"
          >
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <div
            data-testid="activate-account-success"
            className="mt-md rounded-app border border-success/30 bg-success-bg px-md py-sm text-caption text-success"
          >
            {successMessage}
            <Link className="ml-sm font-semibold underline" to="/login">
              Giriş sayfasına dön
            </Link>
          </div>
        ) : null}

        <button
          type="submit"
          data-testid="activate-account-submit"
          disabled={isSubmitting || Boolean(successMessage)}
          className="login-primary-button mt-lg flex w-full items-center justify-center rounded-app px-md py-md text-body font-medium text-surface-1 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Aktive ediliyor" : "Hesabı aktive et"}
        </button>
      </form>
    </main>
  );
}
