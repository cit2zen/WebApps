import { listTodos, addTodo, completeTodo, reopenTodo, deleteTodo, renameTodo, moveTodo } from './tasks.js';
import { listEvents, createEvent, updateEvent, deleteEvent } from './calendar.js';

const str = { type: 'string' };
const nullableStr = { type: ['string', 'null'] };
const nullableInt = { type: ['integer', 'null'] };
const nullableBool = { type: ['boolean', 'null'] };

function tool(name, description, properties, required) {
  return {
    name,
    description,
    strict: true,
    input_schema: { type: 'object', properties, required, additionalProperties: false },
  };
}

export const TOOLS = [
  tool('list_todos', '완료되지 않은 순번 할 일과 최근 완료한 할 일 목록을 조회한다.', {}, []),
  tool('add_todo', '새 할 일을 추가한다. position을 주면 그 순번에 삽입, 없으면 맨 끝에 추가.', {
    title: str,
    position: nullableInt,
    notes: nullableStr,
    due: nullableStr,
  }, ['title', 'position', 'notes', 'due']),
  tool('complete_todo', '순번으로 할 일을 완료 처리한다.', { number: { type: 'integer' } }, ['number']),
  tool('reopen_todo', '완료된 할 일을 제목 또는 id로 찾아 다시 미완료로 되돌린다.', { title_or_id: str }, ['title_or_id']),
  tool('delete_todo', '순번으로 할 일을 삭제한다.', { number: { type: 'integer' } }, ['number']),
  tool('rename_todo', '순번으로 할 일을 찾아 제목을 바꾼다.', { number: { type: 'integer' }, title: str }, ['number', 'title']),
  tool('move_todo', '순번 from_number의 할 일을 to_number 위치로 옮긴다.', {
    from_number: { type: 'integer' },
    to_number: { type: 'integer' },
  }, ['from_number', 'to_number']),
  tool('list_events', '주어진 ISO 시작/끝 범위의 캘린더 일정을 조회한다.', { start_iso: str, end_iso: str }, ['start_iso', 'end_iso']),
  tool('create_event', '새 캘린더 일정을 만든다. end_iso 없으면 1시간짜리로 생성.', {
    title: str,
    start_iso: str,
    end_iso: nullableStr,
    all_day: { type: 'boolean' },
    location: nullableStr,
  }, ['title', 'start_iso', 'end_iso', 'all_day', 'location']),
  tool('update_event', 'event_id로 일정을 찾아 준 필드만 수정한다.', {
    event_id: str,
    title: nullableStr,
    start_iso: nullableStr,
    end_iso: nullableStr,
    all_day: nullableBool,
    location: nullableStr,
  }, ['event_id', 'title', 'start_iso', 'end_iso', 'all_day', 'location']),
  tool('delete_event', 'event_id로 일정을 삭제한다.', { event_id: str }, ['event_id']),
];

function fmtTodo(t) {
  return { number: t.number, title: t.title, notes: t.notes, due: t.due, done: t.done };
}

function fmtEvent(e) {
  return {
    id: e.id,
    title: e.title,
    start: e.start.toLocaleString('ko-KR'),
    end: e.end.toLocaleString('ko-KR'),
    allDay: e.allDay,
    location: e.location,
  };
}

function parseIso(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

async function findOpenByNumber(number) {
  const { open } = await listTodos();
  const found = open.find((t) => t.number === number);
  if (!found) throw new Error(`${number}번 할 일을 찾을 수 없습니다.`);
  return found;
}

export async function executeTool(name, input, changed) {
  switch (name) {
    case 'list_todos': {
      const { open, done } = await listTodos();
      return JSON.stringify({ open: open.map(fmtTodo), done: done.map(fmtTodo) });
    }
    case 'add_todo': {
      const t = await addTodo(input.title, {
        position: input.position ?? undefined,
        notes: input.notes ?? undefined,
        due: input.due
          ? (/^\d{4}-\d{2}-\d{2}$/.test(input.due) ? input.due + 'T00:00:00.000Z' : new Date(input.due).toISOString())
          : undefined,
      });
      changed.todos = true;
      return JSON.stringify(fmtTodo(t));
    }
    case 'complete_todo': {
      const t = await findOpenByNumber(input.number);
      await completeTodo(t.id);
      changed.todos = true;
      return JSON.stringify({ ok: true });
    }
    case 'reopen_todo': {
      const { done } = await listTodos();
      const found = done.find((t) => t.id === input.title_or_id || t.title === input.title_or_id);
      if (!found) throw new Error('완료 목록에서 해당 할 일을 찾을 수 없습니다.');
      await reopenTodo(found.id);
      changed.todos = true;
      return JSON.stringify({ ok: true });
    }
    case 'delete_todo': {
      const t = await findOpenByNumber(input.number);
      await deleteTodo(t.id);
      changed.todos = true;
      return JSON.stringify({ ok: true });
    }
    case 'rename_todo': {
      const t = await findOpenByNumber(input.number);
      await renameTodo(t.id, input.title);
      changed.todos = true;
      return JSON.stringify({ ok: true });
    }
    case 'move_todo': {
      const t = await findOpenByNumber(input.from_number);
      await moveTodo(t.id, input.to_number);
      changed.todos = true;
      return JSON.stringify({ ok: true });
    }
    case 'list_events': {
      const events = await listEvents(parseIso(input.start_iso), parseIso(input.end_iso));
      return JSON.stringify(events.map(fmtEvent));
    }
    case 'create_event': {
      const e = await createEvent({
        title: input.title,
        start: parseIso(input.start_iso),
        end: input.end_iso ? parseIso(input.end_iso) : undefined,
        allDay: input.all_day,
        location: input.location ?? undefined,
      });
      changed.events = true;
      return JSON.stringify(fmtEvent(e));
    }
    case 'update_event': {
      const patch = {};
      if (input.title != null) patch.title = input.title;
      if (input.start_iso != null) patch.start = parseIso(input.start_iso);
      if (input.end_iso != null) patch.end = parseIso(input.end_iso);
      if (input.all_day != null) patch.allDay = input.all_day;
      if (input.location != null) patch.location = input.location;
      const e = await updateEvent(input.event_id, patch);
      changed.events = true;
      return JSON.stringify(fmtEvent(e));
    }
    case 'delete_event': {
      await deleteEvent(input.event_id);
      changed.events = true;
      return JSON.stringify({ ok: true });
    }
    default:
      throw new Error(`알 수 없는 도구: ${name}`);
  }
}
