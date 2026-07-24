export type Tag = string;

export type TabId = 'projects' | 'tasks' | 'events';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Project {
  id: string;
  title: string;
  memo?: string;
  tags: Tag[];
  deadline?: string; // YYYY-MM-DD
  subtasks: Subtask[];
  createdAt: string;
}

export interface SimpleTask {
  id: string;
  title: string;
  done: boolean;
  memo?: string;
  tags: Tag[];
  deadline?: string;
  createdAt: string;
}

export interface Event {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  memo?: string;
}

export interface BackupData {
  version: 1;
  exportedAt: string;
  projects: Project[];
  tasks: SimpleTask[];
  events: Event[];
}
