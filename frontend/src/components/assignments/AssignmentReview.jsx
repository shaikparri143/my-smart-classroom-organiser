import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../services/api";
import { getAccessToken } from "../../services/auth";
import usePollingResource from "../../hooks/usePollingResource";
import SubmissionResource from "./SubmissionResource";

function displayDate(value) {
  if (!value) {
    return "Unknown time";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
}

export default function AssignmentReview({ assignment }) {
  const loadSubmissions = useCallback(
    (signal) =>
      apiRequest(`/api/assignments/${assignment.id}/submissions`, {
        token: getAccessToken(),
        signal,
      }),
    [assignment.id],
  );
  const {
    data: reviews,
    loading,
    refreshing,
    error,
    refresh,
  } = usePollingResource(loadSubmissions, 12000);
  const [drafts, setDrafts] = useState({});
  const [savedGrades, setSavedGrades] = useState({});
  const [savingStudentId, setSavingStudentId] = useState(null);
  const [gradeError, setGradeError] = useState("");
  const [gradeNotice, setGradeNotice] = useState("");
  const mutationControllerRef = useRef(null);

  useEffect(
    () => () => mutationControllerRef.current?.abort(),
    [],
  );

  async function handleGrade(event, review) {
    event.preventDefault();
    setGradeError("");
    setGradeNotice("");
    const grade = savedGrades[review.student_id] || review.grade;
    const draft = drafts[review.student_id] || {
      score: grade ? String(grade.score) : "",
      feedback: grade?.feedback || "",
    };
    if (draft.score === "") {
      setGradeError(`Enter a score for ${review.student_name}.`);
      return;
    }

    setSavingStudentId(review.student_id);
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    try {
      const result = await apiRequest(
        `/api/assignments/submissions/${review.submission.id}/grade`,
        {
          method: "PUT",
          token: getAccessToken(),
          signal: controller.signal,
          body: {
            score: Number(draft.score),
            feedback: draft.feedback.trim() || null,
          },
        },
      );
      if (controller.signal.aborted) {
        return;
      }
      setSavedGrades((current) => ({
        ...current,
        [review.student_id]: result,
      }));
      setGradeNotice("Grade and feedback saved successfully!");
      await refresh(true);
    } catch (requestError) {
      if (!controller.signal.aborted && requestError.name !== "AbortError") {
        setGradeError(requestError.message || "Unable to save this grade.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setSavingStudentId(null);
      }
    }
  }

  return (
    <section className="assignment-review-section">
      <div className="assignment-review-heading">
        <h3>Submissions and grading</h3>
        {refreshing && <span role="status">Updating...</span>}
      </div>
      {error && (
        <p className="course-message course-error" role="alert">
          {error}
          <button className="button-secondary assignment-retry-button" type="button" onClick={() => refresh(true)}>
            Retry
          </button>
        </p>
      )}
      {gradeError && <p className="course-message course-error" role="alert">{gradeError}</p>}
      {gradeNotice && <p className="course-message course-success" role="status">{gradeNotice}</p>}
      {loading ? (
        <p className="course-empty" role="status">Loading enrolled students...</p>
      ) : error && reviews.length === 0 ? (
        <p className="course-empty" role="status">
          Enrolled students could not be loaded. Use Retry to try again.
        </p>
      ) : reviews.length === 0 ? (
        <p className="course-empty">No students are enrolled in this course yet.</p>
      ) : (
        <div className="assignment-review-list">
          {reviews.map((review) => {
            const grade = savedGrades[review.student_id] || review.grade;
            const draft = drafts[review.student_id] || {
              score: grade ? String(grade.score) : "",
              feedback: grade?.feedback || "",
            };

            return (
              <article className="assignment-review-student" key={review.student_id}>
                <div className="assignment-review-student-heading">
                  <div>
                    <strong>{review.student_name}</strong>
                    <span>{review.student_email}</span>
                  </div>
                  {grade && (
                    <span className="assignment-review-score">
                      {grade.score} / {assignment.max_points}
                    </span>
                  )}
                </div>
                {!review.submission ? (
                  <p className="course-empty">No submission yet.</p>
                ) : (
                  <>
                    <p className="assignment-submission-state">
                      {review.submission.status} · submitted {displayDate(review.submission.submitted_at)}
                    </p>
                    <div className="assignment-student-answer">
                      {review.submission.text_response || "No written answer was provided."}
                    </div>
                    {review.resources?.length > 0 && (
                      <div className="assignment-resources">
                        <h4>Submitted links and files</h4>
                        {review.resources.map((resource) => (
                          <SubmissionResource resource={resource} key={resource.id} />
                        ))}
                      </div>
                    )}
                    <form
                      className="assignment-grade-form"
                      onSubmit={(event) => handleGrade(event, review)}
                    >
                      <label>
                        Marks (0–{assignment.max_points})
                        <input
                          type="number"
                          min="0"
                          max={assignment.max_points}
                          step="0.01"
                          required
                          value={draft.score}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [review.student_id]: {
                                ...draft,
                                score: event.target.value,
                              },
                            }))
                          }
                          disabled={savingStudentId !== null}
                        />
                      </label>
                      <label>
                        Remarks
                        <textarea
                          value={draft.feedback}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [review.student_id]: {
                                ...draft,
                                feedback: event.target.value,
                              },
                            }))
                          }
                          rows={3}
                          maxLength={10000}
                          disabled={savingStudentId !== null}
                        />
                      </label>
                      <button
                        className="button-primary"
                        type="submit"
                        disabled={savingStudentId !== null}
                      >
                        {savingStudentId === review.student_id
                          ? "Saving grade..."
                          : grade
                            ? "Update grade"
                            : "Save grade"}
                      </button>
                    </form>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
