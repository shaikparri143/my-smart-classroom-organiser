import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { register } from "../../services/auth";
import "./Auth.css";

export default function RegisterPage({ onNavigate, onAuthenticated }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const data = await register(fullName, email, password, role);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message || "Unable to create your account.");
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
          onClick={() => onNavigate("login")}
        >
          Sign in
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
            GET STARTED
          </div>

          <h1 style={{ marginTop: 16 }}>Create your account</h1>
          <p className="auth-card-description">
            Join ClassPilot to manage or participate in classroom activities.
          </p>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="register-name">Full name</label>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                placeholder="Enter your full name"
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="register-email">Email address</label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="register-role">I am joining as a</label>
              <select
                id="register-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>

            <div className="auth-field">
              <label htmlFor="register-password">Password</label>
              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="register-confirm">Confirm password</label>
              <input
                id="register-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="auth-button auth-button-primary auth-form-submit"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="auth-switch">
            Already have an account?{" "}
            <button
              className="auth-link"
              onClick={() => onNavigate("login")}
            >
              Sign in
            </button>
          </div>
        </section>
      </main>

      <footer className="auth-footer">
        © 2026 ClassPilot · Built for better classrooms
      </footer>
    </div>
  );
}