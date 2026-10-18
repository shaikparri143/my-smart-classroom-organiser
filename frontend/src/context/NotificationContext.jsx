import { useCallback, useMemo } from "react";
import usePollingResource from "../hooks/usePollingResource";
import NotificationContext from "./notificationContextValue";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notifications";

export function NotificationProvider({ children }) {
  const loadNotifications = useCallback(
    (signal) => getNotifications(signal),
    [],
  );
  const resource = usePollingResource(loadNotifications, 12000);
  const {
    data,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
  } = resource;

  const actions = useMemo(
    () => ({
      async markRead(notificationId) {
        await markNotificationRead(notificationId);
        await refresh(true);
      },
      async markAllRead() {
        await markAllNotificationsRead();
        await refresh(true);
      },
    }),
    [refresh],
  );

  const value = useMemo(
    () => ({
      data,
      loading,
      refreshing,
      error,
      lastUpdated,
      refresh,
      ...actions,
    }),
    [actions, data, error, lastUpdated, loading, refresh, refreshing],
  );
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}