import { useEffect, useState } from "react";
import Spinner from "../components/Spinner";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification
} from "../services/notificationService";
import { useLiveSync, triggerLiveSync } from "../hooks/useLiveSync";
import { navigate } from "../utils/router";

const formatDate = (value) =>
  new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const load = async (silent = false) => {
    if (!silent) setStatus("loading");
    try {
      const data = await getNotifications();
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      setStatus("ready");

      // Viewing notifications marks them as read
      const hasUnread = list.some((n) => n.status !== "Read");
      if (hasUnread) {
        await markAllNotificationsRead().catch(() => {});
        triggerLiveSync("notification_read");
      }
    } catch (requestError) {
      if (!silent) {
        setError(requestError.message);
        setStatus("error");
      }
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  useLiveSync(["notification_sent", "notification_read"], () => {
    load(true);
  }, 4000);

  async function handleMarkRead(id) {
    await markNotificationRead(id).catch(() => {});
    triggerLiveSync("notification_read");
    load(true);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead().catch(() => {});
    triggerLiveSync("notification_read");
    load(true);
  }

  async function handleDelete(id) {
    await deleteNotification(id).catch(() => {});
    triggerLiveSync("notification_read");
    load(true);
  }

  if (status === "loading") return <Spinner label="Loading notifications…" />;
  if (status === "error") return <ErrorState message={error} onRetry={() => load(false)} />;
  if (notifications.length === 0) return <EmptyState title="No notifications" description="You're all caught up." />;

  const hasUnread = notifications.some((n) => n.status !== "Read");

  return (
    <section className="orders-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <p className="eyebrow">Updates</p>
          <h1>Notifications</h1>
        </div>
        {hasUnread && (
          <button className="text-button" onClick={handleMarkAllRead} style={{ fontWeight: 600 }}>
            Mark all as read
          </button>
        )}
      </div>

      <ul className="notification-list">
        {notifications.map((notification) => {
          const isSuspension = notification.message?.toLowerCase().includes("suspended");
          const isPaused = notification.message?.toLowerCase().includes("paused");
          const isAppealable = isSuspension || isPaused;

          return (
            <li
              key={notification.notification_id}
              className={notification.status === "Read" ? "notification-item read" : "notification-item"}
            >
              <div>
                <p>{notification.message}</p>
                <span className="hint">{formatDate(notification.notification_date)}</span>
              </div>
              <div className="notification-actions">
                {isAppealable && (
                  <button
                    type="button"
                    className="text-button"
                    style={{ color: "#2359c4", fontWeight: 700 }}
                    onClick={() => {
                      if (isSuspension) {
                        navigate("/messages?support=admin&appeal=suspension");
                      } else {
                        navigate("/messages?support=admin&appeal=product");
                      }
                    }}
                  >
                    Appeal to Admin
                  </button>
                )}
                {notification.status !== "Read" && (
                  <button className="text-button" onClick={() => handleMarkRead(notification.notification_id)}>
                    Mark read
                  </button>
                )}
                <button className="text-button remove-link" onClick={() => handleDelete(notification.notification_id)}>
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
