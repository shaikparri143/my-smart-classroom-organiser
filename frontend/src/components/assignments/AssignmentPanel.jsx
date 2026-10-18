import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, ClipboardCheck } from "lucide-react";
import { apiRequest } from "../../services/api";
import { getAccessToken } from "../../services/auth";
import usePollingResource from "../../hooks/usePollingResource";
import AssignmentDetailsModal from "./AssignmentDetailsModal";
import AssignmentRecipientPicker from "./AssignmentRecipientPicker";

function formatDate(value) {
  if (!value) {
    return "No due date";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString();
}

function AssignmentCountdown({ dueAt }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!dueAt) {
    return <span>No due date</span>;
  }
  const remaining = new Date(dueAt).getTime() - now;
  if (!Number.isFinite(remaining)) {
    return <span>Due date unavailable</span>;
  }
  if (remaining <= 0) {
    return <span>{remaining > -1000 ? "Due now" : "Overdue"}</span>;
  }

  const seconds = Math.floor(remaining / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return (
    <span>
      {days}d {String(hours).padStart(2, "0")}h {String(minutes).padStart(2, "0")}m{" "}
      {String(remainder).padStart(2, "0")}s remaining
    </span>
  );
}

export default function AssignmentPanel({
  role,
  courses = [],
  coursesLoading = false,
  coursesError = "",
}) {
  const loadAssignments = useCallback(
    (signal) =>
      apiRequest(`/api/assignments/${role}`, {
        token: getAccessToken(),
        signal,
      }),
    [role],
  );
  const {
    data: assignments,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
  } = usePollingResource(loadAssignments, 12000);
  const [form, setForm] = useState({
    course_id: "",
    title: "",
    description: "",
    due_at: "",
    max_points: "100",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [recipientStudentIds, setRecipientStudentIds] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const mutationControllerRef = useRef(null);
  const selectedAssignment = assignments.find(
    (assignment) => assignment.id === selectedAssignmentId,
  );

  useEffect(
    () => () => mutationControllerRef.current?.abort(),
    [],
  );

  async function handleCreateAssignment(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setNotice("");
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    try {
      await apiRequest("/api/assignments", {
        method: "POST",
        token: getAccessToken(),
        signal: controller.signal,
        body: {
          course_id: Number(form.course_id || courses[0]?.id),
          title: form.title.trim(),
          description: form.description.trim(),
          due_at: new Date(form.due_at).toISOString(),
          max_points: Number(form.max_points),
          recipient_student_ids: recipientStudentIds,
        },
      });
      if (controller.signal.aborted) {
        return;
      }
      setForm((current) => ({
        ...current,
        title: "",
        description: "",
        due_at: "",
        max_points: "100",
      }));
      setRecipientStudentIds([]);
      setNotice("Assignment created successfully.");
      await refresh(true);
    } catch (requestError) {
      if (!controller.signal.aborted && requestError.name !== "AbortError") {
        setFormError(requestError.message || "Unable to create this assignment.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setSaving(false);
      }
    }
  }

  return (
    <div className="course-management assignment-management">
      {role === "teacher" && (
        <section className="panel course-form-panel">
          <div className="panel-heading">
            <div>
              <h2>Create an assignment</h2>
              <p>Assignments are saved for students enrolled in the selected course.</p>
            </div>
          </div>
          {coursesError && (
            <p className="course-message course-error" role="alert">
              Courses could not be loaded: {coursesError}
            </p>
          )}
          {formError && <p className="course-message course-error" role="alert">{formError}</p>}
          {notice && <p className="course-message course-success" role="status">{notice}</p>}
          {coursesLoading ? (
            <p className="course-empty" role="status">Loading your courses...</p>
          ) : courses.length === 0 ? (
            <p className="course-empty">Create a course before adding an assignment.</p>
          ) : (
            <form className="course-form assignment-form" onSubmit={handleCreateAssignment}>
              <label>
                Course
                <select
                  value={form.course_id || String(courses[0]?.id || "")}
                  onChange={(event) => {
                    setForm({ ...form, course_id: event.target.value });
                    setRecipientStudentIds([]);
                  }}
                  required
                  disabled={coursesLoading || courses.length === 0 || saving}
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} — {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  minLength={2}
                  maxLength={200}
                  required
                  disabled={saving}
                />
              </label>
              <label className="course-description-field">
                Instructions
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  maxLength={10000}
                  rows={4}
                  required
                  disabled={saving}
                />
              </label>
              <label>
                Due date and time
                <input
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(event) => setForm({ ...form, due_at: event.target.value })}
                  required
                  disabled={saving}
                />
              </label>
              <label>
                Maximum marks
                <input
                  type="number"
                  value={form.max_points}
                  onChange={(event) => setForm({ ...form, max_points: event.target.value })}
                  min="0.01"
                  max="100000"
                  step="0.01"
                  required
                  disabled={saving}
                />
              </label>
              <AssignmentRecipientPicker
                courseId={Number(form.course_id || courses[0]?.id)}
                selectedStudentIds={recipientStudentIds}
                onSelectionChange={setRecipientStudentIds}
                disabled={saving}
              />
              <button
                className="button-primary"
                type="submit"
                disabled={
                  saving ||
                  coursesLoading ||
                  courses.length === 0 ||
                  recipientStudentIds.length === 0
                }
              >
                {saving ? "Creating assignment..." : "Create assignment"}
              </button>
            </form>
          )}
        </section>
      )}

      <section className="course-list-section assignment-list-section">
        <div className="panel-heading">
          <div>
            <h2>{role === "teacher" ? "Your assignments" : "Course assignments"}</h2>
            <p>
              {role === "teacher"
                ? "Assignments for courses you teach."
                : "Assignments for your enrolled courses."}
            </p>
          </div>
          <span className="course-refresh-status" aria-live="polite">
            {refreshing ? "Updating..." : lastUpdated ? "Up to date" : ""}
          </span>
        </div>
        {error && <p className="course-message course-error" role="alert">{error}</p>}
        {loading ? (
          <p className="course-empty" role="status">Loading assignments...</p>
        ) : error && assignments.length === 0 ? (
          <p className="course-empty" role="status">
            Assignments could not be loaded. The dashboard will retry automatically.
          </p>
        ) : assignments.length === 0 ? (
          <p className="course-empty">
            {role === "teacher"
              ? "No assignments have been created for your courses yet."
              : "There are no assignments for your enrolled courses yet."}
          </p>
        ) : (
          <div className="course-card-grid">
            {assignments.map((assignment) => (
              <article
                className={`panel course-card assignment-card ${
                  role === "student"
                    ? assignment.submission
                      ? "assignment-submitted"
                      : "assignment-not-submitted"
                    : ""
                }`}
                key={assignment.id}
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                aria-label={`${role === "teacher" ? "Review submissions for" : "Open"} ${assignment.title}`}
                onClick={() => setSelectedAssignmentId(assignment.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedAssignmentId(assignment.id);
                  }
                }}
              >
                <div>
                  <span className="course-code">
                    {assignment.course_code} · {assignment.course_title}
                  </span>
                  <div className="assignment-title-row">
                    <h3 className="assignment-title">{assignment.title}</h3>
                    {role === "student" && (
                      assignment.submission ? (
                        <span className="assignment-status-pill">
                          {assignment.grade
                            ? "Graded"
                            : assignment.submission.status === "resubmitted"
                              ? "Resubmitted"
                              : assignment.submission.status === "late"
                                ? "Submitted late"
                                : "Submitted"}
                        </span>
                      ) : (
                        <span className="assignment-countdown">
                          <AssignmentCountdown dueAt={assignment.due_at} />
                        </span>
                      )
                    )}
                  </div>
                </div>
                <p className="course-card-description">
                  {assignment.description || "No instructions provided."}
                </p>
                <div className="assignment-meta">
                  {role === "teacher" ? (
                    <span><CalendarDays size={15} /> Due {formatDate(assignment.due_at)}</span>
                  ) : assignment.submission ? (
                    <span><CalendarDays size={15} /> Submitted {formatDate(assignment.submission.submitted_at)}</span>
                  ) : null}
                  <span><ClipboardCheck size={15} /> {assignment.max_points} marks</span>
                </div>
                {role === "student" && assignment.grade && (
                  <p className="assignment-grade-highlight" role="status">
                    Score: <strong>{assignment.grade.score} / {assignment.max_points}</strong>
                    {assignment.grade.feedback && <span> — {assignment.grade.feedback}</span>}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      {selectedAssignment && (
        <AssignmentDetailsModal
          key={`${role}-${selectedAssignment.id}`}
          role={role}
          assignment={selectedAssignment}
          onClose={() => setSelectedAssignmentId(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
