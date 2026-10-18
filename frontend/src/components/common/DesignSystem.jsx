import { useCallback, useEffect, useId, useState } from "react";
import { Check, Cloud, Moon, Sun, X, Stars, CircleAlert, Info } from "lucide-react";
import { ToastContext } from "./designSystemContext";
import { useThemePreference } from "./useDesignSystem";

export function Toggle({ checked, onChange, label, disabled = false, loading = false, id }) {
  const generatedId = useId();
  const controlId = id || generatedId;
  return (
    <button
      id={controlId}
      type="button"
      className="cp-toggle"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      disabled={disabled || loading}
      onClick={() => onChange(!checked)}
    >
      <span className="cp-toggle-track" data-checked={checked}>
        <span className="cp-toggle-thumb" />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

export function ThemeSwitch() {
  const [theme, setTheme] = useThemePreference();
  const dark = theme === "dark";
  return (
    <button
      className="theme-switch"
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <span className="theme-toggle" data-theme={theme} aria-hidden="true">
        <span className="theme-sky">
          {dark ? <Stars size={14} /> : <Cloud size={15} />}
          {dark ? <Moon size={14} /> : <Sun size={15} />}
        </span>
        <span className="theme-toggle-knob">{dark ? <Moon size={15} /> : <Sun size={16} />}</span>
      </span>
      <span className="theme-switch-label">{dark ? "Night" : "Day"}</span>
    </button>
  );
}

export function GlassCard({ as: Element = "section", className = "", children, ...props }) {
  return <Element className={`cp-glass-card ${className}`.trim()} {...props}>{children}</Element>;
}

export function Button({ variant = "primary", loading = false, children, className = "", ...props }) {
  const disabled = loading || props.disabled;
  return (
    <button className={`cp-button cp-button-${variant} ${className}`.trim()} type={props.type || "button"} {...props} disabled={disabled}>
      {loading ? <span className="cp-spinner" aria-hidden="true" /> : children}
    </button>
  );
}

export function Input({ label, error, as: Element = "input", ...props }) {
  return (
    <label className="cp-input">
      <span>{label}</span>
      <Element aria-invalid={Boolean(error)} {...props} />
      {error && <span role="alert">{error}</span>}
    </label>
  );
}

export function Modal({ open, onClose, title, children, className = "" }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => event.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="cp-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section className={`cp-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></header>
        {children}
      </section>
    </div>
  );
}

export function Toast({ type = "info", children, onDismiss }) {
  const Icon = type === "success" ? Check : type === "error" ? CircleAlert : Info;
  return <div className={`cp-toast cp-toast-${type}`} role={type === "error" ? "alert" : "status"}><Icon size={18} /><p>{children}</p><button className="icon-button" type="button" aria-label="Dismiss notification" onClick={onDismiss}><X size={16} /></button></div>;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const pushToast = useCallback((message, type = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4800);
  }, []);
  const dismiss = (id) => setToasts((current) => current.filter((toast) => toast.id !== id));
  return (
    <ToastContext.Provider value={pushToast}>
      {children}
      <div className="cp-toast-region" aria-live="polite">
        {toasts.map((toast) => <Toast key={toast.id} type={toast.type} onDismiss={() => dismiss(toast.id)}>{toast.message}</Toast>)}
      </div>
    </ToastContext.Provider>
  );
}

export function Skeleton({ width = "100%", height = 14, className = "" }) {
  return <div className={`cp-skeleton ${className}`.trim()} style={{ width, height }} aria-hidden="true" />;
}

export function Tabs({ items, value, onChange, label = "Sections" }) {
  return <div className="cp-tabs" role="tablist" aria-label={label}>{items.map((item) => <button key={item.value} type="button" role="tab" aria-selected={value === item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}

export function ProgressRing({ value, size = 72, label }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <span className="cp-progress-ring" style={{ width: size, height: size }} role="img" aria-label={label || `${clamped}% complete`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs><linearGradient id="cp-progress-gradient"><stop stopColor="#8B5CF6" /><stop offset="1" stopColor="#E879F9" /></linearGradient></defs>
        <circle className="track" cx={size / 2} cy={size / 2} r={radius} />
        <circle className="value" cx={size / 2} cy={size / 2} r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped / 100)} />
      </svg>
      <span className="cp-progress-label">{clamped}%</span>
    </span>
  );
}

export function EmptyState({ title, description, action }) {
  return <div className="cp-empty-state"><Stars size={26} /><h3>{title}</h3><p>{description}</p>{action}</div>;
}
