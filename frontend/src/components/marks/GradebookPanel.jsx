import { useEffect, useMemo, useState } from "react";
import {
  createCourseComponent,
  getComponentStudents,
  getCourseComponents,
  saveComponentMarks,
  updateComponent,
} from "../../services/marks";
import "./MarksPanels.css";

const emptyComponent = {
  name: "",
  max_marks: "",
  description: "",
  assessment_date: "",
  instructions: "",
};

function displayNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function GradebookPanel({
  courses = [],
  coursesLoading = false,
  coursesError = "",
}) {
  const [courseId, setCourseId] = useState("");
  const [components, setComponents] = useState([]);
  const [componentId, setComponentId] = useState("");
  const [students, setStudents] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [newComponent, setNewComponent] = useState(emptyComponent);
  const [editComponent, setEditComponent] = useState(emptyComponent);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeCourseId = courses.some((course) => String(course.id) === courseId)
    ? courseId
    : courses.length
      ? String(courses[0].id)
      : "";
  const selectedComponent = components.find(
    (component) => String(component.id) === componentId,
  );
  const currentMaximum = useMemo(
    () =>
      components
        .filter((component) => !component.is_archived)
        .reduce((total, component) => total + Number(component.max_marks), 0),
    [components],
  );

  useEffect(() => {
    if (!activeCourseId) {
      return undefined;
    }
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await getCourseComponents(activeCourseId, controller.signal);
        if (!controller.signal.aborted) {
          setComponents(result);
          setComponentId((current) => {
            if (result.some((component) => String(component.id) === current)) {
              return current;
            }
            const firstActive = result.find((component) => !component.is_archived);
            return String(firstActive?.id || result[0]?.id || "");
          });
        }
      } catch (requestError) {
        if (!controller.signal.aborted && requestError.name !== "AbortError") {
          setError(requestError.message || "Unable to load assessment components.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [activeCourseId]);

  useEffect(() => {
    if (!selectedComponent) {
      return undefined;
    }
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await getComponentStudents(
          selectedComponent.id,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setStudents(result);
          setDrafts(
            result.map((student) => ({
              student_id: student.student_id,
              score: student.score ?? "",
              feedback: student.feedback ?? "",
            })),
          );
          setEditComponent({
            name: selectedComponent.name,
            max_marks: String(selectedComponent.max_marks),
            description: selectedComponent.description || "",
            assessment_date: selectedComponent.assessment_date || "",
            instructions: selectedComponent.instructions || "",
          });
        }
      } catch (requestError) {
        if (!controller.signal.aborted && requestError.name !== "AbortError") {
          setError(requestError.message || "Unable to load enrolled students.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [selectedComponent]);

  async function reloadComponents() {
    const result = await getCourseComponents(activeCourseId);
    setComponents(result);
    return result;
  }

  async function addComponent(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const created = await createCourseComponent(activeCourseId, {
        name: newComponent.name.trim(),
        max_marks: Number(newComponent.max_marks),
        description: newComponent.description.trim() || null,
        assessment_date: newComponent.assessment_date || null,
        instructions: newComponent.instructions.trim() || null,
        display_order: components.length,
      });
      const result = await reloadComponents();
      setComponentId(String(created.id));
      setNewComponent(emptyComponent);
      setNotice("Assessment component added. Students see it once it is published.");
      if (result.length === 0) setComponentId("");
    } catch (requestError) {
      setError(requestError.message || "Unable to add this component.");
    } finally {
      setSaving(false);
    }
  }

  async function saveComponent(event) {
    event.preventDefault();
    if (!selectedComponent) return;
    if (
      Number(editComponent.max_marks) !== Number(selectedComponent.max_marks) &&
      students.some((student) => student.score !== null)
    ) {
      const accepted = window.confirm(
        "Changing the maximum can change existing percentages. The server will reject a maximum below any student's recorded score. Continue?",
      );
      if (!accepted) return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await updateComponent(selectedComponent.id, {
        name: editComponent.name.trim(),
        max_marks: Number(editComponent.max_marks),
        description: editComponent.description.trim() || null,
        assessment_date: editComponent.assessment_date || null,
        instructions: editComponent.instructions.trim() || null,
      });
      await reloadComponents();
      setNotice("Assessment component updated.");
    } catch (requestError) {
      setError(requestError.message || "Unable to update this component.");
    } finally {
      setSaving(false);
    }
  }

  async function changeComponent(patch, successMessage) {
    if (!selectedComponent) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await updateComponent(selectedComponent.id, patch);
      await reloadComponents();
      setNotice(successMessage);
    } catch (requestError) {
      setError(requestError.message || "Unable to update the component.");
    } finally {
      setSaving(false);
    }
  }

  async function moveComponent(direction) {
    const active = components.filter((item) => !item.is_archived);
    const index = active.findIndex((item) => item.id === selectedComponent?.id);
    const adjacent = active[index + direction];
    if (!adjacent) return;
    setSaving(true);
    try {
      await Promise.all([
        updateComponent(selectedComponent.id, { display_order: adjacent.display_order }),
        updateComponent(adjacent.id, { display_order: selectedComponent.display_order }),
      ]);
      await reloadComponents();
      setNotice("Assessment order updated.");
    } catch (requestError) {
      setError(requestError.message || "Unable to change assessment order.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveComponent() {
    if (!selectedComponent || !window.confirm(
      "Archive this component? Its recorded marks will be preserved but hidden from students.",
    )) return;
    await changeComponent(
      { is_archived: true, is_published: false },
      "Component archived. Existing marks are preserved.",
    );
  }

  async function saveMarks(event) {
    event.preventDefault();
    if (!selectedComponent || saving) return;
    setError("");
    setNotice("");
    const records = drafts
      .filter((record) => record.score !== "" && record.score !== null)
      .map((record) => ({
        student_id: record.student_id,
        score: Number(record.score),
        feedback: record.feedback.trim() || null,
      }));
    if (!records.length) {
      setError("Enter marks for at least one student before saving.");
      return;
    }
    const invalid = records.find(
      (record) =>
        !Number.isFinite(record.score) ||
        record.score < 0 ||
        record.score > Number(selectedComponent.max_marks),
    );
    if (invalid) {
      setError(`Marks must be between 0 and ${displayNumber(selectedComponent.max_marks)}.`);
      return;
    }
    setSaving(true);
    try {
      const result = await saveComponentMarks(selectedComponent.id, records);
      setStudents(result);
      setDrafts(
        result.map((student) => ({
          student_id: student.student_id,
          score: student.score ?? "",
          feedback: student.feedback ?? "",
        })),
      );
      setNotice("Marks saved successfully.");
    } catch (requestError) {
      setError(requestError.message || "Unable to save marks.");
    } finally {
      setSaving(false);
    }
  }

  if (coursesLoading) return <p className="course-empty" role="status">Loading your courses...</p>;
  if (coursesError) return <p className="course-message course-error" role="alert">{coursesError}</p>;
  if (!courses.length) return <p className="course-empty">Create a course before configuring marks.</p>;

  return (
    <section className="marks-page">
      {error && <p className="course-message course-error" role="alert">{error}</p>}
      {notice && <p className="course-message course-success" role="status">{notice}</p>}
      <section className="panel marks-controls">
        <label>
          Course
          <select value={activeCourseId} onChange={(event) => {
            setCourseId(event.target.value);
            setNotice("");
            setError("");
          }}>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.course_code} · {course.title}
              </option>
            ))}
          </select>
        </label>
        <div className="marks-total">
          Current maximum total <strong>{displayNumber(currentMaximum)}</strong>
          <span>Across all non-archived components; there is no fixed course total.</span>
        </div>
      </section>

      <section className="marks-layout">
        <div className="panel marks-components">
          <div className="panel-heading">
            <div><h2>Assessment components</h2><p>Add or update components whenever needed.</p></div>
          </div>
          {loading && <p className="course-empty" role="status">Loading components...</p>}
          {components.length > 0 && (
            <div className="marks-component-list">
              {components.map((component) => (
                <button
                  type="button"
                  className={`marks-component-item ${String(component.id) === componentId ? "is-selected" : ""}`}
                  key={component.id}
                  onClick={() => setComponentId(String(component.id))}
                >
                  <span><strong>{component.name}</strong><small>{component.is_archived ? "Archived" : component.is_published ? "Published" : "Draft"}</small></span>
                  <b>{displayNumber(component.max_marks)} marks</b>
                </button>
              ))}
            </div>
          )}
          {!components.length && !loading && <p className="course-empty">No assessment components yet.</p>}
          <form className="marks-form" onSubmit={addComponent}>
            <h3>Add component</h3>
            <label>Component name<input required maxLength={150} value={newComponent.name} onChange={(event) => setNewComponent({ ...newComponent, name: event.target.value })} /></label>
            <label>Maximum marks<input required type="number" min="0.01" step="0.01" value={newComponent.max_marks} onChange={(event) => setNewComponent({ ...newComponent, max_marks: event.target.value })} /></label>
            <label>Description<textarea maxLength={10000} value={newComponent.description} onChange={(event) => setNewComponent({ ...newComponent, description: event.target.value })} /></label>
            <label>Assessment date<input type="date" value={newComponent.assessment_date} onChange={(event) => setNewComponent({ ...newComponent, assessment_date: event.target.value })} /></label>
            <label>Instructions<textarea maxLength={10000} value={newComponent.instructions} onChange={(event) => setNewComponent({ ...newComponent, instructions: event.target.value })} /></label>
            <button className="button-primary" type="submit" disabled={saving}>{saving ? "Adding..." : "Add component"}</button>
          </form>
        </div>

        <div className="marks-main">
          {selectedComponent ? (
            <>
              <form className="panel marks-form" onSubmit={saveComponent}>
                <div className="panel-heading">
                  <div><h2>Edit {selectedComponent.name}</h2><p>Change order, maximum, instructions, or publication status.</p></div>
                </div>
                {!selectedComponent.is_archived && !selectedComponent.is_published && (
                  <p className="marks-release-note" role="status">
                    Draft: students cannot see these marks until you choose “Publish to students”.
                  </p>
                )}
                <label>Component name<input required maxLength={150} value={editComponent.name} onChange={(event) => setEditComponent({ ...editComponent, name: event.target.value })} /></label>
                <label>Maximum marks<input required type="number" min="0.01" step="0.01" value={editComponent.max_marks} onChange={(event) => setEditComponent({ ...editComponent, max_marks: event.target.value })} /></label>
                <label>Description<textarea maxLength={10000} value={editComponent.description} onChange={(event) => setEditComponent({ ...editComponent, description: event.target.value })} /></label>
                <label>Assessment date<input type="date" value={editComponent.assessment_date} onChange={(event) => setEditComponent({ ...editComponent, assessment_date: event.target.value })} /></label>
                <label>Instructions<textarea maxLength={10000} value={editComponent.instructions} onChange={(event) => setEditComponent({ ...editComponent, instructions: event.target.value })} /></label>
                <div className="marks-actions">
                  <button className="button-primary" type="submit" disabled={saving || selectedComponent.is_archived}>Save component</button>
                  <button type="button" className="button-secondary" onClick={() => moveComponent(-1)} disabled={saving || selectedComponent.is_archived}>Move up</button>
                  <button type="button" className="button-secondary" onClick={() => moveComponent(1)} disabled={saving || selectedComponent.is_archived}>Move down</button>
                  <button type="button" className="button-secondary" onClick={() => changeComponent({ is_published: !selectedComponent.is_published }, selectedComponent.is_published ? "Marks unpublished." : "Marks published to enrolled students.")} disabled={saving || selectedComponent.is_archived}>{selectedComponent.is_published ? "Unpublish" : "Publish to students"}</button>
                  {!selectedComponent.is_archived && <button type="button" className="button-danger" onClick={archiveComponent} disabled={saving}>Archive</button>}
                  {selectedComponent.is_archived && <button type="button" className="button-secondary" onClick={() => changeComponent({ is_archived: false }, "Component restored.")} disabled={saving}>Restore component</button>}
                </div>
              </form>
              <form className="panel marks-table-panel" onSubmit={saveMarks}>
                <div className="panel-heading">
                  <div><h2>Student marks</h2><p>Maximum: {displayNumber(selectedComponent.max_marks)} · Save once to create or update each entered mark.</p></div>
                  <span>{students.length} enrolled</span>
                </div>
                {selectedComponent.is_archived ? (
                  <p className="course-empty">This component is archived. Restore it before entering marks.</p>
                ) : students.length ? (
                  <>
                    <div className="marks-table-scroll">
                      <table className="marks-table">
                        <thead><tr><th>Student</th><th>Obtained / {displayNumber(selectedComponent.max_marks)}</th><th>Feedback</th></tr></thead>
                        <tbody>
                          {students.map((student, index) => (
                            <tr key={student.student_id}>
                              <td><strong>{student.student_name}</strong><small>{student.student_email}</small></td>
                              <td><input aria-label={`${student.student_name} marks`} type="number" min="0" max={selectedComponent.max_marks} step="0.01" value={drafts[index]?.score ?? ""} onChange={(event) => setDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, score: event.target.value } : row))} /></td>
                              <td><input aria-label={`${student.student_name} feedback`} maxLength={10000} value={drafts[index]?.feedback ?? ""} onChange={(event) => setDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, feedback: event.target.value } : row))} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button className="button-primary" type="submit" disabled={saving}>{saving ? "Saving marks..." : "Save marks"}</button>
                  </>
                ) : <p className="course-empty">No students are enrolled in this course yet.</p>}
              </form>
            </>
          ) : (
            <div className="panel marks-empty"><h2>Select or add an assessment component</h2><p>Components can be introduced at any point in the course.</p></div>
          )}
        </div>
      </section>
    </section>
  );
}
