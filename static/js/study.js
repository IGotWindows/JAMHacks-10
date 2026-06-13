const FLASHCARDS_STORAGE_KEY = "studious_flashcards";

let flashcards = [];
let quizCards = [];
let studyIndex = 0;
let studyRevealed = false;
let quizActive = false;

const SWIPE_THRESHOLD = 56;
let swipeStartX = 0;
let swipeCurrentX = 0;
let isDragging = false;
let didDrag = false;

function loadFlashcards() {
  try {
    const stored = JSON.parse(localStorage.getItem(FLASHCARDS_STORAGE_KEY));
    flashcards = Array.isArray(stored) ? stored : [];
  } catch {
    flashcards = [];
  }
}

function saveFlashcards() {
  localStorage.setItem(FLASHCARDS_STORAGE_KEY, JSON.stringify(flashcards));
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shuffleCards(cards) {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function renderFlashcards() {
  const list = document.getElementById("flashcard-list");
  const emptyMsg = document.getElementById("no-flashcards");
  if (!list || !emptyMsg) return;

  list.innerHTML = "";

  if (flashcards.length === 0) {
    emptyMsg.classList.remove("hidden");
    updateQuizLauncher();
    if (quizActive) endQuiz();
    return;
  }

  emptyMsg.classList.add("hidden");

  flashcards.forEach((card) => {
    const item = document.createElement("li");
    item.className = "flashcard-item";

    const body = document.createElement("div");
    body.className = "flashcard-body";

    const question = document.createElement("p");
    question.className = "flashcard-question";
    question.innerHTML = `<span class="flashcard-label">Q</span>${escapeHtml(card.question)}`;

    const answer = document.createElement("p");
    answer.className = "flashcard-answer";
    answer.innerHTML = `<span class="flashcard-label">A</span>${escapeHtml(card.answer)}`;

    body.appendChild(question);
    body.appendChild(answer);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn secondary btn-small flashcard-remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeFlashcard(card.id));

    item.appendChild(body);
    item.appendChild(removeBtn);
    list.appendChild(item);
  });

  updateQuizLauncher();
  if (quizActive) renderStudyCard();
}

function updateQuizLauncher() {
  const summaryEl = document.getElementById("quiz-deck-summary");
  const startBtn = document.getElementById("start-quiz-btn");
  const emptyMsg = document.getElementById("quiz-empty-msg");
  const launcher = document.getElementById("quiz-launcher");
  if (!summaryEl || !startBtn || !emptyMsg || !launcher) return;

  if (quizActive) {
    launcher.classList.add("hidden");
    return;
  }

  launcher.classList.remove("hidden");

  if (flashcards.length === 0) {
    summaryEl.textContent = "Your deck is empty.";
    startBtn.disabled = true;
    emptyMsg.classList.remove("hidden");
    return;
  }

  const label = flashcards.length === 1 ? "card" : "cards";
  summaryEl.textContent = `You have ${flashcards.length} ${label} ready to review.`;
  startBtn.disabled = false;
  emptyMsg.classList.add("hidden");
}

function startQuiz() {
  if (flashcards.length === 0) return;

  quizCards = shuffleCards(flashcards);
  studyIndex = 0;
  studyRevealed = false;
  quizActive = true;

  const quizMode = document.getElementById("quiz-mode");
  const cardView = document.getElementById("quiz-card-view");
  const completeView = document.getElementById("quiz-complete-view");
  if (quizMode) quizMode.classList.remove("hidden");
  if (cardView) cardView.classList.remove("hidden");
  if (completeView) completeView.classList.add("hidden");

  updateQuizLauncher();
  renderStudyCard();
  quizMode?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function endQuiz() {
  quizActive = false;
  studyIndex = 0;
  studyRevealed = false;
  quizCards = [];

  const quizMode = document.getElementById("quiz-mode");
  const cardView = document.getElementById("quiz-card-view");
  const completeView = document.getElementById("quiz-complete-view");
  if (quizMode) quizMode.classList.add("hidden");
  if (cardView) cardView.classList.remove("hidden");
  if (completeView) completeView.classList.add("hidden");

  updateQuizLauncher();
}

function showQuizComplete() {
  const cardView = document.getElementById("quiz-card-view");
  const completeView = document.getElementById("quiz-complete-view");
  const countEl = document.getElementById("quiz-complete-count");
  if (cardView) cardView.classList.add("hidden");
  if (completeView) completeView.classList.remove("hidden");
  if (countEl) countEl.textContent = String(quizCards.length);
}

function renderStudyCard(enterFrom = null) {
  if (!quizActive || quizCards.length === 0) return;

  const card = quizCards[studyIndex];
  const progressEl = document.getElementById("study-progress");
  const labelEl = document.getElementById("study-card-label");
  const textEl = document.getElementById("study-card-text");
  const hintEl = document.getElementById("study-card-hint");
  const cardBtn = document.getElementById("study-card");

  if (!card || !progressEl || !labelEl || !textEl || !hintEl || !cardBtn) {
    return;
  }

  resetCardTransform(cardBtn);
  cardBtn.classList.remove("slide-in-from-left", "slide-in-from-right");
  if (enterFrom === "left") cardBtn.classList.add("slide-in-from-left");
  if (enterFrom === "right") cardBtn.classList.add("slide-in-from-right");

  progressEl.textContent = `Card ${studyIndex + 1} of ${quizCards.length}`;
  labelEl.textContent = studyRevealed ? "Answer" : "Question";
  textEl.textContent = studyRevealed ? card.answer : card.question;
  hintEl.textContent = studyRevealed
    ? "Tap to show the question"
    : "Tap to reveal the answer";

  cardBtn.classList.toggle("is-revealed", studyRevealed);
}

function resetCardTransform(cardBtn) {
  const card = cardBtn || document.getElementById("study-card");
  if (!card) return;
  card.style.transform = "";
  card.style.opacity = "";
  card.style.transition = "";
}

function toggleStudyCard() {
  if (!quizActive || quizCards.length === 0) return;
  studyRevealed = !studyRevealed;
  renderStudyCard();
}

function goToStudyCard(offset, enterFrom = null) {
  if (!quizActive || quizCards.length === 0) return;

  const nextIndex = studyIndex + offset;
  if (nextIndex < 0) return;

  if (nextIndex >= quizCards.length) {
    showQuizComplete();
    return;
  }

  studyIndex = nextIndex;
  studyRevealed = false;
  renderStudyCard(enterFrom);
}

function animateCardSwipe(direction) {
  const cardBtn = document.getElementById("study-card");
  if (!cardBtn) return;

  const offScreen = direction < 0 ? -window.innerWidth : window.innerWidth;
  cardBtn.style.transition = "transform 0.22s ease, opacity 0.22s ease";
  cardBtn.style.transform = `translateX(${offScreen}px) rotate(${direction * 8}deg)`;
  cardBtn.style.opacity = "0";

  window.setTimeout(() => {
    resetCardTransform(cardBtn);
    if (direction < 0) {
      goToStudyCard(1, "right");
    } else {
      goToStudyCard(-1, "left");
    }
  }, 220);
}

function initStudyCardSwipe() {
  const cardBtn = document.getElementById("study-card");
  if (!cardBtn) return;

  const onStart = (clientX) => {
    if (!quizActive) return;
    isDragging = true;
    didDrag = false;
    swipeStartX = clientX;
    swipeCurrentX = 0;
    cardBtn.classList.add("is-dragging");
    resetCardTransform(cardBtn);
  };

  const onMove = (clientX) => {
    if (!isDragging) return;
    swipeCurrentX = clientX - swipeStartX;
    if (Math.abs(swipeCurrentX) > 8) didDrag = true;
    const atFirst = studyIndex === 0 && swipeCurrentX > 0;
    const resistance = atFirst ? 0.35 : 1;
    const x = swipeCurrentX * resistance;
    cardBtn.style.transform = `translateX(${x}px) rotate(${x * 0.03}deg)`;
    cardBtn.style.opacity = String(Math.max(0.55, 1 - Math.abs(x) / 420));
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    cardBtn.classList.remove("is-dragging");

    if (swipeCurrentX < -SWIPE_THRESHOLD) {
      animateCardSwipe(-1);
    } else if (swipeCurrentX > SWIPE_THRESHOLD && studyIndex > 0) {
      animateCardSwipe(1);
    } else {
      resetCardTransform(cardBtn);
    }

    swipeCurrentX = 0;
  };

  cardBtn.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    cardBtn.setPointerCapture(event.pointerId);
    onStart(event.clientX);
  });

  cardBtn.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    onMove(event.clientX);
  });

  cardBtn.addEventListener("pointerup", onEnd);
  cardBtn.addEventListener("pointercancel", onEnd);

  cardBtn.addEventListener("click", (event) => {
    if (didDrag) {
      didDrag = false;
      event.preventDefault();
      return;
    }
    toggleStudyCard();
  });
}

