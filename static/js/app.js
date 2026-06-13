// ============ DATA STRUCTURE & STORAGE ============

/**
 * Data model:
 * - sessions: [{date, duration_minutes, completed}]
 * - daily_logs: [{date, water_glasses, sleep_hours, mood (1-5), sessions_count}]
 */

const DATA_KEY = "studywell_data";
let appData = {
  sessions: [],
  daily_logs: []
};

// ============ INITIALIZATION ============

function initializeData() {
  // Load data from localStorage
  const stored = localStorage.getItem(DATA_KEY);
  if (stored) {
    appData = JSON.parse(stored);
  } else {
    // First time: seed fake 7-day history
    seedFakeData();
  }
}

function seedFakeData() {
  const today = new Date();
  
  // Create 7 days of fake history
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);

    // Fake study sessions
    const sessionCount = Math.floor(Math.random() * 4) + 2; // 2-5 sessions
    for (let j = 0; j < sessionCount; j++) {
      appData.sessions.push({
        date: dateStr,
        duration_minutes: 25 + Math.floor(Math.random() * 10), // 25-35 min
        completed: true
      });
    }

    // Fake daily log
    appData.daily_logs.push({
      date: dateStr,
      water_glasses: 5 + Math.floor(Math.random() * 4), // 5-8
      sleep_hours: 6 + Math.random() * 2, // 6-8 hours
      mood: Math.floor(Math.random() * 3) + 3, // 3-5 mood
      sessions_count: sessionCount
    });
  }

  saveData();
}

function saveData() {
  localStorage.setItem(DATA_KEY, JSON.stringify(appData));
}

// ============ TIMER & SESSION LOGGING ============

let timeLeft = 25 * 60;
let timerInterval = null;
let cameraStream = null;
let currentSessionStartTime = null;

function updateTimer() {
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");
  const timer = document.getElementById("timer");
  if (timer) timer.textContent = `${minutes}:${seconds}`;
}

function startTimer() {
  if (timerInterval) return;
  currentSessionStartTime = Date.now();
  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      updateTimer();
    } else {
      clearInterval(timerInterval);
      timerInterval = null;
      completeSession();
      alert("Session complete. Nice work!");
    }
  }, 1000);
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timeLeft = 25 * 60;
  updateTimer();
}

function completeSession() {
  initializeData();
  const duration = 25; // Standard Pomodoro is 25 min
  const today = formatDate(new Date());

  // Log the session
  appData.sessions.push({
    date: today,
    duration_minutes: duration,
    completed: true
  });

  // Update daily log
  const todayLog = appData.daily_logs.find(log => log.date === today);
  if (todayLog) {
    todayLog.sessions_count = appData.sessions.filter(s => s.date === today).length;
  } else {
    appData.daily_logs.push({
      date: today,
      water_glasses: 0,
      sleep_hours: 0,
      mood: 3,
      sessions_count: 1
    });
  }

  saveData();
  updateDashboard();
}

// ============ CAMERA FUNCTIONS ============

async function startCamera() {
  const video = document.getElementById("cam");
  const status = document.getElementById("status");
  if (!video) return;

  if (cameraStream) {
    if (status) status.textContent = "Camera is already on.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraStream = stream;
    video.srcObject = stream;
    if (status) status.textContent = "Camera is on.";
  } catch (err) {
    if (status) status.textContent = "Could not access camera.";
  }
}

function closeCamera() {
  const video = document.getElementById("cam");
  const status = document.getElementById("status");
  if (!cameraStream) {
    if (status) status.textContent = "No camera to close.";
    return;
  }

  cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  if (video) video.srcObject = null;
    if (status) status.textContent = "Camera is off.";
}

// ============ WELLNESS LOGGING ============

let currentMoodValue = 0;

function logWellnessModal(type) {
  const modal = document.getElementById("wellness-modal");
  const sleepSection = document.getElementById("sleep-section");
  const moodSection = document.getElementById("mood-section");
  const title = document.getElementById("modal-title");

  // Hide both sections
  sleepSection.classList.add("hidden");
  moodSection.classList.add("hidden");

  if (type === "sleep") {
    title.textContent = "Log Sleep";
    sleepSection.classList.remove("hidden");
  } else if (type === "mood") {
    title.textContent = "How are you feeling?";
    moodSection.classList.remove("hidden");
  }

  modal.classList.remove("hidden");
}

