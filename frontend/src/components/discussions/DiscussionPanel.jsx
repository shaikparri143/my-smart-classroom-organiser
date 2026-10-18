import { useCallback, useEffect, useState } from "react";
import usePollingResource from "../../hooks/usePollingResource";
import { Button, Modal } from "../common/DesignSystem";
import { useToast } from "../common/useDesignSystem";
import {
  createDiscussionPost,
  createDiscussionReply,
  deleteDiscussionPost,
  listDiscussionPosts,
  updateDiscussionPost,
} from "../../services/discussions";
import "./DiscussionPanel.css";

export default function DiscussionPanel({
  role,
  userId,
  courses = [],
  coursesLoading = false,
  coursesError = "",
}) {
  const isTeacher = role === "teacher";
  const [courseId, setCourseId] = useState("");
  const [message, setMessage] = useState("");
  const [replyDrafts, setReplyDrafts] = useState({});
  const [editing, setEditing] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pushToast = useToast();
  const activeCourseId = courses.some(
    (course) => String(course.id) === courseId,
  )
    ? courseId
    : courses.length
      ? String(courses[0].id)
      : "";
  const loadPosts = useCallback(
    (signal) =>
      activeCourseId
        ? listDiscussionPosts(activeCourseId, signal)
        : Promise.resolve([]),
    [activeCourseId],
  );
  const {
    data: posts,
    loading,
    refreshing,
    error: loadError,
    refresh,
  } = usePollingResource(loadPosts, 12000);

  useEffect(() => {
    refresh(true);
  }, [activeCourseId, refresh]);

  async function createPost(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving("new-post");
    try {
      await createDiscussionPost(Number(activeCourseId), message.trim());
      setMessage("");
      setNotice("Your discussion post was published.");
      pushToast("Your discussion post was published.", "success");
      await refresh(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to publish your post.");
    } finally {
      setSaving("");
    }
  }

  async function reply(event, post) {
    event.preventDefault();
    const replyMessage = replyDrafts[post.id]?.trim();
    if (!replyMessage) {
      return;
    }
    setError("");
    setNotice("");
    setSaving(`reply-${post.id}`);
    try {
      await createDiscussionReply(Number(activeCourseId), post.id, replyMessage);
      setReplyDrafts((current) => ({ ...current, [post.id]: "" }));
      setNotice("Your reply was published.");
      pushToast("Your reply was published.", "success");
      await refresh(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to publish your reply.");
    } finally {
      setSaving("");
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editing?.message.trim()) {
      setError("A discussion message cannot be blank.");
      return;
    }
    setError("");
    setNotice("");
    setSaving(`edit-${editing.id}`);
    try {
      await updateDiscussionPost(Number(activeCourseId), editing.id, editing.message.trim());
      setEditing(null);
      setNotice("Discussion post updated.");
      pushToast("Discussion post updated.", "success");
      await refresh(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to update this post.");
    } finally {
      setSaving("");
    }
  }

  async function removePost(post) {
    setError("");
    setNotice("");
    setSaving(`delete-${post.id}`);
    try {
      await deleteDiscussionPost(Number(activeCourseId), post.id);
      setNotice("Discussion post deleted.");
      pushToast("Discussion post deleted.", "success");
      setConfirmingDelete(null);
      await refresh(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete this post.");
    } finally {
      setSaving("");
    }
  }

  function canManage(post) {
    return isTeacher || post.author_id === userId;
  }

  function renderPost(post, isReply = false) {
    const isEditing = editing?.id === post.id;
    return (
      <article
        className={`discussion-message ${isReply ? "discussion-reply" : "discussion-root"}`}
        key={post.id}
        data-initials={post.author_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
      >
        <header>
          <div>
            <strong>{post.author_name}</strong>
            <span className="discussion-author-role">{post.author_role}</span>
            <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString()}</time>
          </div>
          {canManage(post) && !isEditing && (
            <div className="discussion-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setEditing({ id: post.id, message: post.message })}
                disabled={saving !== ""}
              >
                Edit
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setConfirmingDelete(post)}
                disabled={saving !== ""}
              >
                Delete
              </button>
            </div>
          )}
        </header>
        {isEditing ? (
          <form className="discussion-edit-form" onSubmit={saveEdit}>
            <textarea
              required
              maxLength={10000}
              rows={3}
              value={editing.message}
              onChange={(event) =>
                setEditing((current) => ({ ...current, message: event.target.value }))
              }
            />
            <button className="button-primary" type="submit" disabled={saving !== ""}>
              Save edit
            </button>
            <button className="button-secondary" type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </form>
        ) : (
          <p className="discussion-message-text">{post.message}</p>
        )}
      </article>
    );
  }

  if (coursesLoading) {
    return <p className="course-empty" role="status">Loading your courses...</p>;
  }
  if (coursesError) {
    return <p className="course-message course-error" role="alert">{coursesError}</p>;
  }

  return (
    <section className="discussion-page">
      <Modal
        open={Boolean(confirmingDelete)}
        onClose={() => setConfirmingDelete(null)}
        title="Delete discussion post?"
        className="discussion-delete-dialog"
      >
        <p>This will permanently delete this post and its replies.</p>
        <div className="discussion-delete-actions">
          <Button variant="secondary" type="button" onClick={() => setConfirmingDelete(null)}>Keep post</Button>
          <Button variant="danger" type="button" loading={saving.startsWith("delete-")} onClick={() => removePost(confirmingDelete)}>Delete post</Button>
        </div>
      </Modal>
      <section className="panel discussion-course-picker">
        <label>
          Course
          <select
            value={activeCourseId}
            onChange={(event) => setCourseId(event.target.value)}
            disabled={!courses.length}
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.course_code} · {course.title}
              </option>
            ))}
          </select>
        </label>
      </section>
      {!courses.length ? (
        <p className="course-empty">Join or create a course to participate in discussions.</p>
      ) : (
        <>
          <form className="panel discussion-compose" onSubmit={createPost}>
            <label htmlFor="discussion-message">Start a course discussion</label>
            <textarea
              id="discussion-message"
              required
              maxLength={10000}
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Share a question, idea, or update with your class..."
            />
            <button className="button-primary" type="submit" disabled={saving !== ""}>
              {saving === "new-post" ? "Posting..." : "Post to discussion"}
            </button>
          </form>
          {error && <p className="course-message course-error" role="alert">{error}</p>}
          {notice && <p className="course-message course-success" role="status">{notice}</p>}
          <section className="discussion-thread-list" aria-label="Course discussion threads">
            <div className="panel-heading">
              <div>
                <h2>Classroom discussions</h2>
                {refreshing && <span role="status">Updating...</span>}
              </div>
            </div>
            {loadError ? (
              <div className="course-message course-error" role="alert">
                {loadError}
                <button className="button-secondary" type="button" onClick={() => refresh(true)}>
                  Retry
                </button>
              </div>
            ) : loading ? (
              <p className="course-empty" role="status">Loading discussions...</p>
            ) : posts.length ? (
              posts.map((post) => (
                <article className="panel discussion-thread" key={post.id}>
                  {renderPost(post)}
                  {post.replies.map((item) => renderPost(item, true))}
                  <form className="discussion-reply-form" onSubmit={(event) => reply(event, post)}>
                    <label className="sr-only" htmlFor={`reply-${post.id}`}>
                      Reply to {post.author_name}
                    </label>
                    <textarea
                      id={`reply-${post.id}`}
                      rows={2}
                      maxLength={10000}
                      value={replyDrafts[post.id] || ""}
                      onChange={(event) =>
                        setReplyDrafts((current) => ({
                          ...current,
                          [post.id]: event.target.value,
                        }))
                      }
                      placeholder="Write a reply..."
                    />
                    <button
                      className="button-secondary"
                      type="submit"
                      disabled={saving !== "" || !replyDrafts[post.id]?.trim()}
                    >
                      {saving === `reply-${post.id}` ? "Replying..." : "Reply"}
                    </button>
                  </form>
                </article>
              ))
            ) : (
              <p className="course-empty">No discussion posts yet. Start the conversation.</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
