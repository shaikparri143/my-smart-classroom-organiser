import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { login } from "../../services/auth";
import "./Auth.css";

export default function LoginPage({ onNavigate, onAuthenticated, notice = "" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(email, password);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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

        <button
          className="auth-button"
          onClick={() => onNavigate("register")}
        >
          Create account
        </button>
      </header>

      <main className="auth-form-layout">
        <section className="auth-card">
          <button
            className="auth-link auth-back"
            onClick={() => onNavigate("landing")}
          >
            ← Back to home
          </button>

          <div className="auth-eyebrow">
            <span className="auth-eyebrow-dot" />
            WELCOME BACK
          </div>

          <h1 style={{ marginTop: 16 }}>Sign in to ClassPilot</h1>
          <p className="auth-card-description">
            Enter your account details to continue to your classroom workspace.
          </p>

          {(error || notice) && (
            <div className="auth-error" role="alert">
              {error || notice}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <div className="auth-form-row">
              <button
                type="button"
                className="auth-link"
                onClick={() => onNavigate("forgot")}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="auth-button auth-button-primary auth-form-submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in to your account"}
            </button>
          </form>

          <div className="auth-switch">
            New to ClassPilot?{" "}
            <button
              className="auth-link"
              onClick={() => onNavigate("register")}
            >
              Create an account
            </button>
          </div>
        </section>
      </main>

      <footer className="auth-footer">
        © 2026 ClassPilot · Secure classroom access
      </footer>
    </div>
  );
}