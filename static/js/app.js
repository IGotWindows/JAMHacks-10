let timeLeft = 25 * 60;
let timerInterval = null;
let cameraStream = null;
let flashcards = [];

function updateTimer() {
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");
  const timer = document.getElementById("timer");
  if (timer) timer.textContent = `${minutes}:${seconds}`;
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      updateTimer();
    } else {
      clearInterval(timerInterval);
      timerInterval = null;
      alert("Session complete!");
    }
  }, 1000);
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timeLeft = 25 * 60;
  updateTimer();
}

async function startCamera() {
  const video = document.getElementById("cam");
  const status = document.getElementById("status");
  if (!video) return;

  if (cameraStream) {
    if (status) status.textContent = "Camera is already running.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraStream = stream;
    video.srcObject = stream;
    if (status) status.textContent = "Camera is running.";
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
  if (status) status.textContent = "Camera stopped.";
}

function addFlashcard() {
  const question = document.getElementById("question");
  const answer = document.getElementById("answer");
  const list = document.getElementById("flashcard-list");

  if (!question || !answer || !list) return;
  if (!question.value.trim() || !answer.value.trim()) return;

  flashcards.push({ question: question.value, answer: answer.value });

  const li = document.createElement("li");
  li.textContent = `${question.value} — ${answer.value}`;
  list.appendChild(li);

  question.value = "";
  answer.value = "";
}

updateTimer();