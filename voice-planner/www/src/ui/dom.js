export const $ = (id) => document.getElementById(id);

export function show(el) { el.hidden = false; }
export function hide(el) { el.hidden = true; }

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatHeaderDate(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}월 ${d}일 ${WEEKDAYS[date.getDay()]}요일`;
}

export function formatTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(m).padStart(2, "0")}`;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function minutesUntil(date, from = new Date()) {
  return Math.round((date.getTime() - from.getTime()) / 60000);
}

export function hash31(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}

export function setStatus(el, text) {
  el.textContent = text || "";
}
