// Runs on every StudySpace page. Reads localStorage and pushes it into
// chrome.storage.local so the sidebar can read it without CORS issues.
(function () {
  const KEYS = [
    "studywell_data",
    "studious_focus_session",
    "studious_flashcards",
    "health_mood",
    "health_water",
    "health_sleep",
  ];

  function syncToStorage() {
    const payload = {};
    for (const key of KEYS) {
      try {
        const raw = localStorage.getItem(key);
        payload[key] = raw ? JSON.parse(raw) : null;
      } catch {
        payload[key] = null;
      }
    }
    payload.__synced_at = Date.now();
    chrome.storage.local.set({ studyspace_sync: payload });
  }

  // Initial push
  syncToStorage();

  // Re-push when another tab writes to localStorage (storage event fires for
  // changes made by OTHER documents in the same origin)
  window.addEventListener("storage", syncToStorage);

  // Re-push when focus.js saves a session or updates the session state
  window.addEventListener("studious-session-saved", syncToStorage);
  window.addEventListener("studious-focus-session-updated", syncToStorage);

  // Polling fallback so active session progress stays current in the sidebar
  setInterval(syncToStorage, 3000);

  // Listen for a manual refresh request from the sidebar
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "REQUEST_SYNC") syncToStorage();
  });
})();
