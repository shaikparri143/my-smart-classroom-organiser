import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../services/api";
import { getAccessToken } from "../../services/auth";

export default function DoubtBoxPage({ courses = [] }) {
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeCourseId = useMemo(() => {
    if (courses.some((course) => String(course.id) === String(courseId))) {
      return String(courseId);
    }
    return courses[0] ? String(courses[0].id) : "";
  }, [courseId, courses]);

  useEffect(() => {
    if (!activeCourseId) {
      setPosts([]);
      setLoading(false);
      return undefined;
    }

    let active = true;
    async function loadPosts() {
      setLoading(true);
      setError("");
      try {
        const result = await apiRequest(`/api/doubts/courses/${activeCourseId}`, {
          token: getAccessToken(),
        });
        if (active) {
          setPosts(result);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || "Unable to load course doubts.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPosts();
    return () => {
      active = false;
    };
  }, [activeCourseId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!activeCourseId || !title.trim() || !question.trim()) {
      return;
    }

    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/doubts/courses/${activeCourseId}`, {
        method: "POST",
        token: getAccessToken(),
        body: { title: title.trim(), question: question.trim() },
      });
      setTitle("");
      setQuestion("");
      setNotice("Your doubt was posted successfully.");
      const result = await apiRequest(`/api/doubts/courses/${activeCourseId}`, {
        token: getAccessToken(),
      });
      setPosts(result);
    } catch (requestError) {
      setError(requestError.message || "Unable to submit your doubt.");
    }
  }

  if (!courses.length) {
    return <p className="course-empty">Enroll in a course to start asking academic questions.</p>;
  }

  return (
    <div className="course-management">
      <section className="panel doubt-compose-card">
        <div className="panel-heading">
          <div>
            <h2>Doubt Box</h2>
            <p>Ask course-specific questions and follow up on responses.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="doubt-form">
          <label>
            Course
            <select value={activeCourseId} onChange={(event) => setCourseId(event.target.value)}>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.course_code} · {course.title}</option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Question summary" required />
          </label>
          <label>
            Question
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} placeholder="Explain the issue or concept you need help with" required />
          </label>
          <button type="submit" className="button-primary">Ask question</button>
        </form>
        {error && <p className="course-message course-error" role="alert">{error}</p>}
        {notice && <p className="course-message course-success" role="status">{notice}</p>}
      </section>

      <section className="panel doubt-threads">
        <div className="panel-heading">
          <div>
            <h2>Recent doubts</h2>
            <p>{loading ? "Loading..." : `${posts.length} questions`}</p>
          </div>
        </div>
        {loading ? (
          <p className="course-empty" role="status">Loading doubts...</p>
        ) : posts.length === 0 ? (
          <p className="course-empty">No doubts have been posted yet.</p>
        ) : (
          <div className="doubt-thread-list">
            {posts.map((post) => (
              <article key={post.id} className="panel doubt-thread">
                <div className="panel-heading">
                  <div>
                    <h3 style={{ margin: 0 }}>{post.title}</h3>
                  </div>
                  <span className="status-pill status-violet">{post.status}</span>
                </div>
                <p className="course-card-description">{post.question}</p>
                {post.answer ? <p className="course-meta">Teacher reply: {post.answer}</p> : <p className="course-empty">No response yet.</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