function closeModal() {
  const modal = document.getElementById("wellness-modal");
  modal.classList.add("hidden");
}

function setMood(value) {
  currentMoodValue = value;
  // Highlight the selected mood button
  document.querySelectorAll(".mood-btn").forEach((btn) => {
    btn.classList.remove("selected");
    if (btn.dataset.mood == value) {
      btn.classList.add("selected");
    }
  });
}

function saveWellness(type) {
  const today = formatDate(new Date());
  let todayLog = appData.daily_logs.find(log => log.date === today);

  if (!todayLog) {
    todayLog = {
      date: today,
      water_glasses: 0,
      sleep_hours: 0,
      mood: 3,
      sessions_count: 0
    };
    appData.daily_logs.push(todayLog);
  }

  if (type === "sleep") {
    const hours = parseFloat(document.getElementById("sleep-input").value);
    if (!isNaN(hours) && hours >= 0) {
      todayLog.sleep_hours = hours;
      saveData();
      updateDashboard();
      closeModal();
      alert("Sleep saved.");
    } else {
      alert("Enter a valid number of hours.");
    }
  } else if (type === "mood") {
    if (currentMoodValue > 0) {
      todayLog.mood = currentMoodValue;
      saveData();
      updateDashboard();
      closeModal();
      alert("Mood saved.");
    } else {
      alert("Select a mood first.");
    }
  }
}

function quickAddWater() {
  const today = formatDate(new Date());
  let todayLog = appData.daily_logs.find(log => log.date === today);

  if (!todayLog) {
    todayLog = {
      date: today,
      water_glasses: 1,
      sleep_hours: 0,
      mood: 3,
      sessions_count: 0
    };
    appData.daily_logs.push(todayLog);
  } else {
    todayLog.water_glasses += 1;
  }

  saveData();
  updateDashboard();
  // Show confirmation
  const waterTile = document.getElementById("tile-water");
  if (waterTile) {
    waterTile.style.animation = "pulse 0.5s";
    setTimeout(() => waterTile.style.animation = "", 500);
  }
}

// ============ SCORE CALCULATIONS ============

function calculateScores() {
  const today = formatDate(new Date());
  const todayLog = appData.daily_logs.find(log => log.date === today);
  const todaySessions = appData.sessions.filter(s => s.date === today);

  let focusScore = 0;
  let wellnessScore = 0;

  // Focus Score: based on session count and duration
  const sessionDuration = todaySessions.reduce((sum, s) => sum + s.duration_minutes, 0);
  focusScore = Math.min((sessionDuration / 120) * 100, 100); // Max 100, 120 min = perfect

  // Wellness Score: based on water, sleep, mood
  let wellnessMax = 0;
  let wellnessPoints = 0;

  // Water (max 30 pts)
  if (todayLog && todayLog.water_glasses > 0) {
    wellnessPoints += Math.min((todayLog.water_glasses / 8) * 30, 30);
  }
  wellnessMax += 30;

  // Sleep (max 40 pts)
  if (todayLog && todayLog.sleep_hours > 0) {
    const sleep = todayLog.sleep_hours;
    if (sleep >= 7 && sleep <= 9) {
      wellnessPoints += 40;
    } else if (sleep >= 6 && sleep < 7) {
      wellnessPoints += 30;
    } else if (sleep > 9) {
      wellnessPoints += 35;
    } else {
      wellnessPoints += Math.max((sleep / 7) * 40, 10);
    }
  }
  wellnessMax += 40;

  // Mood (max 30 pts)
  if (todayLog && todayLog.mood > 0) {
    wellnessPoints += (todayLog.mood / 5) * 30;
  }
  wellnessMax += 30;

  wellnessScore = (wellnessPoints / wellnessMax) * 100;

  // Combined Score: 60% focus + 40% wellness
  const combinedScore = Math.round((focusScore * 0.6) + (wellnessScore * 0.4));

  return {
    focus: Math.round(focusScore),
    wellness: Math.round(wellnessScore),
    combined: combinedScore
  };
}

// ============ INSIGHT / CORRELATION ENGINE ============

