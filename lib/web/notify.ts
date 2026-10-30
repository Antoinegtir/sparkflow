"use client";

/**
 * System notifications when Sparkflow finishes, for a tab that isn't in front. Browsers only let a
 * page ask for the permission from a click, so it's asked when you start a build or send a change.
 */
export function askToNotify() {
  if (typeof Notification === "undefined" || Notification.permission !== "default") return;
  void Notification.requestPermission().catch(() => {});
}

/** Shows one if the tab is hidden or not focused and notifications are allowed; whether it did. */
export function notify(title: string, body: string, tag: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  if (!document.hidden && document.hasFocus()) return false;
  try {
    const n = new Notification(title, { body, tag, icon: "/icon.png" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    // Some browsers (Android Chrome) only notify from a service worker.
    return false;
  }
}

/** Marks the tab's title (✓ or !) until the tab is looked at again. */
export function markTitle(mark: string) {
  if (!document.hidden && document.hasFocus()) return;
  const plain = document.title.replace(/^[✓!] /, "");
  document.title = `${mark} ${plain}`;
  const clear = () => {
    document.title = document.title.replace(/^[✓!] /, "");
    removeEventListener("focus", clear);
    document.removeEventListener("visibilitychange", onVisible);
  };
  const onVisible = () => !document.hidden && clear();
  addEventListener("focus", clear);
  document.addEventListener("visibilitychange", onVisible);
}
