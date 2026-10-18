import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCourseAttendance,
  getStudentAttendance,
  saveCourseAttendance,
  updateCourseAttendanceThreshold,
} from "../../services/attendance";
import "./AttendancePanel.css";

const STATUSES = ["present", "absent", "late", "excused"];

function today() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function initialDrafts(records) {
  return records.map((record) => ({
    student_id: record.student_id,
    status: record.status || "",
    notes: record.notes || "",
  }));
}

export default function AttendancePanel({
  role,
  courses = [],
  coursesLoading = false,
  coursesError = "",
}) {
  const isTeacher = role === "teacher";
  const [courseId, setCourseId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [records, setRecords] = useState([]);
  const [studentSummaries, setStudentSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [attendanceThreshold, setAttendanceThreshold] = useState("75");
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saveInFlight = useRef(false);

  const activeCourseId = courses.some((course) => String(course.id) === courseId)
    ? courseId
    : courses.length
      ? String(courses[0].id)
      : "";
  const activeCourse = courses.find((course) => String(course.id) === activeCourseId);
  const courseThreshold = activeCourse?.attendance_threshold ?? 75;
  const hasUnsavedChanges = drafts.some((draft, index) => {
    const saved = records[index];
    return saved && (
      draft.status !== (saved.status || "") ||
      draft.notes !== (saved.notes || "")
    );
  });

  useEffect(() => {
    if (isTeacher && (!activeCourseId || !attendanceDate)) return undefined;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (isTeacher) {
          const result = await getCourseAttendance(
            activeCourseId,
            attendanceDate,
            controller.signal,
          );
          if (!controller.signal.aborted) {
            setRecords(result);
            setDrafts(initialDrafts(result));
            setAttendanceThreshold(
              String(result[0]?.required_attendance_percentage ?? courseThreshold),
            );
          }
        } else {
          const result = await getStudentAttendance(controller.signal);
          if (!controller.signal.aborted) setStudentSummaries(result);
        }
      } catch (requestError) {
        if (!controller.signal.aborted && requestError.name !== "AbortError") {
          setError(requestError.message || "Unable to load attendance.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [attendanceDate, activeCourseId, courseThreshold, isTeacher]);

  const dateCounts = useMemo(
    () => STATUSES.reduce(
      (counts, status) => ({
        ...counts,
        [status]: drafts.filter((record) => record.status === status).length,
      }),
      {},
    ),
    [drafts],
  );

  function confirmDiscard() {
    return !hasUnsavedChanges || window.confirm(
      "There are unsaved attendance changes. Discard them and continue?",
    );
  }

  async function save(event) {
    event.preventDefault();
    if (saveInFlight.current) return;
    setError("");
    setNotice("");
    if (drafts.some((record) => !STATUSES.includes(record.status))) {
      setError("Choose a status for every enrolled student before saving.");
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    try {
      const result = await saveCourseAttendance(
        activeCourseId,
        attendanceDate,
        drafts.map((record) => ({
          student_id: record.student_id,
          status: record.status,
          notes: record.notes.trim() || null,
        })),
      );
      setRecords(result);
      setDrafts(initialDrafts(result));
      setNotice("Attendance saved successfully.");
    } catch (requestError) {
      setError(requestError.message || "Unable to save attendance.");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  async function saveThreshold(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const value = Number(attendanceThreshold);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError("Required attendance must be between 0% and 100%.");
      return;
    }
    setThresholdSaving(true);
    try {
      await updateCourseAttendanceThreshold(activeCourseId, value);
      setNotice("Attendance requirement updated.");
      const refreshed = await getCourseAttendance(activeCourseId, attendanceDate);
      setRecords(refreshed);
      setDrafts(initialDrafts(refreshed));
    } catch (requestError) {
      setError(requestError.message || "Unable to update the attendance requirement.");
    } finally {
      setThresholdSaving(false);
    }
  }

  if (coursesLoading) return <p className="course-empty" role="status">Loading your courses...</p>;
  if (coursesError) return <p className="course-message course-error" role="alert">{coursesError}</p>;

  return (
    <section className="attendance-page">
      {error && <p className="course-message course-error" role="alert">{error}</p>}
      {notice && <p className="course-message course-success" role="status">{notice}</p>}
      {isTeacher ? (
        <>
          <section className="panel attendance-controls">
            <label>
              Course
              <select
                value={activeCourseId}
                onChange={(event) => {
                  if (!confirmDiscard()) return;
                  setCourseId(event.target.value);
                  setNotice("");
                  setError("");
                }}
                disabled={!courses.length}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.course_code} · {course.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Attendance date
              <input
                type="date"
                value={attendanceDate}
                onChange={(event) => {
                  if (!confirmDiscard()) return;
                  setAttendanceDate(event.target.value);
                  setNotice("");
                  setError("");
                }}
              />
            </label>
            {!courses.length ? (
              <p className="course-empty">Create a course before taking attendance.</p>
            ) : (
              <form className="attendance-threshold" onSubmit={saveThreshold}>
                <label>
                  Required attendance (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={attendanceThreshold}
                    onChange={(event) => setAttendanceThreshold(event.target.value)}
                  />
                </label>
                <button className="button-secondary" type="submit" disabled={thresholdSaving || hasUnsavedChanges}>
                  {thresholdSaving ? "Saving..." : "Save requirement"}
                </button>
              </form>
            )}
          </section>
          {loading ? (
            <p className="course-empty" role="status">Loading enrolled students...</p>
          ) : !records.length ? (
            <p className="course-empty">No students are enrolled in this course yet.</p>
          ) : (
            <form className="panel attendance-table-panel" onSubmit={save}>
              <div className="panel-heading">
                <div>
                  <h2>{activeCourse?.course_code} · {activeCourse?.title}</h2>
                  <p>Attendance for {attendanceDate}. Reopen any date to correct saved records.</p>
                </div>
                <span className="attendance-save-state" role="status">
                  {saving ? "Saving..." : hasUnsavedChanges ? "Unsaved changes" : "Saved"}
                </span>
              </div>
              <div className="attendance-counts" aria-live="polite">
                {STATUSES.map((status) => (
                  <span key={status} className={`attendance-count attendance-count-${status}`}>
                    {status}: <strong>{dateCounts[status] || 0}</strong>
                  </span>
                ))}
                <span className="attendance-count">Not marked: <strong>{drafts.filter((record) => !record.status).length}</strong></span>
              </div>
              <div className="attendance-toolbar">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={saving}
                  onClick={() => {
                    if (window.confirm("Mark every enrolled student present for this date? You can change individual statuses before saving.")) {
                      setDrafts((current) => current.map((record) => ({ ...record, status: "present" })));
                    }
                  }}
                >
                  Mark all present
                </button>
                <span>{records.length} enrolled · {activeCourse?.title}</span>
              </div>
              <div className="attendance-list">
                {records.map((student, index) => (
                  <article className="attendance-row" key={student.student_id}>
                    <div className="attendance-student">
                      <strong>{student.student_name}</strong>
                      <span>{student.student_email}</span>
                      {student.eligible_records > 0 && (
                        <small>
                          {student.attended_records}/{student.eligible_records} eligible sessions · {student.attendance_percentage}%
                        </small>
                      )}
                      {student.history.length > 0 && (
                        <details>
                          <summary>View student history</summary>
                          <ul className="attendance-history">
                            {student.history.map((item) => (
                              <li key={`${student.student_id}-${item.attendance_date}`}>
                                {item.attendance_date}: {item.status}{item.notes ? ` — ${item.notes}` : ""}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                    <div className="attendance-status-picker" role="group" aria-label={`Attendance status for ${student.student_name}`}>
                      {STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`attendance-status-button attendance-status-${status} ${drafts[index]?.status === status ? "is-selected" : ""}`}
                          aria-pressed={drafts[index]?.status === status}
                          disabled={saving}
                          onClick={() => setDrafts((current) => current.map((record, recordIndex) => recordIndex === index ? { ...record, status } : record))}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                    <label className="attendance-notes">
                      Notes (optional)
                      <input
                        maxLength={2000}
                        value={drafts[index]?.notes || ""}
                        onChange={(event) => setDrafts((current) => current.map((record, recordIndex) => recordIndex === index ? { ...record, notes: event.target.value } : record))}
                      />
                    </label>
                  </article>
                ))}
              </div>
              <button className="button-primary" type="submit" disabled={saving || !hasUnsavedChanges}>
                {saving ? "Saving attendance..." : "Save attendance"}
              </button>
            </form>
          )}
        </>
      ) : loading ? (
        <p className="course-empty" role="status">Loading attendance history...</p>
      ) : (
        <>
          {!studentSummaries.length ? (
            <p className="course-empty">Join a course to see your attendance.</p>
          ) : (
            <section className="attendance-summary-grid">
              {studentSummaries.map((course) => (
                <article className="panel attendance-summary-card" key={course.course_id}>
                  <div className="attendance-course-heading">
                    <span>{course.course_code} · {course.course_title}</span>
                    <small>Requirement: {course.required_attendance_percentage}%</small>
                  </div>
                  {course.attendance_percentage === null ? (
                    <strong className="attendance-no-data">No attendance recorded</strong>
                  ) : (
                    <>
                      <strong>{course.attendance_percentage}%</strong>
                      <small>
                        {course.requirement_met && course.margin_percentage_points === 0
                          ? "Requirement currently met"
                          : course.requirement_met
                            ? `+${course.margin_percentage_points} percentage points above requirement`
                            : `${course.margin_percentage_points === 0 ? "<0.01" : Math.abs(course.margin_percentage_points)} percentage points below requirement`}
                      </small>
                      {!course.requirement_met && (
                        <small>
                          {course.additional_classes_needed === null
                            ? "The requirement cannot be reached through attended classes alone at this threshold."
                            : `Estimate: attend the next ${course.additional_classes_needed} eligible class${course.additional_classes_needed === 1 ? "" : "es"} without absence to reach the requirement.`}
                        </small>
                      )}
                    </>
                  )}
                  <div className="attendance-student-counts">
                    <span>Total eligible <b>{course.total_sessions}</b></span>
                    <span>Present <b>{course.present_count}</b></span>
                    <span>Absent <b>{course.absent_count}</b></span>
                    <span>Late <b>{course.late_count}</b></span>
                    <span>Excused <b>{course.excused_count}</b></span>
                  </div>
                  {course.history.length > 0 && (
                    <details>
                      <summary>View date-wise history</summary>
                      <ul className="attendance-history">
                        {course.history.map((item) => (
                          <li key={`${course.course_id}-${item.attendance_date}`}>
                            {item.attendance_date}: {item.status}{item.notes ? ` — ${item.notes}` : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}
