import { useContext } from "react";
import NotificationContext from "../context/notificationContextValue";

export default function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "Notification components must be rendered inside NotificationProvider.",
    );
  }
  return context;
}