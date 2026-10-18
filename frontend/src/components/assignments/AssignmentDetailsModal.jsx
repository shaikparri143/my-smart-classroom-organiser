import { useEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { apiRequest } from "../../services/api";
import { getAccessToken } from "../../services/auth";
import AssignmentReview from "./AssignmentReview";
import SubmissionResource from "./SubmissionResource";

const EMPTY_RESOURCES = [];

function displayDate(value) {
  if (!value) {
    return "No due date";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function DueCountdown({ dueAt, submitted, graded }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!dueAt) {
    return <span>{graded ? "Graded" : submitted ? "Submitted" : "No due date"}</span>;
  }
  if (graded || submitted) {
    return <span>{graded ? "Graded" : "Submitted"}</span>;
  }
  const remaining = new Date(dueAt).getTime() - now;
  if (!Number.isFinite(remaining)) {
    return <span>Due date unavailable</span>;
  }
  if (remaining <= 0) {
    return <span>{submitted ? "Submitted" : remaining > -1000 ? "Due now" : "Overdue"}</span>;
  }
  const seconds = Math.floor(remaining / 1000);
  return (
    <span>
      {Math.floor(seconds / 86400)}d {String(Math.floor((seconds % 86400) / 3600)).padStart(2, "0")}h{" "}
      {String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m{" "}
      {String(seconds % 60).padStart(2, "0")}s remaining
    </span>
  );
}

export default function AssignmentDetailsModal({
  role,
  assignment,
  onClose,
  onRefresh,
}) {
  const [answer, setAnswer] = useState(assignment.submission?.text_response || "");
  const [linksText, setLinksText] = useState(() =>
    (assignment.resources || [])
      .filter((resource) => resource.kind === "link")
      .map((resource) => resource.external_url)
      .join("\n"),
  );
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [retainedResources, setRetainedResources] = useState(null);
  const [submissionOverride, setSubmissionOverride] = useState(undefined);
  const submission = submissionOverride ?? assignment.submission;
  const grade = assignment.grade || null;
  const [editing, setEditing] = useState(!submission);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const mutationControllerRef = useRef(null);
  const resources = assignment.resources || EMPTY_RESOURCES;
  const fileResourceIds = resources
    .filter((resource) => resource.kind === "file")
    .map((resource) => resource.id);
  const resourceSignature = JSON.stringify(fileResourceIds);
  const keptResourceIds =
    retainedResources?.signature === resourceSignature
      ? retainedResources.ids
      : fileResourceIds;

  useEffect(() => () => mutationControllerRef.current?.abort(), []);

  function enableEditing() {
    if (grade) {
      return;
    }
    if (
      window.confirm(
        "Editing will change your current submission. You must click Save Submission to apply these changes.",
      )
    ) {
      setEditing(true);
      setSaveError("");
      setNotice("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const links = linksText
      .split(/\r?\n/)
      .map((link) => link.trim())
      .filter(Boolean);
    if (!answer.trim() && links.length === 0 && selectedFiles.length === 0) {
      setSaveError("Provide a written answer, a link, or at least one attachment.");
      return;
    }
    const body = new FormData();
    if (answer.trim()) {
      body.append("text_response", answer.trim());
    }
    links.forEach((link) => body.append("links", link));
    selectedFiles.forEach((file) => body.append("files", file));
    keptResourceIds.forEach((id) => body.append("keep_resource_ids", String(id)));

    setSaving(true);
    setSaveError("");
    setNotice("");
    setUploadProgress(0);
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    try {
      const result = await apiRequest(
        `/api/assignments/${assignment.id}/submission`,
        {
          method: "PUT",
          token: getAccessToken(),
          signal: controller.signal,
          body,
          onUploadProgress: setUploadProgress,
        },
      );
      if (controller.signal.aborted) {
        return;
      }
      setSubmissionOverride(result);
      setSelectedFiles([]);
      setEditing(false);
      setNotice(
        submission
          ? "Submission updated successfully!"
          : "Assignment submitted successfully!",
      );
      await onRefresh(true);
    } catch (error) {
      if (!controller.signal.aborted && error.name !== "AbortError") {
        setSaveError(error.message || "Unable to save your submission.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setSaving(false);
      }
    }
  }

  return (
    <div
      className="assignment-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={`panel assignment-modal ${role === "teacher" ? "assignment-review-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-modal-title"
      >
        <header className="assignment-modal-header">
          <div>
            <span className="course-code">
              {assignment.course_code} · {assignment.course_title}
            </span>
            <h2 id="assignment-modal-title">{assignment.title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close assignment"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>

        <div className="assignment-modal-meta">
          <span>Due {displayDate(assignment.due_at)}</span>
          <span>Maximum marks: {assignment.max_points}</span>
          {role === "student" && (
            <span className="assignment-modal-countdown">
              <DueCountdown
                dueAt={assignment.due_at}
                submitted={Boolean(submission)}
                graded={Boolean(grade)}
              />
            </span>
          )}
        </div>
        <div className="assignment-instructions">
          <h3>Instructions</h3>
          <p>{assignment.description || "No instructions provided."}</p>
        </div>

        {role === "student" ? (
          <>
            {grade && (
              <div className="assignment-grade-highlight assignment-modal-grade" role="status">
                <strong>Score: {grade.score} / {assignment.max_points}</strong>
                {grade.feedback && <p>Remarks: {grade.feedback}</p>}
              </div>
            )}
            {notice && (
              <p className="assignment-toast course-success" role="status">
                <CheckCircle2 size={17} /> {notice}
              </p>
            )}
            {saveError && <p className="course-message course-error" role="alert">{saveError}</p>}
            {submission && (
              <p className="assignment-submission-state" role="status">
                {grade ? "Graded" : submission.status === "resubmitted" ? "Resubmitted" : submission.status === "late" ? "Submitted late" : "Submitted"}
                {" "}on {displayDate(submission.submitted_at)}.
                {grade ? " This submission is locked." : ""}
              </p>
            )}
            {submission && resources.length > 0 && (
              <div className="assignment-resources">
                <h3>Your submitted links and files</h3>
                {resources.map((resource) => (
                  <div className="assignment-existing-resource" key={resource.id}>
                    <SubmissionResource resource={resource} />
                    {editing && resource.kind === "file" && (
                      <label className="assignment-retain-resource">
                        <input
                          type="checkbox"
                          checked={keptResourceIds.includes(resource.id)}
                          onChange={() => {
                            const nextIds = keptResourceIds.includes(resource.id)
                              ? keptResourceIds.filter((id) => id !== resource.id)
                              : [...keptResourceIds, resource.id];
                            setRetainedResources({
                              signature: resourceSignature,
                              ids: nextIds,
                            });
                          }}
                        />
                        Keep this attachment
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}
            {submission && !grade && !editing && (
              <button className="button-secondary assignment-edit-button" type="button" onClick={enableEditing}>
                Edit Submission
              </button>
            )}
            {grade && !editing ? null : editing ? (
              <form className="assignment-submission-form" onSubmit={handleSubmit}>
                <label htmlFor="assignment-answer">Written answer</label>
                <textarea
                  id="assignment-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  rows={8}
                  maxLength={50000}
                  disabled={saving}
                />
                <label htmlFor="assignment-links">External links (one per line)</label>
                <textarea
                  id="assignment-links"
                  value={linksText}
                  onChange={(event) => setLinksText(event.target.value)}
                  rows={3}
                  maxLength={10000}
                  placeholder="https://example.com/your-work"
                  disabled={saving}
                />
                <label htmlFor="assignment-files">Attachments</label>
                <input
                  id="assignment-files"
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.rtf,.csv"
                  onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
                  disabled={saving}
                />
                {selectedFiles.length > 0 && (
                  <ul className="assignment-selected-files">
                    {selectedFiles.map((file) => <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>)}
                  </ul>
                )}
                {saving && (
                  <div className="assignment-upload-progress" role="status">
                    <progress value={uploadProgress} max="100" />
                    <span>Uploading {uploadProgress}%</span>
                  </div>
                )}
                <button className="button-primary" type="submit" disabled={saving}>
                  {saving ? "Saving submission..." : submission ? "Save Submission" : "Submit Assignment"}
                </button>
              </form>
            ) : null}
          </>
        ) : (
          <AssignmentReview assignment={assignment} />
        )}
      </section>
    </div>
  );
}
