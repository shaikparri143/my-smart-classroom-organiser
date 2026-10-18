import usePollingResource from "../../hooks/usePollingResource";
import { getStudentMarks } from "../../services/marks";
import "./MarksPanels.css";

function formatMark(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function StudentMarksPanel() {
  const { data: courses, loading, refreshing, error } = usePollingResource(
    getStudentMarks,
    12000,
  );

  if (loading) return <p className="course-empty" role="status">Loading your marks...</p>;
  if (error) return <p className="course-message course-error" role="alert">{error}</p>;
  if (!courses.length) return <p className="course-empty">Join a course to see published marks.</p>;

  return (
    <section className="student-marks-page">
      {courses.map((course) => (
        <article className="panel student-marks-card" key={course.course_id}>
          <div className="panel-heading">
            <div>
              <span className="course-code">{course.course_code}</span>
              <h2>{course.course_title}</h2>
            </div>
            <span className={`marks-progress-badge ${course.is_in_progress ? "is-provisional" : "is-current"}`}>
              {course.available_components === 0
                ? "No published assessments"
                : course.is_in_progress
                  ? "In progress · provisional"
                  : "Published"}
            </span>
          </div>
          {course.components.length ? (
            <div className="marks-table-scroll">
              <table className="marks-table student-marks-table">
                <thead><tr><th>Component</th><th>Obtained</th><th>Maximum</th><th>Percentage</th><th>Feedback</th></tr></thead>
                <tbody>
                  {course.components.map((component) => (
                    <tr key={`${component.source}-${component.component_id}`}>
                      <td>
                        <strong>
                          {component.source === "assignment"
                            ? `Assignment · ${component.name}`
                            : component.name}
                        </strong>
                        {component.assessment_date && <small>{component.assessment_date}</small>}
                        {component.description && <small>{component.description}</small>}
                        {component.instructions && <small>{component.instructions}</small>}
                      </td>
                      <td>{component.score === null ? "Not graded" : formatMark(component.score)}</td>
                      <td>{formatMark(component.max_marks)}</td>
                      <td>{component.percentage === null ? "—" : `${formatMark(component.percentage)}%`}</td>
                      <td className="marks-feedback">{component.feedback || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="marks-not-released">
              <strong>No grades released yet</strong>
              <p>
                Published assessment marks and released assignment grades appear here.
                Draft marks are kept private until your teacher releases them.
              </p>
            </div>
          )}
          <div className="marks-student-total">
            <div><span>Total obtained / graded maximum</span><strong>{formatMark(course.total_obtained)} / {formatMark(course.total_maximum)}</strong></div>
            <div><span>Overall percentage</span><strong>{course.overall_percentage === null ? "No grades released yet" : `${formatMark(course.overall_percentage)}%`}</strong></div>
          </div>
          {!course.available_components && (
            <p className="marks-provisional-note">
              No grades are available yet. Published component marks and released assignment grades will appear here.
            </p>
          )}
          {course.is_in_progress && (
            <p className="marks-provisional-note">
              This result is provisional. Ungraded published components are not counted as zero.
            </p>
          )}
        </article>
      ))}
      {refreshing && <p className="course-refresh-status" role="status">Updating published marks...</p>}
    </section>
  );
}
