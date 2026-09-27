import { gfetch } from './google.js';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

function tz() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fromGoogleEvent(ev) {
  const allDay = !!ev.start?.date;
  const start = allDay ? parseLocalDate(ev.start.date) : new Date(ev.start.dateTime);
  const end = allDay ? parseLocalDate(ev.end.date) : new Date(ev.end.dateTime);
  return {
    id: ev.id,
    title: ev.summary || '',
    start,
    end,
    allDay,
    location: ev.location || '',
  };
}

function toGoogleTimeFields(start, end, allDay, forPatch = false) {
  if (allDay) {
    const endDate = end && dateStr(end) !== dateStr(start) ? end : addDays(start, 1);
    const clear = forPatch ? { dateTime: null, timeZone: null } : {};
    return {
      start: { date: dateStr(start), ...clear },
      end: { date: dateStr(endDate), ...clear },
    };
  }
  const timeZone = tz();
  const endDate = end || new Date(start.getTime() + 60 * 60 * 1000);
  const clear = forPatch ? { date: null } : {};
  return {
    start: { dateTime: start.toISOString(), timeZone, ...clear },
    end: { dateTime: endDate.toISOString(), timeZone, ...clear },
  };
}

export async function listEvents(timeMin, timeMax) {
  const data = await gfetch(BASE, {
    query: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    },
  });
  return (data.items || []).map(fromGoogleEvent);
}

export async function createEvent({ title, start, end, allDay = false, location, description }) {
  const body = {
    summary: title,
    ...toGoogleTimeFields(start, end, allDay),
  };
  if (location !== undefined) body.location = location;
  if (description !== undefined) body.description = description;
  const created = await gfetch(BASE, { method: 'POST', body });
  return fromGoogleEvent(created);
}

export async function updateEvent(id, patch) {
  const body = {};
  if (patch.title !== undefined) body.summary = patch.title;
  if (patch.location !== undefined) body.location = patch.location;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.start !== undefined || patch.end !== undefined || patch.allDay !== undefined) {
    const current = await gfetch(`${BASE}/${id}`);
    const currentAllDay = !!current.start?.date;
    const allDay = patch.allDay !== undefined ? patch.allDay : currentAllDay;
    const currentEvent = fromGoogleEvent(current);
    const start = patch.start || currentEvent.start;
    let end = patch.end;
    if (end === undefined) {
      const duration = currentEvent.end.getTime() - currentEvent.start.getTime();
      end = new Date(start.getTime() + duration);
    }
    Object.assign(body, toGoogleTimeFields(start, end, allDay, true));
  }
  const updated = await gfetch(`${BASE}/${id}`, { method: 'PATCH', body });
  return fromGoogleEvent(updated);
}

export async function deleteEvent(id) {
  await gfetch(`${BASE}/${id}`, { method: 'DELETE' });
}
