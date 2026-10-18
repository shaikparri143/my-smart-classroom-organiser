import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { apiRequest } from "../../services/api";
import { getAccessToken } from "../../services/auth";

export default function AssignmentRecipientPicker({
  courseId,
  selectedStudentIds,
  onSelectionChange,
  disabled = false,
}) {
  const [students, setStudents] = useState([]);
  const [loadedCourseId, setLoadedCourseId] = useState(null);
  const [loadState, setLoadState] = useState({ courseId: null, error: "" });
  const [search, setSearch] = useState("");
  const loading = Boolean(courseId && loadedCourseId !== courseId);
  const error = loadState.courseId === courseId ? loadState.error : "";

  useEffect(() => {
    if (!courseId) {
      return undefined;
    }
    const controller = new AbortController();
    apiRequest(`/api/assignments/course/${courseId}/students`, {
      token: getAccessToken(),
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        if (!Array.isArray(result)) {
          throw new Error("The server returned an invalid student list.");
        }
        setStudents(result);
        onSelectionChange(result.map((student) => student.id));
        setLoadState({ courseId, error: "" });
        setLoadedCourseId(courseId);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted && requestError.name !== "AbortError") {
          setLoadState({
            courseId,
            error: requestError.message || "Unable to load enrolled students.",
          });
          setLoadedCourseId(courseId);
        }
      });
    return () => controller.abort();
  }, [courseId, onSelectionChange]);

  const filteredStudents = students.filter((student) =>
    `${student.full_name} ${student.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  const allSelected =
    students.length > 0 &&
    students.every((student) => selectedStudentIds.includes(student.id));

  const toggleStudent = useCallback(
    (studentId) => {
      onSelectionChange(
        selectedStudentIds.includes(studentId)
          ? selectedStudentIds.filter((id) => id !== studentId)
          : [...selectedStudentIds, studentId],
      );
    },
    [onSelectionChange, selectedStudentIds],
  );

  return (
    <fieldset className="assignment-recipient-picker" disabled={disabled || loading}>
      <legend>Assign to students</legend>
      {loading && <p className="course-empty" role="status">Loading enrolled students...</p>}
      {error && <p className="course-message course-error" role="alert">{error}</p>}
      {!loading && !error && students.length === 0 ? (
        <p className="course-empty">No students are enrolled in this course yet.</p>
      ) : !loading && !error ? (
        <>
          <div className="assignment-recipient-toolbar">
            <label className="assignment-select-all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() =>
                  onSelectionChange(
                    allSelected ? [] : students.map((student) => student.id),
                  )
                }
              />
              Select All ({students.length})
            </label>
            <span>{selectedStudentIds.length} selected</span>
          </div>
          <label className="assignment-student-search">
            <Search size={15} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search students"
              aria-label="Search enrolled students"
            />
          </label>
          <div className="assignment-recipient-list">
            {filteredStudents.map((student) => (
              <label className="assignment-recipient-option" key={student.id}>
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes(student.id)}
                  onChange={() => toggleStudent(student.id)}
                />
                <span><strong>{student.full_name}</strong><small>{student.email}</small></span>
              </label>
            ))}
            {filteredStudents.length === 0 && (
              <p className="course-empty">No students match your search.</p>
            )}
          </div>
        </>
      ) : null}
    </fieldset>
  );
}
