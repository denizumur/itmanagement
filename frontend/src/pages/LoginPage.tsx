import { useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import {
  IconChevronRight,
  IconLock,
  IconServerCog,
  IconShieldCheck,
  IconSparkles,
  IconUser,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthContext";

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

const particles = [
  { left: "12%", top: "18%", delay: "0s" },
  { left: "18%", top: "78%", delay: "1.2s" },
  { left: "38%", top: "12%", delay: "2.1s" },
  { left: "62%", top: "20%", delay: "0.8s" },
  { left: "74%", top: "68%", delay: "2.7s" },
  { left: "88%", top: "36%", delay: "1.7s" },
  { left: "48%", top: "86%", delay: "3.2s" },
];

const containerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: "easeOut",
    },
  },
};

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [ripples, setRipples] = useState<Ripple[]>([]);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    try {
      await login(username, password);
    } catch {
      setErrorMessage("Kullanıcı adı veya şifre hatalı.");
    }
  }

  function handleButtonMouseDown(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const id = Date.now();

    const ripple = {
      id,
      size,
      x: event.clientX - rect.left - size / 2,
      y: event.clientY - rect.top - size / 2,
    };

    setRipples((currentRipples) => [...currentRipples, ripple]);

    window.setTimeout(() => {
      setRipples((currentRipples) =>
        currentRipples.filter((currentRipple) => currentRipple.id !== id)
      );
    }, 650);
  }

  return (
    <main className="login-page flex min-h-screen items-center justify-center p-lg">
      <div className="login-bg" aria-hidden="true" />
      <div className="login-vignette" aria-hidden="true" />

      <motion.div
        className="login-blob login-blob-a"
        aria-hidden="true"
        animate={{
          x: [0, 34, -12, 0],
          y: [0, 22, 36, 0],
          scale: [1, 1.08, 0.96, 1],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="login-blob login-blob-b"
        aria-hidden="true"
        animate={{
          x: [0, -28, 22, 0],
          y: [0, -18, -34, 0],
          scale: [1, 0.92, 1.08, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="login-blob login-blob-c"
        aria-hidden="true"
        animate={{
          x: [0, 18, -20, 0],
          y: [0, 32, 8, 0],
          scale: [1, 1.12, 0.96, 1],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {particles.map((particle) => (
        <span
          key={`${particle.left}-${particle.top}`}
          className="login-particle"
          style={{
            left: particle.left,
            top: particle.top,
            animationDelay: particle.delay,
          }}
          aria-hidden="true"
        />
      ))}

      <section className="relative z-10 grid w-full max-w-6xl items-center gap-xl lg:grid-cols-[1fr_auto]">
        <motion.div
          className="hidden max-w-[var(--login-hero-max-width)] text-surface-1 lg:block"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-sm rounded-full border border-[color:var(--login-glass-border)] bg-[color:var(--login-glass-bg)] px-md py-sm text-caption backdrop-blur-xl"
          >
            <IconSparkles size={16} aria-hidden="true" />
            Self-hosted IT operasyon paneli
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="mt-lg text-[44px] font-medium leading-tight"
          >
            Envanteri, zimmeti ve kritik hatırlatıcıları tek yerden yönet.
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-md max-w-xl text-body leading-7 text-[color:color-mix(in_srgb,var(--surface-1)_78%,transparent)]"
          >
            Garanti, bakım ve lisans risklerini kaçırmadan takip etmek için
            güvenli, RBAC destekli ve gerçek operasyon odaklı yönetim ekranı.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="mt-lg grid gap-md sm:grid-cols-3"
          >
            <div className="rounded-panel border border-[color:var(--login-glass-border)] bg-[color:var(--login-glass-bg)] p-md backdrop-blur-xl">
              <IconServerCog size={20} aria-hidden="true" />
              <p className="mt-sm text-caption">Self-hosted</p>
            </div>

            <div className="rounded-panel border border-[color:var(--login-glass-border)] bg-[color:var(--login-glass-bg)] p-md backdrop-blur-xl">
              <IconShieldCheck size={20} aria-hidden="true" />
              <p className="mt-sm text-caption">JWT + RBAC</p>
            </div>

            <div className="rounded-panel border border-[color:var(--login-glass-border)] bg-[color:var(--login-glass-bg)] p-md backdrop-blur-xl">
              <IconSparkles size={20} aria-hidden="true" />
              <p className="mt-sm text-caption">Reminder-ready</p>
            </div>
          </motion.div>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          className="login-glass-card rounded-panel p-xl"
          variants={containerVariants}
          initial="hidden"
          animate="show"
          whileHover={{
            scale: 1.012,
            y: -4,
          }}
          transition={{
            type: "spring",
            stiffness: 240,
            damping: 22,
          }}
        >
          <motion.div variants={itemVariants} className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--login-glass-border)] bg-[color:var(--login-glass-bg-strong)] text-accent shadow-panel backdrop-blur-xl">
              <IconShieldCheck size={28} aria-hidden="true" />
            </div>

            <h1 className="mt-md text-display text-text-primary">Giriş yap</h1>
            <p className="mt-sm text-caption text-text-secondary">
              IT Envanter & Yönetim Platformu
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-lg">
            <label
              className="block text-caption text-text-secondary"
              htmlFor="username"
            >
              Kullanıcı adı
            </label>

            <div className="login-input-shell mt-sm flex items-center gap-md rounded-app px-md py-sm">
              <IconUser
                size={18}
                className="text-text-secondary"
                aria-hidden="true"
              />
              <input
                id="username"
                className="min-w-0 flex-1 bg-transparent text-text-primary placeholder:text-text-secondary focus:outline-none"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="Kullanıcı adını gir"
              />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-md">
            <label
              className="block text-caption text-text-secondary"
              htmlFor="password"
            >
              Şifre
            </label>

            <div className="login-input-shell mt-sm flex items-center gap-md rounded-app px-md py-sm">
              <IconLock
                size={18}
                className="text-text-secondary"
                aria-hidden="true"
              />
              <input
                id="password"
                type="password"
                className="min-w-0 flex-1 bg-transparent text-text-primary placeholder:text-text-secondary focus:outline-none"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Şifreni gir"
              />
            </div>
          </motion.div>

          <AnimatePresence>
            {errorMessage && (
              <motion.p
                className="mt-md rounded-app border border-danger bg-danger-bg px-md py-sm text-caption text-danger"
                initial={{
                  opacity: 0,
                  y: -8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -8,
                }}
              >
                {errorMessage}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            className="login-primary-button mt-lg flex w-full items-center justify-center gap-sm rounded-app px-md py-md text-body font-medium text-surface-1"
            onMouseDown={handleButtonMouseDown}
            whileTap={{
              scale: 0.97,
            }}
          >
            {ripples.map((ripple) => (
              <motion.span
                key={ripple.id}
                className="login-button-ripple"
                style={{
                  width: ripple.size,
                  height: ripple.size,
                  left: ripple.x,
                  top: ripple.y,
                }}
                initial={{
                  scale: 0,
                  opacity: 0.55,
                }}
                animate={{
                  scale: 1,
                  opacity: 0,
                }}
                transition={{
                  duration: 0.65,
                  ease: "easeOut",
                }}
              />
            ))}

            <span className="relative z-10">Giriş yap</span>
            <IconChevronRight
              size={18}
              className="relative z-10"
              aria-hidden="true"
            />
          </motion.button>

          <motion.p
            variants={itemVariants}
            className="mt-md text-center text-caption text-text-secondary"
          >
            Access token memory’de, refresh token httpOnly cookie’de tutulur.
          </motion.p>
        </motion.form>
      </section>
    </main>
  );
}