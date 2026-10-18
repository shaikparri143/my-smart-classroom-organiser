import { GraduationCap, ArrowRight, BookOpen, Users, BrainCircuit } from "lucide-react";
import "./Auth.css";

export default function LandingPage({ onNavigate, notice }) {
  return (
    <div className="auth-page">
      <header className="auth-nav">
        <div className="auth-brand">
          <div className="auth-brand-mark">
            <GraduationCap size={23} />
          </div>
          <div>
            ClassPilot<span style={{ color: "#6958df" }}>.</span>
            <small>CLASSROOM MANAGEMENT</small>
          </div>
        </div>

        <div className="auth-nav-actions">
          <button
            className="auth-button"
            onClick={() => onNavigate("login")}
          >
            Log in
          </button>
          <button
            className="auth-button auth-button-primary"
            onClick={() => onNavigate("register")}
          >
            Get started
          </button>
        </div>
      </header>

      <main className="auth-hero">
        <section>
          {notice && (
            <div className="auth-error" role="alert">
              {notice}
            </div>
          )}

          <div className="auth-eyebrow">
            <span className="auth-eyebrow-dot" />
            YOUR SMARTER CLASSROOM STARTS HERE
          </div>

          <h1>
            Teach smarter.
            <br />
            Learn better.
            <br />
            <span className="auth-gradient-text">Do more with less.</span>
          </h1>

          <p className="auth-hero-copy">
            One connected workspace for courses, attendance, assignments,
            student progress and AI-powered teaching support.
          </p>

          <div className="auth-hero-actions">
            <button
              className="auth-button auth-button-primary"
              onClick={() => onNavigate("register")}
            >
              Create your account <ArrowRight size={16} />
            </button>

            <button
              className="auth-button"
              onClick={() => onNavigate("login")}
            >
              Sign in
            </button>
          </div>

          <div className="auth-feature-list">
            <div className="auth-feature">
              <span className="auth-feature-mark">
                <BookOpen size={16} />
              </span>
              Manage courses and assignments in one place
            </div>
            <div className="auth-feature">
              <span className="auth-feature-mark">
                <Users size={16} />
              </span>
              Keep track of classroom activity and attendance
            </div>
            <div className="auth-feature">
              <span className="auth-feature-mark">
                <BrainCircuit size={16} />
              </span>
              Explore AI-assisted teaching tools
            </div>
          </div>
        </section>

        <section className="auth-preview">
          <div className="auth-preview-top">
            <div className="auth-preview-title">Classroom overview</div>
            <span className="auth-preview-label">WORKSPACE PREVIEW</span>
          </div>

          <div className="auth-preview-stats">
            <div className="auth-preview-stat">
              <span>Courses</span>
              <strong>Organized</strong>
            </div>
            <div className="auth-preview-stat">
              <span>Attendance</span>
              <strong>Trackable</strong>
            </div>
            <div className="auth-preview-stat">
              <span>Assignments</span>
              <strong>Managed</strong>
            </div>
            <div className="auth-preview-stat">
              <span>Progress</span>
              <strong>Visible</strong>
            </div>
          </div>

          <div className="auth-preview-chart">
            Your classroom tools, connected in one workspace.
          </div>
        </section>
      </main>

      <footer className="auth-footer">
        © 2026 ClassPilot · Classroom management, reimagined.
      </footer>
    </div>
  );
}