const BASE_URL = "http://localhost:5000";

// ── Routing helpers ───────────────────────────────────────────────────────────

function openApp(path) {
  chrome.runtime.sendMessage({ type: "OPEN_APP", path: path || "/dashboard" });
}

// Wire every element that has data-path to open the app at that route
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-path]");
  if (btn) openApp(btn.dataset.path);
});

document.getElementById("footer-link")?.addEventListener("click", (e) => {
  e.preventDefault();
  openApp("/dashboard");
});

// ── Utility ───────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtSyncTime(ts) {
  if (!ts) return "not synced";
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins === 0) return "synced just now";
  if (mins === 1) return "synced 1m ago";
  return `synced ${mins}m ago`;
}

// ── Focus summary ─────────────────────────────────────────────────────────────

function updateFocus(studywellData, focusSession) {
  const today = todayStr();
  const sessions = studywellData?.sessions?.filter((s) => s.date === today) ?? [];
  const totalMins = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

  setText("focus-mins", totalMins);
  setText("focus-sessions", sessions.length);

  // Streak: consecutive days with at least one session
  const streak = calcStreak(studywellData?.daily_logs ?? []);
  setText("focus-streak", streak);

  const isActive = Boolean(focusSession?.active);
  const dot = document.getElementById("focus-active-dot");
  const label = document.getElementById("focus-active-text");
  dot?.classList.toggle("active", isActive);
  if (label) label.textContent = isActive ? "Session active" : "No active session";
}

function calcStreak(logs) {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const log = logs.find((l) => l.date === ds);
    if (log && (log.sessions_count > 0 || log.water_glasses > 0 || log.sleep_hours > 0)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ── Health summary ────────────────────────────────────────────────────────────

function updateHealth(moodData, waterData, sleepData) {
  const today = todayStr();
  const moodEmojis = { 1: "😢", 2: "😟", 3: "😐", 4: "🙂", 5: "😊" };

  const mood = moodData?.date === today ? moodData.mood : null;
  setText("health-mood", mood ? (moodEmojis[mood] ?? "—") : "—");

  const glasses = waterData?.date === today ? waterData.glasses : 0;
  setText("health-water", `${glasses}/8`);

  const sleepArr = Array.isArray(sleepData) ? sleepData : [];
  const todaySleep = sleepArr.find((s) => s.date === today);
  setText("health-sleep", todaySleep ? `${todaySleep.hours}h` : "—");
}

// ── Flashcard mini-quiz ───────────────────────────────────────────────────────

let _cards = [];

function updateFlashcardSection(cards) {
  _cards = Array.isArray(cards) ? cards : [];
  const section = document.getElementById("flashcard-section");
  if (!_cards.length) {
    section?.classList.add("hidden");
    return;
  }
  section?.classList.remove("hidden");
  setText("flashcard-count", _cards.length);
  showRandomCard();
}

function showRandomCard() {
  if (!_cards.length) return;
  const card = _cards[Math.floor(Math.random() * _cards.length)];
  setText("flashcard-front", card.question ?? "");
  setText("flashcard-back", card.answer ?? "");
  document.getElementById("flashcard-card")?.classList.remove("is-flipped");
}

document.getElementById("flashcard-card")?.addEventListener("click", () => {
  document.getElementById("flashcard-card")?.classList.toggle("is-flipped");
});

document.getElementById("flashcard-next")?.addEventListener("click", (e) => {
  e.stopPropagation();
  showRandomCard();
});

// ── Main refresh loop ─────────────────────────────────────────────────────────

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function applyData(sync) {
  if (!sync) {
    document.getElementById("summary-no-data")?.classList.remove("hidden");
    document.getElementById("summary-content")?.classList.add("hidden");
    return;
  }

  document.getElementById("summary-no-data")?.classList.add("hidden");
  document.getElementById("summary-content")?.classList.remove("hidden");

  updateFocus(sync.studywell_data, sync.studious_focus_session);
  updateHealth(sync.health_mood, sync.health_water, sync.health_sleep);
  updateFlashcardSection(sync.studious_flashcards);
  setText("sync-time", fmtSyncTime(sync.__synced_at));
}

function loadFromStorage() {
  chrome.storage.local.get("studyspace_sync", ({ studyspace_sync }) => {
    applyData(studyspace_sync ?? null);
  });
}

// ── Manual refresh button ─────────────────────────────────────────────────────

document.getElementById("refresh-btn")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "REQUEST_SYNC" });
  setTimeout(loadFromStorage, 600);
});

// ── Init + poll ───────────────────────────────────────────────────────────────

loadFromStorage();
setInterval(loadFromStorage, 8000);

// React to changes pushed by the content script in real time
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.studyspace_sync) {
    applyData(changes.studyspace_sync.newValue ?? null);
  }
});
