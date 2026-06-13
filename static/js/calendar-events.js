const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STORAGE_KEY = "studious-calendar-events";

function getMonthKey(year, month) {
  return `${year}-${month}`;
}

function normalizeEvent(event) {
  if (typeof event === "string") {
    return { title: event, startTime: "", endTime: "" };
  }
  return {
    title: event.title || "",
    startTime: event.startTime || "",
    endTime: event.endTime || "",
  };
}

function formatTimeDisplay(time) {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatEventTime(event) {
  const { startTime, endTime } = normalizeEvent(event);
  if (!startTime && !endTime) return "All day";
  if (startTime && endTime) {
    return `${formatTimeDisplay(startTime)} – ${formatTimeDisplay(endTime)}`;
  }
  if (startTime) return formatTimeDisplay(startTime);
  if (endTime) return `Until ${formatTimeDisplay(endTime)}`;
  return "All day";
}

function formatEventLabel(event) {
  const normalized = normalizeEvent(event);
  return `${formatEventTime(normalized)} · ${normalized.title}`;
}

function eventSortKey(event) {
  const { startTime } = normalizeEvent(event);
  return startTime || "00:00";
}

function formatDateLabel(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const aStart = eventSortKey(a);
    const bStart = eventSortKey(b);
    return aStart.localeCompare(bStart);
  });
}

function migrateAllEvents(allEvents) {
  let changed = false;

  Object.keys(allEvents).forEach((monthKey) => {
    Object.keys(allEvents[monthKey]).forEach((day) => {
      const migrated = allEvents[monthKey][day].map((event) => {
        if (typeof event === "string") changed = true;
        return normalizeEvent(event);
      });
      allEvents[monthKey][day] = migrated;
    });
  });

  if (changed) {
    saveAllEvents(allEvents);
  }
}

function applyServerSampleEvents(allEvents, initData) {
  const monthKey = getMonthKey(initData.year, initData.month);
  if (!allEvents[monthKey]) {
    allEvents[monthKey] = {};
  }

  Object.entries(initData.events).forEach(([day, events]) => {
    if (!allEvents[monthKey][day]?.length) {
      allEvents[monthKey][day] = events.map(normalizeEvent);
    }
  });

  saveAllEvents(allEvents);
}

function loadAllEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAllEvents(allEvents) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allEvents));
}

function getEndOfWeekSunday(fromDate = new Date()) {
  const end = new Date(fromDate);
  end.setHours(0, 0, 0, 0);
  const day = end.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  end.setDate(end.getDate() + daysUntilSunday);
  return end;
}

function getUpcomingEvents(allEvents, options = {}) {
  const { weekOnly = false } = options;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = weekOnly ? getEndOfWeekSunday(today) : null;
  const upcoming = [];

  Object.entries(allEvents).forEach(([monthKey, days]) => {
    const [year, month] = monthKey.split("-").map(Number);
    Object.entries(days).forEach(([day, events]) => {
      const eventDate = new Date(year, month - 1, Number(day));
      eventDate.setHours(0, 0, 0, 0);
      if (eventDate < today) return;
      if (weekEnd && eventDate > weekEnd) return;

      sortEvents(events).forEach((event) => {
        upcoming.push({
          date: eventDate,
          dateKey: eventDate.toISOString().slice(0, 10),
          dateLabel: formatDateLabel(eventDate),
          event: normalizeEvent(event),
        });
      });
    });
  });

  return upcoming.sort((a, b) => {
    const dateDiff = a.date - b.date;
    if (dateDiff !== 0) return dateDiff;
    return eventSortKey(a.event).localeCompare(eventSortKey(b.event));
  });
}

function groupUpcomingByDate(upcomingEvents) {
  const grouped = [];

  upcomingEvents.forEach((entry) => {
    const lastGroup = grouped[grouped.length - 1];
    if (lastGroup && lastGroup.dateKey === entry.dateKey) {
      lastGroup.events.push(entry.event);
      return;
    }

    grouped.push({
      dateKey: entry.dateKey,
      dateLabel: entry.dateLabel,
      events: [entry.event],
    });
  });

  return grouped;
}

function parseTime24(value) {
  if (!value) {
    return { hour12: 9, minute: 0, period: "AM" };
  }
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return { hour12, minute: minutes, period };
}

