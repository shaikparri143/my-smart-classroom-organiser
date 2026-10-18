import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Share2, Users } from "lucide-react";
import { apiRequest } from "../../services/api";
import { getAccessToken } from "../../services/auth";
import usePollingResource from "../../hooks/usePollingResource";
import AssignmentPanel from "../../components/assignments/AssignmentPanel";
import AttendancePanel from "../../components/attendance/AttendancePanel";
import { NotificationsPage } from "../../components/notifications/NotificationCenter";
import AnnouncementPanel from "../../components/announcements/AnnouncementPanel";
import DiscussionPanel from "../../components/discussions/DiscussionPanel";
import GradebookPanel from "../../components/marks/GradebookPanel";
import AnalyticsPage from "./AnalyticsPage";
import CalendarPage from "./CalendarPage";
import StudentsPage from "./StudentsPage";

export default function TeacherDashboard({
  search = "",
  page = "Overview",
  onNavigate,
  currentUser,
}) {
  const loadCourses = useCallback(
    (signal) =>
      apiRequest("/api/courses/teacher", {
        token: getAccessToken(),
        signal,
      }),
    [],
  );
  const {
    data: courses,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
  } = usePollingResource(loadCourses, 12000);
  const [form, setForm] = useState({
    course_code: "",
    title: "",
    description: "",
    semester: "",
    section: "",
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [createdCourse, setCreatedCourse] = useState(null);
  const [notice, setNotice] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState("");
  const [rosterRefreshing, setRosterRefreshing] = useState(false);
  const mutationControllerRef = useRef(null);

  useEffect(
    () => () => mutationControllerRef.current?.abort(),
    [],
  );

  const filteredCourses = courses.filter((course) =>
    `${course.title} ${course.course_code} ${course.semester} ${course.section}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const totalStudents = courses.reduce(
    (total, course) => total + course.enrollment_count,
    0,
  );

  useEffect(() => {
    if (selectedCourseId === null) {
      return undefined;
    }

    const controller = new AbortController();
    let inFlight = false;

    async function loadStudents(isInitial = false) {
      if (inFlight || controller.signal.aborted) {
        return;
      }

      inFlight = true;
      if (isInitial) {
        setStudentsLoading(true);
      } else {
        setRosterRefreshing(true);
      }

      try {
        const result = await apiRequest(
          `/api/courses/${selectedCourseId}/students`,
          { token: getAccessToken(), signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setStudents(result);
          setStudentsError("");
        }
      } catch (requestError) {
        if (!controller.signal.aborted && requestError.name !== "AbortError") {
          setStudentsError(
            requestError.message || "Unable to load enrolled students.",
          );
        }
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) {
          setStudentsLoading(false);
          setRosterRefreshing(false);
        }
      }
    }

    loadStudents(true);
    const interval = window.setInterval(() => loadStudents(), 12000);

    return () => {
      window.clearInterval(interval);
      controller.abort();
    };
  }, [selectedCourseId]);

  async function handleCreateCourse(event) {
    event.preventDefault();
    setCreating(true);
    setFormError("");
    setNotice("");
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    try {
      const course = await apiRequest("/api/courses", {
        method: "POST",
        token: getAccessToken(),
        signal: controller.signal,
        body: {
          course_code: form.course_code.trim(),
          title: form.title.trim(),
          description: form.description.trim() || null,
          semester: form.semester.trim(),
          section: form.section.trim(),
        },
      });
      if (controller.signal.aborted) {
        return;
      }
      setCreatedCourse(course);
      setForm({
        course_code: "",
        title: "",
        description: "",
        semester: "",
        section: "",
      });
      await refresh(true);
    } catch (requestError) {
      if (!controller.signal.aborted && requestError.name !== "AbortError") {
        setFormError(requestError.message || "Unable to create this course.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setCreating(false);
      }
    }
  }

  async function copyJoinCode(course) {
    try {
      await navigator.clipboard.writeText(course.join_code);
      setNotice(`Join code for ${course.course_code} copied.`);
    } catch {
      setNotice("Could not copy the join code. Select and copy it manually.");
    }
  }

  async function shareJoinCode(course) {
    const shareText = `Join ${course.title} (${course.course_code}) in ClassPilot with code ${course.join_code}.`;

    if (!navigator.share) {
      await copyJoinCode(course);
      return;
    }

    try {
      await navigator.share({ title: course.title, text: shareText });
      setNotice(`Join code for ${course.course_code} shared.`);
    } catch (shareError) {
      if (shareError.name !== "AbortError") {
        setNotice(shareError.message || "Unable to share this join code.");
      }
    }
  }

  if (page === "Assignments") {
    return (
      <AssignmentPanel
        role="teacher"
        courses={courses}
        coursesLoading={loading}
        coursesError={error}
      />
    );
  }

  if (page === "Attendance") {
    return (
      <AttendancePanel
        role="teacher"
        courses={courses}
        coursesLoading={loading}
        coursesError={error}
      />
    );
  }

  if (page === "Gradebook") {
    return (
      <GradebookPanel
        courses={courses}
        coursesLoading={loading}
        coursesError={error}
      />
    );
  }

  if (page === "Notifications") {
    return <NotificationsPage onNavigate={onNavigate} />;
  }

  if (page === "Calendar") {
    return <CalendarPage role="teacher" />;
  }

  if (page === "Students") {
    return <StudentsPage />;
  }

  if (page === "Analytics") {
    return <AnalyticsPage />;
  }

  if (page === "Announcements") {
    return (
      <AnnouncementPanel
        role="teacher"
        courses={courses}
        coursesLoading={loading}
        coursesError={error}
      />
    );
  }

  if (page === "Discussions") {
    return (
      <DiscussionPanel
        role="teacher"
        userId={currentUser?.id}
        courses={courses}
        coursesLoading={loading}
        coursesError={error}
      />
    );
  }

  return (
    <div className="course-management">
      <section className="stats-grid">
        <article className="panel stat-card">
          <div className="stat-heading"><span>Courses you teach</span></div>
          <div className="stat-value">{courses.length}</div>
        </article>
        <article className="panel stat-card">
          <div className="stat-heading"><span>Total enrollments</span></div>
          <div className="stat-value">{totalStudents}</div>
        </article>
      </section>

      <section className="panel course-form-panel">
        <div className="panel-heading">
          <div>
            <h2>Create a course</h2>
            <p>Students can enroll using its generated join code.</p>
          </div>
        </div>
        {formError && <p className="course-message course-error" role="alert">{formError}</p>}
        <form className="course-form" onSubmit={handleCreateCourse}>
          <label>
            Course code
            <input
              value={form.course_code}
              onChange={(event) => setForm({ ...form, course_code: event.target.value })}
              maxLength={30}
              required
            />
          </label>
          <label>
            Title
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              maxLength={150}
              required
            />
          </label>
          <label>
            Semester
            <input
              value={form.semester}
              onChange={(event) => setForm({ ...form, semester: event.target.value })}
              maxLength={30}
              placeholder="e.g. Fall 2026"
              required
            />
          </label>
          <label>
            Section
            <input
              value={form.section}
              onChange={(event) => setForm({ ...form, section: event.target.value })}
              maxLength={30}
              placeholder="e.g. A"
              required
            />
          </label>
          <label className="course-description-field">
            Description
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              maxLength={5000}
              rows={3}
            />
          </label>
          <button className="button-primary" type="submit" disabled={creating}>
            {creating ? "Creating course..." : "Create course"}
          </button>
        </form>
        {createdCourse && (
          <div className="course-message course-success" role="status">
            <strong>{createdCourse.course_code} created.</strong>
            <span>Share join code: <code>{createdCourse.join_code}</code></span>
          </div>
        )}
        {notice && <p className="course-message" role="status">{notice}</p>}
      </section>

      <section className="course-list-section">
        <div className="panel-heading">
          <div>
            <h2>Your courses</h2>
            <p>Enrollment totals update automatically every 12 seconds.</p>
          </div>
          <span className="course-refresh-status" aria-live="polite">
            {refreshing ? "Updating..." : lastUpdated ? "Up to date" : ""}
          </span>
        </div>
        {error && <p className="course-message course-error" role="alert">{error}</p>}
        {loading ? (
          <p className="course-empty" role="status">Loading your courses...</p>
        ) : filteredCourses.length === 0 ? (
          <p className="course-empty">
            {search
              ? "No courses match your search."
              : "You have not created any courses yet."}
          </p>
        ) : (
          <div className="course-card-grid">
            {filteredCourses.map((course) => (
              <article className="panel course-card" key={course.id}>
                <div className="course-card-heading">
                  <div>
                    <span className="course-code">{course.course_code}</span>
                    <h3>{course.title}</h3>
                  </div>
                  <span className="status-pill status-violet">
                    {course.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="course-card-description">
                  {course.description || "No course description provided."}
                </p>
                <p className="course-meta">{course.semester} · Section {course.section}</p>
                <div className="course-enrollment">
                  <Users size={16} />
                  <strong>{course.enrollment_count}</strong>
                  <span>{course.enrollment_count === 1 ? "student" : "students"}</span>
                </div>
                <div className="course-join-code">
                  <span>Join code</span>
                  <code>{course.join_code}</code>
                  <button type="button" className="icon-button" aria-label={`Copy ${course.course_code} join code`} onClick={() => copyJoinCode(course)}>
                    <Copy size={16} />
                  </button>
                  <button type="button" className="icon-button" aria-label={`Share ${course.course_code} join code`} onClick={() => shareJoinCode(course)}>
                    <Share2 size={16} />
                  </button>
                </div>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => {
                    setStudents([]);
                    setStudentsError("");
                    setSelectedCourseId((current) => current === course.id ? null : course.id);
                  }}
                  aria-expanded={selectedCourseId === course.id}
                >
                  {selectedCourseId === course.id ? "Hide enrolled students" : "View enrolled students"}
                </button>
                {selectedCourseId === course.id && (
                  <div className="course-roster">
                    <div className="course-roster-heading">
                      <h4>Enrolled students</h4>
                      {rosterRefreshing && <span>Updating...</span>}
                    </div>
                    {studentsError && <p className="course-message course-error" role="alert">{studentsError}</p>}
                    {studentsLoading ? (
                      <p role="status">Loading enrolled students...</p>
                    ) : students.length === 0 ? (
                      <p className="course-empty">No students have joined this course yet.</p>
                    ) : (
                      <ul>
                        {students.map((student) => (
                          <li key={student.id}>
                            <strong>{student.full_name}</strong>
                            <a href={`mailto:${student.email}`}>{student.email}</a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
