function initUpcomingEvents() {
  const list = document.getElementById("upcoming-events-list");
  const emptyMsg = document.getElementById("no-upcoming-events");
  const dataEl = document.getElementById("calendar-init-data");
  if (!list || !emptyMsg || !dataEl) return;

  const initData = JSON.parse(dataEl.textContent);
  const allEvents = loadAllEvents();
  migrateAllEvents(allEvents);
  applyServerSampleEvents(allEvents, initData);

  const grouped = groupUpcomingByDate(getUpcomingEvents(allEvents, { weekOnly: true }));
  list.innerHTML = "";

  if (grouped.length === 0) {
    emptyMsg.classList.remove("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");

  grouped.forEach((group) => {
    const groupEl = document.createElement("li");
    groupEl.className = "upcoming-date-group";

    const dateEl = document.createElement("div");
    dateEl.className = "upcoming-date";
    dateEl.textContent = group.dateLabel;
    groupEl.appendChild(dateEl);

    const eventsEl = document.createElement("ul");
    eventsEl.className = "upcoming-event-items";

    group.events.forEach((event) => {
      const item = document.createElement("li");
      item.className = "upcoming-event-item";

      const title = document.createElement("span");
      title.className = "upcoming-event-title";
      title.textContent = event.title;
      item.appendChild(title);

      const time = formatEventTime(event);
      const timeEl = document.createElement("span");
      timeEl.className = "upcoming-event-time";
      timeEl.textContent = time;
      item.appendChild(timeEl);

      eventsEl.appendChild(item);
    });

    groupEl.appendChild(eventsEl);
    list.appendChild(groupEl);
  });
}

document.addEventListener("DOMContentLoaded", initUpcomingEvents);