function buildTime24(hour12, minute, period) {
  let hours = Number(hour12) % 12;
  if (period === "PM") hours += 12;
  return `${String(hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

let timePickerModal = null;
let activeTimeCallback = null;

function ensureTimePickerModal() {
  if (timePickerModal) return timePickerModal;

  const modal = document.createElement("div");
  modal.id = "time-picker-modal";
  modal.className = "time-picker-modal hidden";
  modal.innerHTML = `
    <div class="time-picker-dialog card">
      <div class="time-picker-dialog-header">
        <h3 id="time-picker-title">Pick a time</h3>
        <button type="button" class="btn secondary btn-small time-picker-close" aria-label="Close">✕</button>
      </div>
      <div class="time-select-row">
        <label class="time-select-field">
          Hour
          <select id="time-picker-hour"></select>
        </label>
        <label class="time-select-field">
          Minute
          <select id="time-picker-minute"></select>
        </label>
        <label class="time-select-field">
          AM/PM
          <select id="time-picker-period">
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
      </div>
      <div class="time-picker-actions">
        <button type="button" class="btn secondary" id="time-picker-cancel">Cancel</button>
        <button type="button" class="btn primary" id="time-picker-save">Save Time</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const hourSelect = modal.querySelector("#time-picker-hour");
  const minuteSelect = modal.querySelector("#time-picker-minute");

  for (let hour = 1; hour <= 12; hour++) {
    const option = document.createElement("option");
    option.value = String(hour);
    option.textContent = String(hour);
    hourSelect.appendChild(option);
  }

  for (let minute = 0; minute < 60; minute++) {
    const option = document.createElement("option");
    option.value = String(minute);
    option.textContent = String(minute).padStart(2, "0");
    minuteSelect.appendChild(option);
  }

  function closeModal() {
    modal.classList.add("hidden");
    activeTimeCallback = null;
  }

  modal.querySelector(".time-picker-close").addEventListener("click", closeModal);
  modal.querySelector("#time-picker-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  modal.querySelector("#time-picker-save").addEventListener("click", () => {
    const value = buildTime24(
      hourSelect.value,
      minuteSelect.value,
      modal.querySelector("#time-picker-period").value
    );
    activeTimeCallback?.(value);
    closeModal();
  });

  timePickerModal = modal;
  return modal;
}

function openTimePickerModal(label, value, onSave) {
  const modal = ensureTimePickerModal();
  const parsed = parseTime24(value);

  modal.querySelector("#time-picker-title").textContent = `Pick ${label} time`;
  modal.querySelector("#time-picker-hour").value = String(parsed.hour12);
  modal.querySelector("#time-picker-minute").value = String(parsed.minute);
  modal.querySelector("#time-picker-period").value = parsed.period;

  activeTimeCallback = onSave;
  modal.classList.remove("hidden");
}

function attachTimePicker(box, onChange) {
  const button = box.querySelector(".time-picker-btn");
  const clearBtn = box.querySelector(".time-clear-btn");
  const heading = box.querySelector(".time-picker-heading")?.textContent || "Time";
  let currentValue = "";

  function updateDisplay() {
    button.textContent = currentValue ? formatTimeDisplay(currentValue) : "All day";
  }

  button.addEventListener("click", (event) => {
    event.preventDefault();
    openTimePickerModal(heading, currentValue, (value) => {
      currentValue = value;
      updateDisplay();
      onChange?.(currentValue);
    });
  });

  clearBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    currentValue = "";
    updateDisplay();
    onChange?.("");
  });

  updateDisplay();

  return {
    updateDisplay,
    getValue: () => currentValue,
    setValue: (value) => {
      currentValue = value || "";
      updateDisplay();
    },
  };
}

function createTimePickerBox(heading, value, onChange) {
  const box = document.createElement("div");
  box.className = "time-picker-box";

  const headingEl = document.createElement("span");
  headingEl.className = "time-picker-heading";
  headingEl.textContent = heading;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "time-picker-btn";
  button.textContent = "All day";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "time-clear-btn";
  clearBtn.textContent = "Clear";
  clearBtn.setAttribute("aria-label", `Clear ${heading.toLowerCase()} time`);

  box.appendChild(headingEl);
  box.appendChild(button);
  box.appendChild(clearBtn);

  const picker = attachTimePicker(box, (newValue) => {
    onChange?.(newValue);
  });
  picker.setValue(value || "");

  return { box, picker };
}
