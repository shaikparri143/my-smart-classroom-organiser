import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { apiRequest } from "../../services/api";
import { getAccessToken } from "../../services/auth";
import usePollingResource from "../../hooks/usePollingResource";
import AssignmentPanel from "../../components/assignments/AssignmentPanel";
import AttendancePanel from "../../components/attendance/AttendancePanel";
import { NotificationsPage } from "../../components/notifications/NotificationCenter";
import AnnouncementPanel from "../../components/announcements/AnnouncementPanel";
import DiscussionPanel from "../../components/discussions/DiscussionPanel";
import StudentMarksPanel from "../../components/marks/StudentMarksPanel";
import CalendarPage from "../teacher/CalendarPage";
import DoubtBoxPage from "./DoubtBoxPage";

export default function StudentDashboard({
  search = "",
  page = "Overview",
  onNavigate,
  currentUser,
}) {
  const loadCourses = useCallback(
    (signal) =>
      apiRequest("/api/courses/student", {
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
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [notice, setNotice] = useState("");
  const mutationControllerRef = useRef(null);

  useEffect(
    () => () => mutationControllerRef.current?.abort(),
    [],
  );

  const filteredCourses = courses.filter((course) =>
    `${course.title} ${course.course_code} ${course.semester} ${course.section} ${course.teacher_name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  async function handleJoinCourse(event) {
    event.preventDefault();
    setJoining(true);
    setJoinError("");
    setNotice("");
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    try {
      await apiRequest("/api/courses/join", {
        method: "POST",
        token: getAccessToken(),
        signal: controller.signal,
        body: { join_code: joinCode.trim().toUpperCase() },
      });
      if (controller.signal.aborted) {
        return;
      }
      setJoinCode("");
      setNotice("You joined the course successfully.");
      await refresh(true);
    } catch (requestError) {
      if (!controller.signal.aborted && requestError.name !== "AbortError") {
        setJoinError(
          requestError.message ||
            "Unable to join this course. Check the code and try again.",
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setJoining(false);
      }
    }
  }

  if (page === "Assignments") {
    return <AssignmentPanel role="student" />;
  }

  if (page === "My Attendance") {
    return (
      <AttendancePanel
        role="student"
        courses={courses}
        coursesLoading={loading}
        coursesError={error}
      />
    );
  }

  if (page === "My Grades") {
    return <StudentMarksPanel />;
  }

  if (page === "Notifications") {
    return <NotificationsPage onNavigate={onNavigate} />;
  }

  if (page === "Calendar") {
    return <CalendarPage role="student" />;
  }

  if (page === "Doubt Box") {
    return <DoubtBoxPage courses={courses} />;
  }

  if (page === "Announcements") {
    return (
      <AnnouncementPanel
        role="student"
        courses={courses}
        coursesLoading={loading}
        coursesError={error}
      />
    );
  }

  if (page === "Discussions") {
    return (
      <DiscussionPanel
        role="student"
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
          <div className="stat-heading"><span>Enrolled courses</span></div>
          <div className="stat-value">{courses.length}</div>
        </article>
      </section>

      <section className="panel course-form-panel">
        <div className="panel-heading">
          <div>
            <h2>Join a course</h2>
            <p>Enter the join code provided by your teacher.</p>
          </div>
        </div>
        {joinError && <p className="course-message course-error" role="alert">{joinError}</p>}
        {notice && <p className="course-message course-success" role="status">{notice}</p>}
        <form className="course-join-form" onSubmit={handleJoinCourse}>
          <label htmlFor="course-join-code">Course join code</label>
          <div>
            <input
              id="course-join-code"
              autoComplete="off"
              maxLength={12}
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="e.g. A1B2C3D4E5"
              required
            />
            <button className="button-primary" type="submit" disabled={joining}>
              {joining ? "Joining..." : "Join course"}
            </button>
          </div>
        </form>
      </section>

      <section className="course-list-section">
        <div className="panel-heading">
          <div>
            <h2>My courses</h2>
            <p>Your enrolled courses and teacher contact information.</p>
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
              : "You have not joined any courses yet. Enter a join code above to get started."}
          </p>
        ) : (
          <div className="course-card-grid">
            {filteredCourses.map((course) => (
              <article className="panel course-card" key={course.id}>
                <span className="course-code">{course.course_code}</span>
                <h3>{course.title}</h3>
                <p className="course-card-description">
                  {course.description || "No course description provided."}
                </p>
                <p className="course-meta">
                  {course.semester} · Section {course.section}
                  {!course.is_active && " · Inactive"}
                </p>
                <div className="course-teacher">
                  <BookOpen size={16} />
                  <span>
                    Instructor: <strong>{course.teacher_name}</strong>
                  </span>
                  <a href={`mailto:${course.teacher_email}`}>
                    {course.teacher_email}
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
