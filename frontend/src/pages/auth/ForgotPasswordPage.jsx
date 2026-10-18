import { useState } from "react";
import { GraduationCap } from "lucide-react";
import "./Auth.css";

export default function ForgotPasswordPage({ onNavigate }) {
  const [email, setEmail] = useState("");

  return (
    <div className="auth-page">
      <header className="auth-nav">
        <button
          className="auth-brand"
          style={{ border: 0, background: "transparent", cursor: "pointer" }}
          onClick={() => onNavigate("landing")}
        >
          <span className="auth-brand-mark">
            <GraduationCap size={23} />
          </span>
          <span>
            ClassPilot<span style={{ color: "#6958df" }}>.</span>
            <small>CLASSROOM MANAGEMENT</small>
          </span>
        </button>
      </header>

      <main className="auth-form-layout">
        <section className="auth-card">
          <button
            className="auth-link auth-back"
            onClick={() => onNavigate("login")}
          >
            ← Back to sign in
          </button>

          <div className="auth-eyebrow">
            <span className="auth-eyebrow-dot" />
            ACCOUNT RECOVERY
          </div>

          <h1 style={{ marginTop: 16 }}>Forgot your password?</h1>

          <p className="auth-card-description">
            Enter the email associated with your ClassPilot account.
          </p>

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <div className="auth-field">
              <label htmlFor="recovery-email">Email address</label>
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="auth-info">
              Email-based password recovery is not configured yet. No reset
              email will be sent from this page until the backend recovery
              endpoint and email service are implemented.
            </div>

            <button
              type="button"
              className="auth-button auth-button-primary auth-form-submit"
              onClick={() => onNavigate("login")}
            >
              Return to sign in
            </button>
          </form>
        </section>
      </main>

      <footer className="auth-footer">
        © 2026 ClassPilot · Account support
      </footer>
    </div>
  );
}