function addFlashcard() {
  const questionInput = document.getElementById("question");
  const answerInput = document.getElementById("answer");
  if (!questionInput || !answerInput) return;

  const question = questionInput.value.trim();
  const answer = answerInput.value.trim();
  if (!question || !answer) {
    alert("Enter both a question and an answer.");
    return;
  }

  flashcards.push({
    id: `card-${Date.now()}`,
    question,
    answer,
  });

  saveFlashcards();
  renderFlashcards();
  questionInput.value = "";
  answerInput.value = "";
  questionInput.focus();
}

function removeFlashcard(id) {
  flashcards = flashcards.filter((card) => card.id !== id);
  saveFlashcards();
  renderFlashcards();
}

function clearFlashcards() {
  if (flashcards.length === 0) return;
  if (!confirm("Clear every flashcard in your deck?")) return;
  flashcards = [];
  saveFlashcards();
  renderFlashcards();
}

async function generateFlashcards() {
  const pdfInput = document.getElementById("notes-pdf");
  const countInput = document.getElementById("ai-count");
  const statusEl = document.getElementById("ai-status");
  const generateBtn = document.getElementById("generate-flashcards-btn");
  if (!pdfInput || !countInput || !statusEl || !generateBtn) return;

  const file = pdfInput.files?.[0];
  const count = parseInt(countInput.value, 10) || 5;

  if (!file) {
    alert("Upload a PDF of your notes first.");
    pdfInput.focus();
    return;
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    alert("Please upload a PDF file.");
    return;
  }

  generateBtn.disabled = true;
  statusEl.textContent = `Reading ${file.name} and generating flashcards...`;

  const formData = new FormData();
  formData.append("notes", file);
  formData.append("count", String(count));

  try {
    const response = await fetch("/api/flashcards/generate", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not generate flashcards.");
    }

    const generated = (data.cards || []).map((card, index) => ({
      id: `ai-${Date.now()}-${index}`,
      question: card.question,
      answer: card.answer,
    }));

    flashcards = [...flashcards, ...generated];
    saveFlashcards();
    renderFlashcards();

    if (data.source === "gemini" || data.source === "openai") {
      statusEl.textContent = `Added ${generated.length} AI-generated cards from ${file.name}. Hit Start Quiz when you're ready.`;
    } else {
      statusEl.textContent = `Added ${generated.length} cards from ${file.name}. Hit Start Quiz when you're ready.`;
    }
  } catch (error) {
    statusEl.textContent = error.message || "Something went wrong.";
  } finally {
    generateBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadFlashcards();
  renderFlashcards();

  document.getElementById("add-flashcard-btn")?.addEventListener("click", addFlashcard);
  document.getElementById("generate-flashcards-btn")?.addEventListener("click", generateFlashcards);
  document.getElementById("clear-flashcards-btn")?.addEventListener("click", clearFlashcards);
  document.getElementById("start-quiz-btn")?.addEventListener("click", startQuiz);
  document.getElementById("end-quiz-btn")?.addEventListener("click", endQuiz);
  document.getElementById("finish-quiz-btn")?.addEventListener("click", endQuiz);
  document.getElementById("restart-quiz-btn")?.addEventListener("click", startQuiz);
  initStudyCardSwipe();

  document.addEventListener("keydown", (event) => {
    if (!quizActive) return;
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      toggleStudyCard();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (studyIndex < quizCards.length - 1) {
        goToStudyCard(1, "right");
      } else {
        showQuizComplete();
      }
    } else if (event.key === "ArrowLeft" && studyIndex > 0) {
      event.preventDefault();
      goToStudyCard(-1, "left");
    }
  });
});
