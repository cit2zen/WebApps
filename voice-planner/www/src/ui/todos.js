import { $, clear, show, hide, setStatus } from "./dom.js";
import { completeTodo, reopenTodo, deleteTodo, renameTodo, moveTodo, addTodo } from "../tasks.js";
let onChanged = () => {};
let doneOpen = false;
let lastOpen = [];
let lastDone = [];
function errorEl() {
  let el = document.getElementById("todosErrorMsg");
  if (!el) {
    el = document.createElement("p");
    el.id = "todosErrorMsg";
    el.className = "empty-note";
    el.hidden = true;
    $("todosEmpty").insertAdjacentElement("afterend", el);
  }
  return el;
}
function showError(err) {
  const msg = err && err.message === "NOT_SIGNED_IN" ? "로그인이 필요해요." : "오류가 발생했어요. 다시 시도해주세요.";
  const el = errorEl();
  setStatus(el, msg);
  el.hidden = false;
}
function mkBtn(cls, label, text) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  if (text) b.textContent = text;
  b.setAttribute("aria-label", label);
  return b;
}
function guard(el, fn) {
  return async (...args) => {
    if (el.disabled) return;
    el.disabled = true;
    try {
      await fn(...args);
      errorEl().hidden = true;
    } catch (err) {
      showError(err);
    } finally {
      el.disabled = false;
    }
  };
}
export function initTodos(changedCb) {
  onChanged = changedCb;
  const form = $("quickAddForm");
  const submitBtn = form.querySelector('button[type="submit"]');
  form.addEventListener("submit", guard(submitBtn, async (ev) => {
    ev.preventDefault();
    const input = $("quickAddInput");
    const title = input.value.trim();
    if (!title) return;
    input.value = "";
    input.disabled = true;
    try {
      await addTodo(title);
    } catch (err) {
      input.value = title;
      throw err;
    } finally {
      input.disabled = false;
    }
    onChanged();
  }));
  $("btnToggleDone").addEventListener("click", () => {
    doneOpen = !doneOpen;
    applyDoneOpenState();
  });
}
function applyDoneOpenState() {
  const list = $("doneList");
  const toggle = $("btnToggleDone");
  if (doneOpen) {
    show(list);
    toggle.classList.add("donetoggle--open");
  } else {
    hide(list);
    toggle.classList.remove("donetoggle--open");
  }
}
export function renderTodos(open, done) {
  lastOpen = open;
  lastDone = done;
  const openList = $("todosList");
  const doneList = $("doneList");
  const emptyNote = $("todosEmpty");
  const toggle = $("btnToggleDone");
  clear(openList);
  clear(doneList);
  emptyNote.hidden = open.length > 0;
  open.forEach((todo, idx) => openList.appendChild(renderOpenRow(todo, idx, open.length)));
  done.forEach((todo) => doneList.appendChild(renderDoneRow(todo)));
  if (done.length > 0) {
    show(toggle);
    $("doneToggleLabel").textContent = `완료됨 (${done.length})`;
  } else {
    hide(toggle);
    doneOpen = false;
  }
  applyDoneOpenState();
}
function renderOpenRow(todo, idx, total) {
  const li = document.createElement("li");
  li.className = "todo-row";
  const num = document.createElement("span");
  num.className = "todo-row__num numeral";
  num.textContent = String(todo.number ?? idx + 1);
  li.appendChild(num);
  const check = mkBtn("todo-row__check", "완료 표시");
  check.addEventListener("click", guard(check, async () => {
    await completeTodo(todo.id);
    onChanged();
  }));
  li.appendChild(check);
  const body = document.createElement("div");
  body.className = "todo-row__body";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "todo-row__title";
  titleInput.value = todo.title;
  titleInput.disabled = true;
  titleInput.addEventListener("blur", guard(titleInput, async () => {
    titleInput.disabled = true;
    const val = titleInput.value.trim();
    if (val && val !== todo.title) {
      await renameTodo(todo.id, val);
      onChanged();
    } else {
      titleInput.value = todo.title;
    }
  }));
  titleInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") titleInput.blur();
  });
  let pressTimer;
  titleInput.addEventListener("pointerdown", () => {
    pressTimer = setTimeout(() => {
      titleInput.disabled = false;
      titleInput.focus();
    }, 500);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((evt) =>
    titleInput.addEventListener(evt, () => clearTimeout(pressTimer))
  );
  body.appendChild(titleInput);
  li.appendChild(body);
  const controls = document.createElement("div");
  controls.className = "todo-row__controls";
  const up = mkBtn("todo-row__ctrlbtn", "위로 이동", "▲");
  up.disabled = idx === 0;
  up.addEventListener("click", guard(up, async () => {
    await moveTodo(todo.id, idx);
    onChanged();
  }));
  controls.appendChild(up);
  const down = mkBtn("todo-row__ctrlbtn", "아래로 이동", "▼");
  down.disabled = idx === total - 1;
  down.addEventListener("click", guard(down, async () => {
    await moveTodo(todo.id, idx + 2);
    onChanged();
  }));
  controls.appendChild(down);
  li.appendChild(controls);
  const editBtn = mkBtn("todo-row__editbtn", "삭제", "삭제");
  editBtn.addEventListener("click", guard(editBtn, async () => {
    if (confirm(`"${todo.title}" 삭제할까요?`)) {
      await deleteTodo(todo.id);
      onChanged();
    }
  }));
  li.appendChild(editBtn);
  return li;
}
function renderDoneRow(todo) {
  const li = document.createElement("li");
  li.className = "todo-row todo-row--done";
  const num = document.createElement("span");
  num.className = "todo-row__num numeral";
  num.textContent = "•";
  li.appendChild(num);
  const check = mkBtn("todo-row__check", "다시 열기");
  check.addEventListener("click", guard(check, async () => {
    await reopenTodo(todo.id);
    onChanged();
  }));
  li.appendChild(check);
  const body = document.createElement("div");
  body.className = "todo-row__body";
  const span = document.createElement("input");
  span.type = "text";
  span.className = "todo-row__title";
  span.value = todo.title;
  span.disabled = true;
  body.appendChild(span);
  li.appendChild(body);
  return li;
}
