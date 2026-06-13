const GRADES_STORAGE_KEY = "studious_grades_data";

let gradesData = {
  manualTests: [],
  assignments: [],
};

function loadGradesData() {
  try {
    const stored = JSON.parse(localStorage.getItem(GRADES_STORAGE_KEY));
    if (stored) {
      gradesData = {
        manualTests: stored.manualTests || [],
        assignments: stored.assignments || [],
      };
    }
  } catch {
    gradesData = { manualTests: [], assignments: [] };
  }
}

function saveGradesData() {
  localStorage.setItem(GRADES_STORAGE_KEY, JSON.stringify(gradesData));
}

function getCalendarAssessments() {
  const dataEl = document.getElementById("calendar-init-data");
  if (!dataEl) return [];

  const initData = JSON.parse(dataEl.textContent);
  return getCalendarAssessmentEvents(initData).map((entry) => ({
    id: `cal-${entry.dateKey}-${entry.event.title}`,
    title: entry.event.title,
    date: entry.dateKey,
    dateLabel: entry.dateLabel,
    time: formatEventTime(entry.event),
    source: "calendar",
  }));
}

function mergeAssessments(calendarAssessments, manualAssessments) {
  const merged = [...calendarAssessments];
  const seen = new Set(calendarAssessments.map((item) => `${item.date}|${item.title.toLowerCase()}`));

  manualAssessments.forEach((assessment) => {
    const key = `${assessment.date}|${assessment.title.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      id: assessment.id,
      title: assessment.title,
      date: assessment.date,
      dateLabel: formatManualDateLabel(assessment.date),
      time: assessment.course || "Added manually",
      source: "manual",
    });
  });

  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

function formatManualDateLabel(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return formatDateLabel(new Date(year, month - 1, day));
}

function renderUpcomingAssessments() {
  const list = document.getElementById("upcoming-assessments-list");
  const emptyMsg = document.getElementById("no-upcoming-assessments");
  if (!list || !emptyMsg) return;

  const assessments = mergeAssessments(getCalendarAssessments(), gradesData.manualTests);
  list.innerHTML = "";

  if (assessments.length === 0) {
    emptyMsg.classList.remove("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");

  assessments.forEach((assessment) => {
    const item = document.createElement("li");
    item.className = "grades-test-item";

    const main = document.createElement("div");
    main.className = "grades-test-main";

    const title = document.createElement("span");
    title.className = "grades-test-title";
    title.textContent = assessment.title;

    const meta = document.createElement("span");
    meta.className = "grades-test-meta";
    meta.textContent = `${assessment.dateLabel}${assessment.time ? ` · ${assessment.time}` : ""}`;

    main.appendChild(title);
    main.appendChild(meta);

    const badge = document.createElement("span");
    badge.className = `grades-test-badge ${assessment.source === "calendar" ? "badge-calendar" : "badge-manual"}`;
    badge.textContent = assessment.source === "calendar" ? "Calendar" : "Manual";

    item.appendChild(main);
    item.appendChild(badge);

    if (assessment.source === "manual") {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn secondary btn-small grades-remove-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeManualAssessment(assessment.id));
      item.appendChild(removeBtn);
    }

    list.appendChild(item);
  });
}

function addManualAssessment() {
  const titleInput = document.getElementById("assessment-title");
  const dateInput = document.getElementById("assessment-date");
  const courseInput = document.getElementById("assessment-course");

  const title = titleInput.value.trim();
  const date = dateInput.value;
  const course = courseInput.value.trim();

  if (!title || !date) {
    alert("Enter an assessment name and date.");
    return;
  }

  gradesData.manualTests.push({
    id: `manual-${Date.now()}`,
    title,
    date,
    course,
  });

  saveGradesData();
  titleInput.value = "";
  dateInput.value = "";
  courseInput.value = "";
  titleInput.focus();
  renderUpcomingAssessments();
}

function removeManualAssessment(id) {
  gradesData.manualTests = gradesData.manualTests.filter((assessment) => assessment.id !== id);
  saveGradesData();
  renderUpcomingAssessments();
}

function calculateAssignmentGrade() {
  const assignments = gradesData.assignments;
  if (assignments.length === 0) return null;

  const hasWeights = assignments.some((a) => a.weight > 0);
  if (hasWeights) {
    let weightedSum = 0;
    let totalWeight = 0;
    assignments.forEach((a) => {
      const pct = (a.earned / a.possible) * 100;
      weightedSum += pct * a.weight;
      totalWeight += a.weight;
    });
    return totalWeight > 0 ? weightedSum / totalWeight : null;
  }

  const earned = assignments.reduce((sum, a) => sum + a.earned, 0);
  const possible = assignments.reduce((sum, a) => sum + a.possible, 0);
  return possible > 0 ? (earned / possible) * 100 : null;
}

function renderAssignments() {
  const list = document.getElementById("assignment-list");
  const emptyMsg = document.getElementById("no-assignments");
  const resultEl = document.getElementById("assignment-grade-result");
  const currentGradeInput = document.getElementById("final-current-grade");
  if (!list || !emptyMsg || !resultEl) return;

  list.innerHTML = "";
  const grade = calculateAssignmentGrade();

  if (gradesData.assignments.length === 0) {
    emptyMsg.classList.remove("hidden");
    resultEl.textContent = "—";
    return;
  }

  emptyMsg.classList.add("hidden");

  gradesData.assignments.forEach((assignment) => {
    const pct = ((assignment.earned / assignment.possible) * 100).toFixed(1);
    const item = document.createElement("li");
    item.className = "assignment-item";

    const info = document.createElement("div");
    info.className = "assignment-info";
    info.innerHTML = `<strong>${assignment.name}</strong><span>${assignment.earned}/${assignment.possible} (${pct}%)${assignment.weight ? ` · ${assignment.weight}% weight` : ""}</span>`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn secondary btn-small";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeAssignment(assignment.id));

    item.appendChild(info);
    item.appendChild(removeBtn);
    list.appendChild(item);
  });

  if (grade !== null) {
    resultEl.textContent = `${grade.toFixed(1)}%`;
    if (currentGradeInput && !currentGradeInput.dataset.manualOverride) {
      currentGradeInput.value = grade.toFixed(1);
    }
  } else {
    resultEl.textContent = "—";
  }
}

function addAssignment() {
  const nameInput = document.getElementById("assign-name");
  const earnedInput = document.getElementById("assign-earned");
  const possibleInput = document.getElementById("assign-possible");
  const weightInput = document.getElementById("assign-weight");

  const name = nameInput.value.trim();
  const earned = parseFloat(earnedInput.value);
  const possible = parseFloat(possibleInput.value);
  const weight = parseFloat(weightInput.value) || 0;

  if (!name || isNaN(earned) || isNaN(possible) || possible <= 0) {
    alert("Enter an assignment name, points earned, and points possible.");
    return;
  }

  gradesData.assignments.push({
    id: `assign-${Date.now()}`,
    name,
    earned,
    possible,
    weight,
  });

  saveGradesData();
  nameInput.value = "";
  earnedInput.value = "";
  possibleInput.value = "";
  weightInput.value = "";
  nameInput.focus();
  renderAssignments();
}

function removeAssignment(id) {
  gradesData.assignments = gradesData.assignments.filter((a) => a.id !== id);
  saveGradesData();
  renderAssignments();
}

function calculateFinalGrade() {
  const currentInput = document.getElementById("final-current-grade");
  const weightInput = document.getElementById("final-exam-weight");
  const examScoreInput = document.getElementById("final-exam-score");
  const targetInput = document.getElementById("final-target-grade");
  const resultsBox = document.getElementById("final-grade-results");
  const projectedEl = document.getElementById("projected-final-grade");
  const neededEl = document.getElementById("needed-final-score");

  let currentGrade = parseFloat(currentInput.value);
  if (isNaN(currentGrade)) {
    currentGrade = calculateAssignmentGrade();
    if (currentGrade === null) {
      alert("Enter your current grade or add assignments first.");
      return;
    }
    currentInput.value = currentGrade.toFixed(1);
  }

  const finalWeight = parseFloat(weightInput.value);
  if (isNaN(finalWeight) || finalWeight <= 0 || finalWeight > 100) {
    alert("Enter a final exam weight between 1 and 100.");
    return;
  }

  const nonFinalWeight = (100 - finalWeight) / 100;
  const finalWeightDecimal = finalWeight / 100;
  const examScore = parseFloat(examScoreInput.value);
  const targetGrade = parseFloat(targetInput.value);

  resultsBox.classList.remove("hidden");

  if (!isNaN(examScore)) {
    const projected = currentGrade * nonFinalWeight + examScore * finalWeightDecimal;
    projectedEl.textContent = `${projected.toFixed(1)}%`;
  } else {
    projectedEl.textContent = `${currentGrade.toFixed(1)}% (no exam score yet)`;
  }

  if (!isNaN(targetGrade)) {
    const needed = (targetGrade - currentGrade * nonFinalWeight) / finalWeightDecimal;
    if (needed > 100) {
      neededEl.textContent = `You would need ${needed.toFixed(1)}% on the final to reach ${targetGrade}% — that exceeds a perfect score.`;
    } else if (needed < 0) {
      neededEl.textContent = `You already have at least ${targetGrade}% locked in before the final.`;
    } else {
      neededEl.textContent = `You need ${needed.toFixed(1)}% on the final to reach ${targetGrade}%.`;
    }
  } else {
    neededEl.textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadGradesData();
  renderUpcomingAssessments();
  renderAssignments();

  window.addEventListener("pageshow", () => {
    renderUpcomingAssessments();
  });

  window.addEventListener("studious-calendar-updated", () => {
    renderUpcomingAssessments();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === "studious-calendar-events") {
      renderUpcomingAssessments();
    }
  });

  const currentGradeInput = document.getElementById("final-current-grade");
  if (currentGradeInput) {
    currentGradeInput.addEventListener("input", () => {
      currentGradeInput.dataset.manualOverride = currentGradeInput.value ? "1" : "";
    });
  }
});
