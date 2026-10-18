import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../services/api";
import { getAccessToken } from "../../services/auth";

export default function StudentsPage() {
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadStudents() {
      setLoading(true);
      setError("");
      try {
        const teacherCourses = await apiRequest("/api/courses/teacher", {
          token: getAccessToken(),
        });
        if (!active) {
          return;
        }
        setCourses(teacherCourses);

        const roster = await Promise.all(
          teacherCourses.map(async (course) => {
            const courseStudents = await apiRequest(`/api/courses/${course.id}/students`, {
              token: getAccessToken(),
            });
            const attendance = await apiRequest(`/api/attendance/courses/${course.id}?date=${new Date().toISOString().slice(0, 10)}`, {
              token: getAccessToken(),
            });
            const attendanceMap = Object.fromEntries(
              attendance.map((row) => [row.student_id, row.attendance_percentage ?? 0]),
            );
            return courseStudents.map((student) => ({
              ...student,
              course_code: course.course_code,
              course_title: course.title,
              attendance: attendanceMap[student.id] ?? 0,
            }));
          }),
        );

        if (active) {
          setStudents(roster.flat());
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || "Unable to load students.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadStudents();
    return () => {
      active = false;
    };
  }, []);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return students;
    }
    return students.filter((student) =>
      `${student.full_name} ${student.email} ${student.course_title}`
        .toLowerCase()
        .includes(term),
    );
  }, [search, students]);

  if (loading) {
    return <p className="course-empty" role="status">Loading student directory...</p>;
  }

  if (error) {
    return <p className="course-message course-error" role="alert">{error}</p>;
  }

  return (
    <div className="course-management">
      <section className="panel" style={{ padding: 18 }}>
        <div className="panel-heading">
          <div>
            <h2>Student directory</h2>
            <p>Search by name, email, or course.</p>
          </div>
        </div>
        <label style={{ display: "block", marginTop: 12 }}>
          Search students
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Student name or email"
            style={{ width: "100%", marginTop: 8 }}
          />
        </label>
      </section>

      <section className="panel" style={{ marginTop: 18, padding: 18 }}>
        <div className="panel-heading">
          <div>
            <h2>Enrolled students</h2>
            <p>{filteredStudents.length} results across {courses.length} course(s).</p>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <p className="course-empty">No students found.</p>
        ) : (
          <div className="course-card-grid" style={{ marginTop: 16 }}>
            {filteredStudents.map((student) => (
              <article className="panel course-card" key={`${student.id}-${student.course_code}`}>
                <div className="course-card-heading">
                  <div>
                    <span className="course-code">{student.course_code}</span>
                    <h3>{student.full_name}</h3>
                  </div>
                  <span className="status-pill status-violet">{Math.round(student.attendance)}% attendance</span>
                </div>
                <p className="course-card-description">{student.email}</p>
                <p className="course-meta">{student.course_title}</p>
                <div className="course-enrollment">
                  <strong>{student.attendance.toFixed(0)}%</strong>
                  <span>attendance</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
