import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiRequest } from "../../services/api";
import { getAccessToken } from "../../services/auth";

const COLORS = ["#7969df", "#7ab2ff", "#f2a65a", "#31c48d", "#fb7185"];

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      setLoading(true);
      setError("");
      try {
        const payload = await apiRequest("/api/analytics/teacher", {
          token: getAccessToken(),
        });
        if (active) {
          setAnalytics(payload);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || "Unable to load analytics.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="course-empty" role="status">Loading analytics...</p>;
  }

  if (error) {
    return <p className="course-message course-error" role="alert">{error}</p>;
  }

  const summary = analytics?.summary ?? {};
  const courseBreakdown = analytics?.course_breakdown ?? [];
  const attendanceSummary = analytics?.attendance_summary ?? [];
  const assignmentTrend = analytics?.assignment_trend ?? [];

  const cards = [
    { label: "Courses taught", value: summary.total_courses ?? 0 },
    { label: "Unique students", value: summary.total_students ?? 0 },
    { label: "Assignments", value: summary.total_assignments ?? 0 },
    { label: "Submission rate", value: `${summary.submission_rate ?? 0}%` },
  ];

  return (
    <div className="course-management">
      <section className="stats-grid">
        {cards.map((item) => (
          <article className="panel stat-card" key={item.label}>
            <div className="stat-heading"><span>{item.label}</span></div>
            <div className="stat-value">{item.value}</div>
          </article>
        ))}
      </section>

      <section className="stats-grid">
        <article className="panel stat-card">
          <div className="stat-heading"><span>Pending reviews</span></div>
          <div className="stat-value">{summary.pending_submissions ?? 0}</div>
        </article>
        <article className="panel stat-card">
          <div className="stat-heading"><span>Average marks</span></div>
          <div className="stat-value">{Number(summary.average_marks ?? 0).toFixed(1)}</div>
        </article>
        <article className="panel stat-card">
          <div className="stat-heading"><span>Low attendance</span></div>
          <div className="stat-value">{summary.low_attendance_count ?? 0}</div>
        </article>
      </section>

      {courseBreakdown.length ? (
        <section className="panel" style={{ padding: 18 }}>
          <div className="panel-heading">
            <div>
              <h2>Course performance</h2>
              <p>Student performance and participation by course.</p>
            </div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseBreakdown}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="course_code" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="average_mark" radius={[6, 6, 0, 0]} fill="#7969df" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section className="stats-grid" style={{ marginTop: 18 }}>
        <article className="panel" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Assessment activity</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={assignmentTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="assignments" stroke="#7969df" strokeWidth={2} />
                <Line type="monotone" dataKey="submissions" stroke="#31c48d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Attendance rate</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={attendanceSummary} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                  {attendanceSummary.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, "Attendance"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="panel" style={{ padding: 18 }}>
        <div className="panel-heading">
          <div>
            <h2>Upcoming deadlines</h2>
            <p>Assignments due in the next 30 days.</p>
          </div>
        </div>
        {(summary.upcoming_deadlines ?? []).length ? (
          <ul className="course-roster" style={{ marginTop: 12 }}>
            {summary.upcoming_deadlines.map((item) => (
              <li key={item.assignment_id}>
                <strong>{item.title}</strong>
                <span>{item.course_title}</span>
                <small>{new Date(item.due_at).toLocaleString()}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="course-empty">No assignments are due in the next 30 days.</p>
        )}
      </section>
    </div>
  );
}
