import { $, show, hide, formatHeaderDate, hash31 } from "./ui/dom.js";
import { initAuth, isSignedIn, currentUser } from "./auth.js";
import { scheduleReminders } from "./native.js";
import { getSettings } from "./settings.js";
import { listTodos } from "./tasks.js";
import { listEvents } from "./calendar.js";
import { renderEvents } from "./ui/events.js";
import { initTodos, renderTodos } from "./ui/todos.js";
import { initVoice } from "./ui/voice.js";
import { initSettingsSheet, openSheet } from "./ui/settings-sheet.js";

function updateHeader() {
  $("headerDate").textContent = formatHeaderDate(new Date());
  const user = currentUser();
  $("headerAccount").textContent = user ? user.email : "로그인 필요";
}

function updateOnboarding() {
  const signedIn = isSignedIn();
  const panels = $("dataPanels");
  if (signedIn) {
    hide($("onboarding"));
    show(panels);
  } else {
    hide(panels);
    show($("onboarding"));
  }
}

async function refreshAll() {
  updateHeader();
  updateOnboarding();

  const signedIn = isSignedIn();
  renderEvents([], { signedIn });

  if (!signedIn) {
    renderTodos([], []);
    return;
  }

  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const [events, todos] = await Promise.all([listEvents(now, weekOut), listTodos()]);
    renderEvents(events, { signedIn });
    renderTodos(todos.open, todos.done);
    await scheduleUpcomingReminders(events);
  } catch (err) {
    console.warn("데이터를 불러오지 못했어요", err);
  }
}

async function scheduleUpcomingReminders(events) {
  const settings = await getSettings();
  const minutes = settings.reminderMinutes ?? 10;
  const now = new Date();

  const items = events
    .map((e) => {
      const at = new Date(e.start.getTime() - minutes * 60000);
      return {
        id: hash31(String(e.id) + String(e.start.getTime())),
        title: "다가오는 일정",
        body: `${e.title || "일정"} (${minutes}분 전)`,
        at,
      };
    })
    .filter((item) => item.at > now);

  try {
    await scheduleReminders(items);
  } catch (err) {
    console.warn("알림 예약에 실패했어요", err);
  }
}

async function refreshTodosOnly() {
  if (!isSignedIn()) return;
  try {
    const todos = await listTodos();
    renderTodos(todos.open, todos.done);
  } catch (err) {
    console.warn("할 일을 불러오지 못했어요", err);
  }
}

async function boot() {
  initTodos(refreshTodosOnly);
  initSettingsSheet(refreshAll);
  initVoice({
    dataChanged: refreshAll,
    openSettings: (msg) => openSheet(msg),
    needSignIn: () => openSheet("Google 로그인이 필요해요."),
  });

  $("btnRefresh").addEventListener("click", refreshAll);

  try {
    await initAuth();
  } catch (err) {
    console.warn("로그인 초기화 실패", err);
  }

  await refreshAll();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshAll();
  });
}

boot();
