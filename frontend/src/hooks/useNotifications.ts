import { useState, useEffect, useCallback } from "react";

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    }
    return "denied" as NotificationPermission;
  }, []);

  const showNotification = useCallback(
    (title: string, body: string) => {
      if (permission === "granted") {
        new Notification(title, { body });
      }
    },
    [permission]
  );

  return { permission, requestPermission, showNotification };
}
