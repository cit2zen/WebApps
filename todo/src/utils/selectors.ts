import type { Event, Project, SimpleTask, Tag } from '../types';

export function projectProgress(project: Project): number {
  const total = project.subtasks.length;
  if (total === 0) return 0;
  const done = project.subtasks.filter((s) => s.done).length;
  return Math.round((done / total) * 100);
}

export function isProjectDone(project: Project): boolean {
  return project.subtasks.length > 0 && projectProgress(project) === 100;
}

export interface Summary {
  incompleteCount: number;
  dueTodayCount: number;
  avgProgress: number;
}

export function summarize(
  projects: Project[],
  tasks: SimpleTask[],
  today: string,
): Summary {
  const pendingTasks = tasks.filter((t) => !t.done);
  const pendingSubtasks = projects.flatMap((p) => p.subtasks).filter((s) => !s.done);
  const incompleteCount = pendingTasks.length + pendingSubtasks.length;

  const dueTodayCount =
    pendingTasks.filter((t) => t.deadline === today).length +
    projects.filter((p) => !isProjectDone(p) && p.deadline === today).length;

  const avgProgress =
    projects.length === 0
      ? 0
      : Math.round(
          projects.reduce((sum, p) => sum + projectProgress(p), 0) / projects.length,
        );

  return { incompleteCount, dueTodayCount, avgProgress };
}

export function filterByTag<T extends { tags: Tag[] }>(items: T[], tag: Tag | null): T[] {
  if (tag === null) return items;
  return items.filter((item) => item.tags.includes(tag));
}

export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const doneDiff = Number(isProjectDone(a)) - Number(isProjectDone(b));
    if (doneDiff !== 0) return doneDiff;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function splitTasks(tasks: SimpleTask[]): {
  pending: SimpleTask[];
  done: SimpleTask[];
} {
  const pending = tasks
    .filter((t) => !t.done)
    .sort((a, b) => {
      if (a.deadline && b.deadline && a.deadline !== b.deadline)
        return a.deadline.localeCompare(b.deadline);
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
  const done = tasks.filter((t) => t.done);
  return { pending, done };
}

export function collectTags(projects: Project[], tasks: SimpleTask[]): Tag[] {
  const all = new Set<Tag>();
  for (const p of projects) for (const tag of p.tags) all.add(tag);
  for (const t of tasks) for (const tag of t.tags) all.add(tag);
  return [...all].sort((a, b) => a.localeCompare(b, 'ko'));
}

export function eventsOn(events: Event[], date: string): Event[] {
  return events
    .filter((e) => e.date === date)
    .sort((a, b) => {
      if (!a.time && !b.time) return a.title.localeCompare(b.title, 'ko');
      if (!a.time) return -1;
      if (!b.time) return 1;
      return a.time.localeCompare(b.time);
    });
}

export function eventDateSet(events: Event[]): Set<string> {
  return new Set(events.map((e) => e.date));
}
