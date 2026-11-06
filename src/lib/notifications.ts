"use client";

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission !== "denied") {
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (e) {
      console.error("Notification permission error:", e);
    }
  }
  return false;
}

export function scheduleTaskReminder(title: string, dateStr: string, timeStr?: string, reminderOption: string = "at_time") {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  try {
    const [year, month, day] = (dateStr || "").split("-").map(Number);
    if (!year || !month || !day) return;

    let hour = 9;
    let minute = 0;
    if (timeStr && timeStr.includes(":")) {
      const [h, m] = timeStr.split(":").map(Number);
      if (!isNaN(h)) hour = h;
      if (!isNaN(m)) minute = m;
    }

    const eventTime = new Date(year, month - 1, day, hour, minute, 0, 0);

    let offsetMinutes = 0;
    if (reminderOption === "5_min_before") offsetMinutes = 5;
    if (reminderOption === "10_min_before") offsetMinutes = 10;
    if (reminderOption === "15_min_before") offsetMinutes = 15;
    if (reminderOption === "30_min_before") offsetMinutes = 30;
    if (reminderOption === "1_hour_before") offsetMinutes = 60;
    if (reminderOption === "1_day_before") offsetMinutes = 1440;

    const notificationTime = new Date(eventTime.getTime() - offsetMinutes * 60 * 1000);
    const delay = notificationTime.getTime() - Date.now();

    if (delay > 0 && delay < 2147483647) {
      setTimeout(() => {
        if (Notification.permission === "granted") {
          new Notification("⏰ Task Reminder: " + title, {
            body: `Scheduled for ${timeStr || dateStr}`,
            icon: "/icon-192.png",
            tag: `reminder-${title}-${dateStr}`
          });
        }
      }, delay);
    } else if (delay <= 0 && Math.abs(delay) < 60000) {
      new Notification("⏰ Task Reminder: " + title, {
        body: `Scheduled for ${timeStr || dateStr}`,
        icon: "/icon-192.png",
        tag: `reminder-${title}-${dateStr}`
      });
    }
  } catch (e) {
    console.error("Error scheduling reminder:", e);
  }
}
