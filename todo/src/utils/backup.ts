import type { BackupData, Event, Project, SimpleTask, Subtask } from '../types';

export function buildBackup(
  projects: Project[],
  tasks: SimpleTask[],
  events: Event[],
): BackupData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects,
    tasks,
    events,
  };
}

export function backupFilename(today: string): string {
  return `todo-backup-${today}.json`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isSubtask(value: unknown): value is Subtask {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === 'string' && typeof s.title === 'string' && typeof s.done === 'boolean'
  );
}

function isProject(value: unknown): value is Project {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.title === 'string' &&
    (p.memo === undefined || typeof p.memo === 'string') &&
    isStringArray(p.tags) &&
    (p.deadline === undefined || typeof p.deadline === 'string') &&
    Array.isArray(p.subtasks) &&
    p.subtasks.every(isSubtask) &&
    typeof p.createdAt === 'string'
  );
}

function isSimpleTask(value: unknown): value is SimpleTask {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    typeof t.done === 'boolean' &&
    (t.memo === undefined || typeof t.memo === 'string') &&
    isStringArray(t.tags) &&
    (t.deadline === undefined || typeof t.deadline === 'string') &&
    typeof t.createdAt === 'string'
  );
}

function isEvent(value: unknown): value is Event {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.title === 'string' &&
    typeof e.date === 'string' &&
    (e.time === undefined || typeof e.time === 'string') &&
    (e.memo === undefined || typeof e.memo === 'string')
  );
}

export function parseBackup(text: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('INVALID_BACKUP');
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('INVALID_BACKUP');
  const data = raw as Record<string, unknown>;
  if (data.version !== 1) throw new Error('INVALID_BACKUP');
  if (typeof data.exportedAt !== 'string') throw new Error('INVALID_BACKUP');
  if (!Array.isArray(data.projects) || !data.projects.every(isProject))
    throw new Error('INVALID_BACKUP');
  if (!Array.isArray(data.tasks) || !data.tasks.every(isSimpleTask))
    throw new Error('INVALID_BACKUP');
  if (!Array.isArray(data.events) || !data.events.every(isEvent))
    throw new Error('INVALID_BACKUP');
  return {
    version: 1,
    exportedAt: data.exportedAt,
    projects: data.projects,
    tasks: data.tasks,
    events: data.events,
  };
}

export function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
