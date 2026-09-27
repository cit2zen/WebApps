import { $, clear, formatTime, isSameDay, minutesUntil } from "./dom.js";

let cachedEvents = [];

export function getCachedEvents() {
  return cachedEvents;
}

export function renderEvents(events, { signedIn }) {
  cachedEvents = events;
  const list = $("eventsList");
  const empty = $("eventsEmpty");
  const countdown = $("eventsCountdown");
  clear(list);

  if (!signedIn) {
    empty.hidden = false;
    empty.textContent = "로그인하면 오늘/내일 일정을 볼 수 있어요.";
    countdown.hidden = true;
    return;
  }

  const now = new Date();
  const todayEvents = events.filter((e) => isSameDay(e.start, now) && e.end > now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowEvents = events.filter((e) => isSameDay(e.start, tomorrow));

  if (todayEvents.length === 0 && tomorrowEvents.length === 0) {
    empty.hidden = false;
    empty.textContent = "다가오는 일정이 없어요.";
    countdown.hidden = true;
    return;
  }

  empty.hidden = true;

  if (todayEvents.length > 0) {
    todayEvents.forEach((e) => list.appendChild(renderRow(e, false)));
  }
  if (tomorrowEvents.length > 0) {
    const divider = document.createElement("li");
    divider.className = "day-divider";
    divider.textContent = "내일";
    list.appendChild(divider);
    tomorrowEvents.forEach((e) => list.appendChild(renderRow(e, true)));
  }

  const next = todayEvents[0];
  if (next) {
    const mins = minutesUntil(next.start, now);
    if (mins > 0) {
      countdown.hidden = false;
      countdown.textContent = `다음 일정까지 ${mins}분`;
    } else {
      countdown.hidden = false;
      countdown.textContent = "지금 진행 중인 일정이 있어요";
    }
  } else {
    countdown.hidden = true;
  }
}

function renderRow(event, isTomorrow) {
  const li = document.createElement("li");
  li.className = "event-row" + (isTomorrow ? " event-row--tomorrow" : "");

  const time = document.createElement("div");
  time.className = "event-row__time";
  time.textContent = event.allDay ? "종일" : formatTime(event.start);
  li.appendChild(time);

  const body = document.createElement("div");
  body.className = "event-row__body";

  const title = document.createElement("div");
  title.className = "event-row__title";
  title.textContent = event.title || "(제목 없음)";
  body.appendChild(title);

  if (event.location) {
    const loc = document.createElement("div");
    loc.className = "event-row__loc";
    loc.textContent = event.location;
    body.appendChild(loc);
  }

  li.appendChild(body);
  return li;
}
