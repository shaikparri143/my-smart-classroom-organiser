import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import useNotifications from "../../hooks/useNotifications";
import "./NotificationCenter.css";

function NotificationFeed({ notifications, onMarkRead, onNavigate }) {
  if (!notifications.length) {
    return <p className="notification-empty">You are all caught up.</p>;
  }
  return (
    <div className="notification-feed">
      {notifications.map((notification) => (
        <article
          className={`notification-item ${notification.is_read ? "" : "notification-unread"}`}
          key={notification.id}
        >
          <div className="notification-item-copy">
            <strong>{notification.title}</strong>
            <p>{notification.message}</p>
            <time dateTime={notification.created_at}>
              {new Date(notification.created_at).toLocaleString()}
            </time>
          </div>
          {!notification.is_read && (
            <button
              type="button"
              className="notification-mark-read"
              aria-label={`Mark ${notification.title} as read`}
              onClick={() => onMarkRead(notification.id)}
            >
              <Check size={16} />
            </button>
          )}
          {notification.link && (
            <button
              type="button"
              className="notification-open-link"
              onClick={() => {
                const destination = {
                  "/assignments": "Assignments",
                  "/announcements": "Announcements",
                  "/discussions": "Discussions",
                }[notification.link];
                if (destination) onNavigate(destination);
              }}
            >
              Open
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

export function NotificationBell({ onNavigate }) {
  const {
    data: notifications,
    loading,
    refreshing,
    error,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  async function runAction(action) {
    setActionError("");
    try {
      await action();
    } catch (requestError) {
      setActionError(requestError.message || "Unable to update notifications.");
    }
  }

  return (
    <div className="notification-anchor">
      <button
        className="notification-button icon-button"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        aria-controls="notification-popover"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="notification-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          className="notification-popover"
          id="notification-popover"
          aria-label="Recent notifications"
        >
          <div className="notification-panel-heading">
            <div>
              <h2>Notifications</h2>
              <span>{unreadCount} unread</span>
            </div>
            <button
              type="button"
              className="notification-text-button"
              onClick={() => runAction(markAllRead)}
              disabled={!unreadCount}
            >
              <CheckCheck size={15} /> Mark all read
            </button>
          </div>
          {actionError && <p className="course-message course-error" role="alert">{actionError}</p>}
          {error ? (
            <div className="notification-load-error">
              <p role="alert">{error}</p>
              <button type="button" className="button-secondary" onClick={() => refresh(true)}>
                Retry
              </button>
            </div>
          ) : loading ? (
            <p className="notification-empty" role="status">Loading notifications...</p>
          ) : (
            <NotificationFeed
              notifications={notifications.slice(0, 12)}
              onMarkRead={(id) => runAction(() => markRead(id))}
              onNavigate={onNavigate}
            />
          )}
          {refreshing && <span className="notification-updating" role="status">Updating...</span>}
          <button
            type="button"
            className="notification-history-link"
            onClick={() => {
              setOpen(false);
              onNavigate("Notifications");
            }}
          >
            View notification history
          </button>
        </section>
      )}
    </div>
  );
}

export function NotificationsPage({ onNavigate }) {
  const {
    data: notifications,
    loading,
    refreshing,
    error,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();
  const [actionError, setActionError] = useState("");

  async function runAction(action) {
    setActionError("");
    try {
      await action();
    } catch (requestError) {
      setActionError(requestError.message || "Unable to update notifications.");
    }
  }

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  return (
    <section className="panel notification-history-panel">
      <div className="notification-panel-heading">
        <div>
          <h2>Notification history</h2>
          <span>{unreadCount} unread</span>
        </div>
        <button
          type="button"
          className="button-secondary"
          onClick={() => runAction(markAllRead)}
          disabled={!unreadCount}
        >
          <CheckCheck size={16} /> Mark all as read
        </button>
      </div>
      {actionError && <p className="course-message course-error" role="alert">{actionError}</p>}
      {error ? (
        <div className="notification-load-error">
          <p role="alert">{error}</p>
          <button type="button" className="button-secondary" onClick={() => refresh(true)}>
            Retry
          </button>
        </div>
      ) : loading ? (
        <p className="notification-empty" role="status">Loading notification history...</p>
      ) : (
        <NotificationFeed
          notifications={notifications}
          onMarkRead={(id) => runAction(() => markRead(id))}
          onNavigate={onNavigate}
        />
      )}
      {refreshing && <span className="notification-updating" role="status">Updating...</span>}
    </section>
  );
}
