import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { getAccessToken } from "../../services/auth";
import usePollingResource from "../../hooks/usePollingResource";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from "../../services/announcements";
import "./AnnouncementPanel.css";

const emptyForm = { title: "", content: "", recipientStudentIds: [] };

export default function AnnouncementPanel({
  role,
  courses = [],
  coursesLoading = false,
  coursesError = "",
}) {
  const isTeacher = role === "teacher";
  const loadAnnouncements = useCallback(
    (signal) => listAnnouncements(isTeacher ? "teacher" : "student", signal),
    [isTeacher],
  );
  const {
    data: announcements,
    loading,
    refreshing,
    error: loadError,
    refresh,
  } = usePollingResource(loadAnnouncements, 12000);
  const [courseId, setCourseId] = useState("");
  const [students, setStudents] = useState([]);
  const [studentsCourseId, setStudentsCourseId] = useState("");
  const [studentsError, setStudentsError] = useState("");
  const [recipientMode, setRecipientMode] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeCourseId = courses.some(
    (course) => String(course.id) === courseId,
  )
    ? courseId
    : courses.length
      ? String(courses[0].id)
      : "";
  const studentsLoading = Boolean(
    isTeacher && activeCourseId && studentsCourseId !== activeCourseId,
  );
  const courseStudents =
    studentsCourseId === activeCourseId ? students : [];

  useEffect(() => {
    if (!isTeacher || !activeCourseId) {
      return undefined;
    }
    const controller = new AbortController();
    apiRequest(`/api/courses/${activeCourseId}/students`, {
      token: getAccessToken(),
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setStudents(result);
          setStudentsError("");
          setStudentsCourseId(activeCourseId);
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted && requestError.name !== "AbortError") {
          setStudentsError(requestError.message || "Unable to load course students.");
          setStudentsCourseId(activeCourseId);
        }
      });
    return () => controller.abort();
  }, [activeCourseId, isTeacher]);

  const allRecipientsSelected =
    courseStudents.length > 0 &&
    courseStudents.every((student) =>
      form.recipientStudentIds.includes(student.id),
    ) &&
    form.recipientStudentIds.length === courseStudents.length;
  const activeRecipientMode =
    recipientMode ?? (editingId && !allRecipientsSelected ? "selected" : "all");

  function beginEdit(announcement) {
    setError("");
    setNotice("");
    setCourseId(String(announcement.course_id));
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      content: announcement.content,
      recipientStudentIds: announcement.recipient_student_ids,
    });
    setRecipientMode(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setRecipientMode(null);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (activeRecipientMode === "selected" && !form.recipientStudentIds.length) {
      setError("Select at least one enrolled student.");
      return;
    }
    setSaving(true);
    const body = {
      title: form.title.trim(),
      content: form.content.trim(),
      recipient_student_ids:
        activeRecipientMode === "all" ? null : form.recipientStudentIds,
    };
    try {
      if (editingId) {
        await updateAnnouncement(editingId, body);
        setNotice("Announcement updated.");
      } else {
        await createAnnouncement({ ...body, course_id: Number(activeCourseId) });
        setNotice("Announcement published.");
      }
      cancelEdit();
      await refresh(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to save this announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAnnouncement(announcement) {
    if (!window.confirm(`Delete "${announcement.title}"?`)) {
      return;
    }
    setError("");
    setNotice("");
    try {
      await deleteAnnouncement(announcement.id);
      setNotice("Announcement deleted.");
      await refresh(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete this announcement.");
    }
  }

  if (coursesLoading && isTeacher) {
    return <p className="course-empty" role="status">Loading your courses...</p>;
  }
  if (coursesError && isTeacher) {
    return <p className="course-message course-error" role="alert">{coursesError}</p>;
  }

  return (
    <section className="announcement-page">
      {isTeacher && (
        <form className="panel announcement-form" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <h2>{editingId ? "Edit announcement" : "Publish an announcement"}</h2>
              <p>Share updates with all enrolled students or choose specific recipients.</p>
            </div>
          </div>
          {error && <p className="course-message course-error" role="alert">{error}</p>}
          {notice && <p className="course-message course-success" role="status">{notice}</p>}
          {!courses.length ? (
            <p className="course-empty">Create a course before publishing an announcement.</p>
          ) : (
            <>
              <label>
                Course
                <select
                  value={activeCourseId}
                  onChange={(event) => setCourseId(event.target.value)}
                  disabled={editingId !== null}
                  required
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} · {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input
                  required
                  minLength={2}
                  maxLength={200}
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </label>
              <label>
                Message
                <textarea
                  required
                  maxLength={20000}
                  rows={4}
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                />
              </label>
              <fieldset className="announcement-recipient-options">
                <legend>Recipients</legend>
                <label>
                  <input
                    type="radio"
                    name="announcement-recipients"
                    checked={activeRecipientMode === "all"}
                    onChange={() => setRecipientMode("all")}
                  />
                  All enrolled students
                </label>
                <label>
                  <input
                    type="radio"
                    name="announcement-recipients"
                    checked={activeRecipientMode === "selected"}
                    onChange={() => setRecipientMode("selected")}
                  />
                  Selected students
                </label>
                {activeRecipientMode === "selected" && (
                  <div className="announcement-student-picker">
                    {studentsLoading ? (
                      <span role="status">Loading enrolled students...</span>
                    ) : studentsError ? (
                      <span className="course-error" role="alert">{studentsError}</span>
                    ) : courseStudents.length ? (
                      courseStudents.map((student) => (
                        <label key={student.id}>
                          <input
                            type="checkbox"
                            checked={form.recipientStudentIds.includes(student.id)}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                recipientStudentIds: event.target.checked
                                  ? [...current.recipientStudentIds, student.id]
                                  : current.recipientStudentIds.filter((id) => id !== student.id),
                              }))
                            }
                          />
                          <span>{student.full_name} · {student.email}</span>
                        </label>
                      ))
                    ) : (
                      <span>No students are enrolled in this course.</span>
                    )}
                  </div>
                )}
              </fieldset>
              <div className="announcement-form-actions">
                <button
                  className="button-primary"
                  type="submit"
                  disabled={saving || studentsLoading || !activeCourseId}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Publish announcement"}
                </button>
                {editingId && (
                  <button className="button-secondary" type="button" onClick={cancelEdit}>
                    Cancel edit
                  </button>
                )}
              </div>
            </>
          )}
        </form>
      )}
      <section className="announcement-list">
        <div className="panel-heading">
          <div>
            <h2>{isTeacher ? "Course announcements" : "Announcements for you"}</h2>
            {refreshing && <span role="status">Updating...</span>}
          </div>
        </div>
        {loadError ? (
          <div className="course-message course-error" role="alert">
            {loadError}
            <button type="button" className="button-secondary" onClick={() => refresh(true)}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <p className="course-empty" role="status">Loading announcements...</p>
        ) : announcements.length ? (
          announcements.map((announcement) => (
            <article className="panel announcement-card" key={announcement.id}>
              <div className="announcement-card-heading">
                <div>
                  <span className="announcement-course">
                    {announcement.course_code} · {announcement.course_title}
                  </span>
                  <h3>{announcement.title}</h3>
                </div>
                {isTeacher && (
                  <div className="announcement-card-actions">
                    <button className="button-secondary" type="button" onClick={() => beginEdit(announcement)}>
                      Edit
                    </button>
                    <button className="button-secondary" type="button" onClick={() => removeAnnouncement(announcement)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
              <p className="announcement-content">{announcement.content}</p>
              <footer>
                <span>By {announcement.author_name}</span>
                <time dateTime={announcement.created_at}>
                  {new Date(announcement.created_at).toLocaleString()}
                </time>
              </footer>
            </article>
          ))
        ) : (
          <p className="course-empty">No announcements yet.</p>
        )}
      </section>
    </section>
  );
}