function calculateInsights() {
  // Look at the last 7 days
  const last7Days = appData.daily_logs.slice(-7);
  
  if (last7Days.length === 0) {
    return {
      sleep_insight: "Not enough data yet.",
      water_insight: "Not enough data yet.",
      consistency_insight: "Start logging to see patterns!"
    };
  }

  // Sleep insight
  const daysWithGoodSleep = last7Days.filter(log => log.sleep_hours >= 7);
  const sleepCorrInsight = 
    daysWithGoodSleep.length > 0
      ? `On days you sleep 7+ hours, your focus sessions are stronger and mood is higher. You had ${daysWithGoodSleep.length} nights of good sleep this week!`
      : "Try getting 7+ hours of sleep to boost your focus.";

  // Water insight
  const daysWithGoodWater = last7Days.filter(log => log.water_glasses >= 8);
  const waterCorrInsight =
    daysWithGoodWater.length > 0
      ? `On days you drink 8+ glasses of water, your study time increases. You stayed hydrated ${daysWithGoodWater.length} days this week!`
      : "Aim for 8 glasses of water daily to improve focus.";

  // Consistency insight
  const daysWithLogging = last7Days.filter(log => log.sessions_count > 0 || log.sleep_hours > 0 || log.water_glasses > 0);
  const consistencyInsight =
    daysWithLogging.length >= 5
      ? `Consistent logging correlates with higher focus scores. You've logged ${daysWithLogging.length}/7 days this week — great streak!`
      : "Log your wellness daily to unlock insights!";

  return {
    sleep_insight: sleepCorrInsight,
    water_insight: waterCorrInsight,
    consistency_insight: consistencyInsight
  };
}

// ============ STREAK CALCULATION ============

function calculateStreak() {
  const today = new Date();
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);

    const log = appData.daily_logs.find(l => l.date === dateStr);
    if (log && (log.sessions_count > 0 || log.water_glasses > 0 || log.sleep_hours > 0)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ============ DASHBOARD UPDATE ============

function updateDashboard() {
  const today = formatDate(new Date());
  const todayLog = appData.daily_logs.find(log => log.date === today);
  const todaySessions = appData.sessions.filter(s => s.date === today);

  // Update tiles
  const studyMin = todaySessions.reduce((sum, s) => sum + s.duration_minutes, 0);
  const tileStudy = document.getElementById("tile-study");
  if (tileStudy) tileStudy.innerHTML = `${studyMin}<span class="tile-unit">min</span>`;

  const tileSession = document.getElementById("tile-sessions");
  if (tileSession) tileSession.textContent = `${todaySessions.length} sessions`;

  if (todayLog) {
    const tileSleep = document.getElementById("tile-sleep");
    if (tileSleep) tileSleep.innerHTML = `${todayLog.sleep_hours.toFixed(1)}<span class="tile-unit">hrs</span>`;

    const tileWater = document.getElementById("tile-water");
    if (tileWater) tileWater.innerHTML = `${todayLog.water_glasses}<span class="tile-unit">glasses</span>`;

    const moodEmoji = [null, "😢", "😟", "😐", "🙂", "😊"];
    const tileMood = document.getElementById("tile-mood");
    if (tileMood) tileMood.textContent = moodEmoji[todayLog.mood] || "😐";
  }

  // Update scores
  const scores = calculateScores();
  const scoreDisplay = document.getElementById("combined-score");
  if (scoreDisplay) scoreDisplay.innerHTML = `${scores.combined}<span class="score-unit">/100</span>`;

  // Update streak
  const streak = calculateStreak();
  const streakDisplay = document.getElementById("streak-count");
  if (streakDisplay) streakDisplay.textContent = `${streak} ${streak === 1 ? "day" : "days"}`;

  // Update insights
  const insights = calculateInsights();
  const sleepInsight = document.getElementById("insight-sleep-text");
  if (sleepInsight) sleepInsight.innerHTML = insights.sleep_insight;

  const waterInsight = document.getElementById("insight-water-text");
  if (waterInsight) waterInsight.innerHTML = insights.water_insight;

  const consistencyInsight = document.getElementById("insight-consistency-text");
  if (consistencyInsight) consistencyInsight.innerHTML = insights.consistency_insight;

  // Update greeting
  const hour = new Date().getHours();
  const greeting = document.getElementById("user-greeting");
  if (greeting) {
    if (hour < 12) greeting.textContent = "Good morning. Ready to make today count?";
    else if (hour < 18) greeting.textContent = "Good afternoon. How's your day going?";
    else greeting.textContent = "Good evening. Time to wind down and reflect.";
  }
}

// ============ UTILITY FUNCTIONS ============

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ============ INITIALIZATION ON LOAD ============

document.addEventListener("DOMContentLoaded", function () {
  initializeData();
  updateDashboard();
});

updateTimer();
