import { gfetch } from './google.js';

const BASE = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks';

function toTodo(raw, number) {
  return {
    id: raw.id,
    title: raw.title || '',
    notes: raw.notes || '',
    due: raw.due || null,
    done: raw.status === 'completed',
    position: raw.position,
    number,
  };
}

async function fetchAllRaw() {
  let items = [];
  let pageToken;
  do {
    const data = await gfetch(BASE, {
      query: {
        showCompleted: true,
        showHidden: true,
        maxResults: 100,
        pageToken,
      },
    });
    items = items.concat(data.items || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items.filter((t) => !t.parent);
}

export async function listTodos() {
  const items = await fetchAllRaw();
  const openRaw = items
    .filter((t) => t.status === 'needsAction')
    .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
  const doneRaw = items
    .filter((t) => t.status === 'completed')
    .sort((a, b) => new Date(b.completed || 0) - new Date(a.completed || 0))
    .slice(0, 20);
  const open = openRaw.map((t, i) => toTodo(t, i + 1));
  const done = doneRaw.map((t) => toTodo(t, null));
  return { open, done };
}

async function getOpenList() {
  const items = await fetchAllRaw();
  return items
    .filter((t) => t.status === 'needsAction')
    .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
}

export async function addTodo(title, { position, notes, due } = {}) {
  const open = await getOpenList();
  const query = {};
  if (position === undefined || position === null) {
    if (open.length > 0) query.previous = open[open.length - 1].id;
  } else if (position > 1) {
    const prev = open[position - 2];
    if (prev) query.previous = prev.id;
    else if (open.length > 0) query.previous = open[open.length - 1].id;
  }
  const body = { title };
  if (notes !== undefined) body.notes = notes;
  if (due !== undefined) body.due = due;
  const created = await gfetch(BASE, { method: 'POST', body, query });
  const n = position !== undefined && position !== null ? Math.max(1, Math.min(position, open.length + 1)) : open.length + 1;
  return toTodo(created, n);
}

export async function completeTodo(id) {
  await gfetch(`${BASE}/${id}`, {
    method: 'PATCH',
    body: { status: 'completed' },
  });
}

export async function reopenTodo(id) {
  await gfetch(`${BASE}/${id}`, {
    method: 'PATCH',
    body: { status: 'needsAction', completed: null },
  });
}

export async function deleteTodo(id) {
  await gfetch(`${BASE}/${id}`, { method: 'DELETE' });
}

export async function renameTodo(id, title) {
  await gfetch(`${BASE}/${id}`, { method: 'PATCH', body: { title } });
}

export async function moveTodo(id, toNumber) {
  const open = (await getOpenList()).filter((t) => t.id !== id);
  const query = {};
  if (toNumber > 1) {
    const prev = open[toNumber - 2];
    if (prev) query.previous = prev.id;
    else if (open.length > 0) query.previous = open[open.length - 1].id;
  }
  await gfetch(`${BASE}/${id}/move`, { method: 'POST', query });
}
