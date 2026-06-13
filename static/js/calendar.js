function getMonthDays(year, month) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = [];
  let week = new Array(7).fill(0);
  let dayIndex = mondayOffset;

  for (let day = 1; day <= daysInMonth; day++) {
    week[dayIndex] = day;
    dayIndex++;
    if (dayIndex === 7) {
      weeks.push(week);
      week = new Array(7).fill(0);
      dayIndex = 0;
    }
  }

  if (dayIndex !== 0) {
    weeks.push(week);
  }

  return weeks;
}

function getSortedDayEntries(dayEvents) {
  return dayEvents
    .map((event, originalIndex) => ({ event, originalIndex }))
    .sort((a, b) => eventSortKey(a.event).localeCompare(eventSortKey(b.event)));
}

function initCalendar() {
  const dataEl = document.getElementById("calendar-init-data");
  const grid = document.getElementById("calendar-grid");
  if (!dataEl || !grid) return;

  const initData = JSON.parse(dataEl.textContent);
  const allEvents = loadAllEvents();
  migrateAllEvents(allEvents);
  applyServerSampleEvents(allEvents, initData);

  let currentYear = initData.year;
  let currentMonth = initData.month;
  let selectedDay = null;

  const monthLabel = document.getElementById("month-label");
  const dayPanel = document.getElementById("day-panel");
  const selectedDateLabel = document.getElementById("selected-date-label");
  const selectedDayEvents = document.getElementById("selected-day-events");
  const noEventsMsg = document.getElementById("no-events-msg");
  const newEventInput = document.getElementById("new-event-input");
  const addFormStartPicker = attachTimePicker(
    document.getElementById("event-start-picker"),
    () => {}
  );
  const addFormEndPicker = attachTimePicker(
    document.getElementById("event-end-picker"),
    () => {}
  );

  function getCurrentMonthEvents() {
    const monthKey = getMonthKey(currentYear, currentMonth);
    if (!allEvents[monthKey]) {
      allEvents[monthKey] = {};
    }
    return allEvents[monthKey];
  }

  function getSelectedDayEvents() {
    const monthEvents = getCurrentMonthEvents();
    if (!selectedDay) return [];
    if (!monthEvents[String(selectedDay)]) {
      monthEvents[String(selectedDay)] = [];
    }
    return monthEvents[String(selectedDay)];
  }

  function saveCurrentMonthEvents(monthEvents) {
    allEvents[getMonthKey(currentYear, currentMonth)] = monthEvents;
    saveAllEvents(allEvents);
  }

  function updateEvent(originalIndex, updates) {
    const dayEvents = getSelectedDayEvents();
    const current = normalizeEvent(dayEvents[originalIndex]);
    if (!current.title && updates.title !== undefined) return false;

    const next = { ...current, ...updates };
    if (next.startTime && next.endTime && next.endTime <= next.startTime) {
      alert("End time must be after start time.");
      return false;
    }

    dayEvents[originalIndex] = next;
    saveCurrentMonthEvents(getCurrentMonthEvents());
    renderCalendar();
    return true;
  }

  function deleteEvent(originalIndex) {
    const monthEvents = getCurrentMonthEvents();
    const dayEvents = getSelectedDayEvents();
    dayEvents.splice(originalIndex, 1);

    if (dayEvents.length === 0) {
      delete monthEvents[String(selectedDay)];
    }

    saveCurrentMonthEvents(monthEvents);
    renderPanelEvents();
    renderCalendar();
  }

  function isToday(day) {
    return (
      day === initData.today &&
      currentMonth === initData.today_month &&
      currentYear === initData.today_year
    );
  }

  function clearEventForm() {
    newEventInput.value = "";
    addFormStartPicker.setValue("");
    addFormEndPicker.setValue("");
  }

  function renderCalendar() {
    monthLabel.textContent = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;
    const monthEvents = getCurrentMonthEvents();
    const weeks = getMonthDays(currentYear, currentMonth);

    grid.querySelectorAll(".calendar-day").forEach((cell) => cell.remove());

    weeks.forEach((week) => {
      week.forEach((day) => {
        const cell = document.createElement("div");
        cell.className = "calendar-day";

        if (day === 0) {
          cell.classList.add("empty");
        } else {
          const dayStr = String(day);
          if (isToday(day)) cell.classList.add("today");
          if (selectedDay === day) cell.classList.add("selected");

          const dayNumber = document.createElement("span");
          dayNumber.className = "day-number";
          dayNumber.textContent = day;
          cell.appendChild(dayNumber);

          const events = sortEvents(monthEvents[dayStr] || []);
          if (events.length) {
            const list = document.createElement("ul");
            list.className = "day-events";
            events.slice(0, 2).forEach((event) => {
              const item = document.createElement("li");
              item.textContent = formatEventLabel(event);
              list.appendChild(item);
            });
            if (events.length > 2) {
              const more = document.createElement("li");
              more.className = "more-events";
              more.textContent = `+${events.length - 2} more`;
              list.appendChild(more);
            }
            cell.appendChild(list);
          }

          cell.addEventListener("click", () => openDayPanel(day));
        }

        grid.appendChild(cell);
      });
    });
  }

  function renderPanelEvents() {
    selectedDayEvents.innerHTML = "";
    if (!selectedDay) return;

    const dayEvents = getSelectedDayEvents();
    const entries = getSortedDayEntries(dayEvents);

    noEventsMsg.classList.toggle("hidden", entries.length > 0);

    entries.forEach(({ event, originalIndex }) => {
      const normalized = normalizeEvent(event);
      const item = document.createElement("li");
      item.className = "panel-event-item";

      const topRow = document.createElement("div");
      topRow.className = "panel-event-top";

      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.className = "panel-event-title-input";
      titleInput.value = normalized.title;
      titleInput.placeholder = "Event name";
      titleInput.addEventListener("change", () => {
        const title = titleInput.value.trim();
        if (!title) {
          titleInput.value = normalized.title;
          return;
        }
        updateEvent(originalIndex, { title });
      });
      titleInput.addEventListener("keydown", (keydownEvent) => {
        if (keydownEvent.key === "Enter") {
          titleInput.blur();
        }
      });
      topRow.appendChild(titleInput);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-remove";
      removeBtn.setAttribute("aria-label", "Remove event");
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => {
        deleteEvent(originalIndex);
      });
      topRow.appendChild(removeBtn);
      item.appendChild(topRow);

      const timesRow = document.createElement("div");
      timesRow.className = "panel-event-times";

      const startPicker = createTimePickerBox("Start", normalized.startTime, (startTime) => {
        if (!updateEvent(originalIndex, { startTime })) {
          const saved = normalizeEvent(getSelectedDayEvents()[originalIndex]);
          startPicker.picker.setValue(saved.startTime);
        }
      });
      timesRow.appendChild(startPicker.box);

      const endPicker = createTimePickerBox("End", normalized.endTime, (endTime) => {
        if (!updateEvent(originalIndex, { endTime })) {
          const saved = normalizeEvent(getSelectedDayEvents()[originalIndex]);
          endPicker.picker.setValue(saved.endTime);
        }
      });
      timesRow.appendChild(endPicker.box);

      item.appendChild(timesRow);
      selectedDayEvents.appendChild(item);
    });
  }

  function openDayPanel(day) {
    selectedDay = day;
    selectedDateLabel.textContent = `${MONTH_NAMES[currentMonth - 1]} ${day}, ${currentYear}`;
    dayPanel.classList.remove("hidden");
    renderPanelEvents();
    renderCalendar();
    newEventInput.focus();
  }

  function closeDayPanel() {
    selectedDay = null;
    dayPanel.classList.add("hidden");
    clearEventForm();
    renderCalendar();
  }

  function addEvent() {
    if (!selectedDay) return;

    const title = newEventInput.value.trim();
    const startTime = addFormStartPicker.getValue();
    const endTime = addFormEndPicker.getValue();

    if (!title) return;
    if (startTime && endTime && endTime <= startTime) {
      alert("End time must be after start time.");
      return;
    }

    const dayEvents = getSelectedDayEvents();
    dayEvents.push({ title, startTime, endTime });
    saveCurrentMonthEvents(getCurrentMonthEvents());
    clearEventForm();
    renderPanelEvents();
    renderCalendar();
  }

  document.getElementById("prev-month").addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    closeDayPanel();
    renderCalendar();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    closeDayPanel();
    renderCalendar();
  });

  document.getElementById("today-btn").addEventListener("click", () => {
    currentYear = initData.today_year;
    currentMonth = initData.today_month;
    closeDayPanel();
    renderCalendar();
  });

  document.getElementById("close-panel-btn").addEventListener("click", closeDayPanel);
  document.getElementById("add-event-btn").addEventListener("click", addEvent);
  newEventInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addEvent();
  });

  renderCalendar();
}

document.addEventListener("DOMContentLoaded", initCalendar);
