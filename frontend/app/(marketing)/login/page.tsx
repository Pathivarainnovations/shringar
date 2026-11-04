"use client";

import { useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/components/i18n";
import { useAuth } from "@/lib/auth-context";
import { ROLE_HOME } from "@/lib/roles";
import { API_URL } from "@/lib/api";

type View = "signin" | "otp" | "signup" | "signup-code" | "forgot" | "reset";

function LoginForm() {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { reload, user } = useAuth();
  const redirect = searchParams.get("redirect") ?? "";

  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [referral, setReferral] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clearError = () => setError(null);

  const validateRedirect = (url: string) => {
    if (!url) return false;
    if (!url.startsWith("/")) return false;
    if (url.startsWith("//") || url.startsWith("http")) return false;
    return true;
  };

  const doRedirect = (role: string) => {
    const target = validateRedirect(redirect) ? redirect : ROLE_HOME[role as keyof typeof ROLE_HOME] ?? "/client";
    router.push(target);
    router.refresh();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("auth.signingIn"));
      await reload();
      doRedirect(data.user?.role ?? "customer");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.signingIn"));
    }
    setLoading(false);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setDevCode(data.devCode ?? null);
      setOtpSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      await reload();
      doRedirect(data.user?.role ?? "customer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setDevCode(data.devCode ?? null);
      setView("signup-code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    }
    setLoading(false);
  };

  const handleSignupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/signup/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          name: name.trim() || undefined,
          password,
          referral: referral.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      await reload();
      doRedirect(data.user?.role ?? "customer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setDevCode(data.devCode ?? null);
      setView("reset");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      await reload();
      doRedirect(data.user?.role ?? "customer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
    setLoading(false);
  };

  const renderSignIn = () => (
    <form onSubmit={handleSignIn} style={styles.form}>
      <input type="text" name="username" autoComplete="username" style={{ display: "none" }} />
      <div style={styles.field}>
        <label htmlFor="email" style={styles.label}>
          {t("auth.email")}
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value.toLowerCase()); clearError(); }}
          required
          disabled={loading}
          style={styles.input}
          autoComplete="email"
        />
      </div>
      <div style={styles.field}>
        <label htmlFor="password" style={styles.label}>
          {t("auth.password")}
        </label>
        <div style={styles.passwordWrapper}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearError(); }}
            required
            disabled={loading}
            style={styles.input}
            autoComplete="current-password"
          />
          <button
            type="button"
            style={styles.passwordToggle}
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <button type="submit" disabled={loading || !email.includes("@") || !password} style={styles.button}>
        {loading ? t("auth.signingIn") : t("auth.signIn")}
      </button>
      <div style={styles.links}>
        <button type="button" onClick={() => { setView("forgot"); setEmail(""); setCode(""); setNewPassword(""); setConfirmPassword(""); }} style={styles.link}>
          {t("auth.forgotPassword")}
        </button>
        <button type="button" onClick={() => { setView("otp"); setOtpSent(false); setCode(""); setName(""); clearError(); }} style={styles.link}>
          {t("auth.loginWithCode")}
        </button>
      </div>
      <div style={styles.divider}>
        <span>{t("auth.or")}</span>
      </div>
      <button type="button" onClick={() => { setView("signup"); setEmail(""); setPassword(""); setName(""); setCode(""); }} style={styles.secondaryButton}>
        {t("auth.signUp")}
      </button>
    </form>
  );

  const renderOtpVerify = () => (
    <form onSubmit={handleVerifyOtp} style={styles.form}>
      <div style={styles.field}>
        <label htmlFor="otp-email" style={styles.label}>
          {t("auth.email")}
        </label>
        <input
          id="otp-email"
          type="email"
          value={email}
          readOnly
          style={{ ...styles.input, background: "var(--bg)", color: "var(--muted)" }}
        />
      </div>
      <div style={styles.field}>
        <label htmlFor="otp-code" style={styles.label}>
          {t("auth.code")}
        </label>
        <input
          id="otp-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => { setCode(e.target.value); clearError(); }}
          required
          disabled={loading}
          style={styles.input}
          autoComplete="one-time-code"
        />
      </div>
      {devCode && (
        <p style={styles.devCode}>
          <strong>Dev code (development only): {devCode}</strong>
        </p>
      )}
      <div style={styles.field}>
        <label htmlFor="otp-name" style={styles.label}>
          {t("auth.name")} (if new account)
        </label>
        <input
          id="otp-name"
          type="text"
          placeholder={t("auth.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
          autoComplete="name"
        />
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <button type="submit" disabled={loading || code.length !== 6} style={styles.button}>
        {loading ? t("auth.verifying") : t("auth.signIn")}
      </button>
      <button type="button" onClick={() => { setOtpSent(false); setCode(""); clearError(); }} style={styles.backButton}>
        Use a different email
      </button>
    </form>
  );

  const renderOtp = () =>
    otpSent ? (
      renderOtpVerify()
    ) : (
      <form onSubmit={handleRequestOtp} style={styles.form}>
        <div style={styles.field}>
          <label htmlFor="otp-request-email" style={styles.label}>
            {t("auth.email")}
          </label>
          <input
            id="otp-request-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearError(); }}
            required
            disabled={loading}
            style={styles.input}
            autoComplete="email"
          />
        </div>
        {error && <div style={styles.error}>{error}</div>}
        <button type="submit" disabled={loading || !email.includes("@")} style={styles.button}>
          {loading ? t("auth.sendingCode") : t("auth.sendCode")}
        </button>
        <button type="button" onClick={() => { setView("signin"); setPassword(""); setCode(""); setName(""); clearError(); }} style={styles.backButton}>
          {t("auth.backToLogin")}
        </button>
      </form>
    );

  const renderSignup = () => (
    <form onSubmit={handleSignup} style={styles.form}>
      <div style={styles.field}>
        <label htmlFor="signup-name" style={styles.label}>
          {t("auth.name")}
        </label>
        <input
          id="signup-name"
          placeholder={t("auth.name")}
          value={name}
          onChange={(e) => { setName(e.target.value); clearError(); }}
          required
          disabled={loading}
          style={styles.input}
          autoComplete="name"
        />
      </div>
      <div style={styles.field}>
        <label htmlFor="signup-email" style={styles.label}>
          {t("auth.email")}
        </label>
        <input
          id="signup-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value.toLowerCase()); clearError(); }}
          required
          disabled={loading}
          style={styles.input}
          autoComplete="email"
        />
      </div>
      <div style={styles.field}>
        <label htmlFor="signup-referral" style={styles.label}>
          {t("auth.referralCode")}
        </label>
        <input
          id="signup-referral"
          placeholder="e.g. SHRK7M2QX"
          value={referral}
          onChange={(e) => { setReferral(e.target.value.toUpperCase()); clearError(); }}
          disabled={loading}
          style={styles.input}
          autoComplete="off"
          maxLength={20}
        />
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <button type="submit" disabled={loading || !name || !email.includes("@")} style={styles.button}>
        {loading ? t("auth.sendingCode") : t("auth.sendCode")}
      </button>
      <button type="button" onClick={() => { setView("signin"); setEmail(""); setPassword(""); setName(""); }} style={styles.backButton}>
        {t("auth.backToLogin")}
      </button>
    </form>
  );

  const renderSignupCode = () => (
    <form onSubmit={handleSignupVerify} style={styles.form}>
      <div style={styles.field}>
        <label htmlFor="signup-otp-email" style={styles.label}>
          {t("auth.email")}
        </label>
        <input
          id="signup-otp-email"
          type="email"
          value={email}
          readOnly
          style={{ ...styles.input, background: "var(--bg)", color: "var(--muted)" }}
        />
      </div>
      <div style={styles.field}>
        <label htmlFor="signup-otp-code" style={styles.label}>
          {t("auth.code")}
        </label>
        <input
          id="signup-otp-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => { setCode(e.target.value); clearError(); }}
          required
          disabled={loading}
          style={styles.input}
          autoComplete="one-time-code"
        />
      </div>
      {devCode && (
        <p style={styles.devCode}>
          <strong>Dev code (development only): {devCode}</strong>
        </p>
      )}
      <div style={styles.field}>
        <label htmlFor="signup-password" style={styles.label}>
          {t("auth.password")}
        </label>
        <div style={styles.passwordWrapper}>
          <input
            id="signup-password"
            type={showNewPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearError(); }}
            required
            disabled={loading}
            style={styles.input}
            autoComplete="new-password"
            minLength={8}
          />
          <button
            type="button"
            style={styles.passwordToggle}
            onClick={() => setShowNewPassword(!showNewPassword)}
            aria-label={showNewPassword ? "Hide password" : "Show password"}
          >
            {showNewPassword ? "🙈" : "👁️"}
          </button>
        </div>
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <button type="submit" disabled={loading || code.length !== 6 || password.length < 8} style={styles.button}>
        {loading ? t("auth.creatingAccount") : t("auth.signUp")}
      </button>
      <button type="button" onClick={() => { setView("signup"); setCode(""); setPassword(""); }} style={styles.backButton}>
        {t("auth.backToLogin")}
      </button>
    </form>
  );

  const renderForgot = () => (
    <form onSubmit={handleForgot} style={styles.form}>
      <p style={styles.sub}>{t("auth.forgotSub")}</p>
      <div style={styles.field}>
        <label htmlFor="forgot-email" style={styles.label}>
          {t("auth.email")}
        </label>
        <input
          id="forgot-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value.toLowerCase()); clearError(); }}
          required
          disabled={loading}
          style={styles.input}
          autoComplete="email"
        />
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <button type="submit" disabled={loading || !email.includes("@")} style={styles.button}>
        {loading ? t("auth.sendingCode") : t("auth.sendCode")}
      </button>
      <button type="button" onClick={() => { setView("signin"); setEmail(""); }} style={styles.backButton}>
        {t("auth.backToLogin")}
      </button>
    </form>
  );

  const renderReset = () => (
    <form onSubmit={handleReset} style={styles.form}>
      <p style={styles.sub}>{t("auth.resetSub")}</p>
      <div style={styles.field}>
        <label htmlFor="reset-email" style={styles.label}>
          {t("auth.email")}
        </label>
        <input
          id="reset-email"
          type="email"
          value={email}
          readOnly
          style={{ ...styles.input, background: "var(--bg)", color: "var(--muted)" }}
        />
      </div>
      <div style={styles.field}>
        <label htmlFor="reset-code" style={styles.label}>
          {t("auth.code")}
        </label>
        <input
          id="reset-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => { setCode(e.target.value); clearError(); }}
          required
          disabled={loading}
          style={styles.input}
          autoComplete="one-time-code"
        />
      </div>
      {devCode && (
        <p style={styles.devCode}>
          <strong>Dev code (development only): {devCode}</strong>
        </p>
      )}
      <div style={styles.field}>
        <label htmlFor="reset-new-password" style={styles.label}>
          {t("auth.newPassword")}
        </label>
        <div style={styles.passwordWrapper}>
          <input
            id="reset-new-password"
            type={showNewPassword ? "text" : "password"}
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); clearError(); }}
            required
            disabled={loading}
            style={styles.input}
            autoComplete="new-password"
            minLength={8}
          />
          <button
            type="button"
            style={styles.passwordToggle}
            onClick={() => setShowNewPassword(!showNewPassword)}
            aria-label={showNewPassword ? "Hide password" : "Show password"}
          >
            {showNewPassword ? "🙈" : "👁️"}
          </button>
        </div>
      </div>
      <div style={styles.field}>
        <label htmlFor="reset-confirm-password" style={styles.label}>
          {t("auth.confirmPassword")}
        </label>
        <div style={styles.passwordWrapper}>
          <input
            id="reset-confirm-password"
            type={showNewPassword ? "text" : "password"}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); clearError(); }}
            required
            disabled={loading}
            style={styles.input}
            autoComplete="new-password"
            minLength={8}
          />
          <button
            type="button"
            style={styles.passwordToggle}
            onClick={() => setShowNewPassword(!showNewPassword)}
            aria-label={showNewPassword ? "Hide password" : "Show password"}
          >
            {showNewPassword ? "🙈" : "👁️"}
          </button>
        </div>
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <button type="submit" disabled={loading || code.length !== 6 || newPassword.length < 8 || newPassword !== confirmPassword} style={styles.button}>
        {loading ? t("auth.resetting") : t("auth.resetTitle")}
      </button>
      <button type="button" onClick={() => { setView("forgot"); setCode(""); setNewPassword(""); setConfirmPassword(""); }} style={styles.backButton}>
        {t("auth.backToLogin")}
      </button>
    </form>
  );

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoText}>Shringar</span>
          <span style={styles.logoDot} aria-hidden="true" />
        </div>
        <h1 style={styles.h1}>
          {view === "signin" && t("auth.loginTitle")}
          {view === "otp" && (otpSent ? t("auth.verifyTitle") : t("auth.codeLoginTitle"))}
          {view === "signup" && t("auth.signupTitle")}
          {view === "signup-code" && t("auth.verifyTitle")}
          {view === "forgot" && t("auth.forgotTitle")}
          {view === "reset" && t("auth.resetTitle")}
        </h1>
        <p style={styles.sub}>
          {view === "signin" && t("auth.loginSub")}
          {view === "otp" && (otpSent ? t("auth.verifySub") : t("auth.codeLoginSub"))}
          {view === "signup" && t("auth.signupSub")}
          {view === "signup-code" && t("auth.verifySub")}
        </p>

        {view === "signin" && renderSignIn()}
        {view === "otp" && renderOtp()}
        {view === "signup" && renderSignup()}
        {view === "signup-code" && renderSignupCode()}
        {view === "forgot" && renderForgot()}
        {view === "reset" && renderReset()}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={styles.loading}>Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    minHeight: "100vh",
    background: "#F2F7EC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    margin: "0 auto",
    background: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    boxShadow: "0 4px 24px rgba(14, 59, 44, 0.08)",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    marginBottom: 24,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 700,
    color: "#0E3B2C",
    letterSpacing: "-0.5px",
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#C6F24E",
    border: "2px solid #FFFFFF",
    boxShadow: "0 0 0 2px #0E3B2C",
  },
  h1: {
    fontSize: 24,
    fontWeight: 700,
    color: "#0E3B2C",
    margin: "0 0 8px",
    textAlign: "center",
  },
  sub: {
    fontSize: 15,
    color: "#6B7A6F",
    margin: "0 0 24px",
    textAlign: "center",
  },
  error: {
    background: "#FEF2F2",
    color: "#DC2626",
    padding: "12px 16px",
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 14,
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: "#0E3B2C",
  },
  input: {
    padding: "14px 16px",
    borderRadius: 10,
    border: "1.5px solid #D8E8D0",
    fontSize: 16,
    color: "#0E3B2C",
    background: "#FAFCF8",
    transition: "border-color 0.2s, box-shadow 0.2s",
    outline: "none",
  },
  passwordWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  passwordToggle: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--muted)",
    fontSize: 18,
    lineHeight: 1,
    padding: 0,
  },
  button: {
    marginTop: 8,
    padding: "14px 24px",
    borderRadius: 10,
    border: "none",
    background: "#0E3B2C",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s, transform 0.1s",
  },
  backButton: {
    marginTop: 12,
    padding: "12px 24px",
    borderRadius: 10,
    border: "1.5px solid #D8E8D0",
    background: "#FFFFFF",
    color: "#0E3B2C",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  secondaryButton: {
    marginTop: 12,
    padding: "14px 24px",
    borderRadius: 10,
    border: "1.5px solid #D8E8D0",
    background: "#FFFFFF",
    color: "#0E3B2C",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  links: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 4,
  },
  link: {
    background: "none",
    border: "none",
    color: "#0E3B2C",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
    color: "var(--muted)",
    fontSize: 14,
  },
  devCode: {
    fontSize: 13,
    color: "#0E3B2C",
    textAlign: "center",
    margin: "4px 0 8px",
    padding: "8px 12px",
    background: "#F0F7EB",
    borderRadius: 8,
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    color: "#6B7A6F",
  },
};