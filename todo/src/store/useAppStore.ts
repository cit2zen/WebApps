import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BackupData, Event, Project, SimpleTask, TabId, Tag } from '../types';

const STORAGE_KEY = 'todo-app-storage';

let storageWarned = false;
const safeStorage = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      if (!storageWarned) {
        storageWarned = true;
        alert(
          '저장에 실패했습니다. 브라우저 저장 공간을 확인하고, 지금 [내보내기]로 백업해 두세요.',
        );
      }
    }
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

export interface ProjectInput {
  title: string;
  memo?: string;
  tags: Tag[];
  deadline?: string;
}

export interface EventInput {
  title: string;
  date: string;
  time?: string;
  memo?: string;
}

interface AppState {
  projects: Project[];
  tasks: SimpleTask[];
  events: Event[];
  activeTab: TabId;
  selectedTag: Tag | null;
  introDismissed: boolean;
  setActiveTab: (tab: TabId) => void;
  toggleTag: (tag: Tag) => void;
  dismissIntro: () => void;
  clearDoneTasks: () => void;
  addProject: (input: ProjectInput) => void;
  updateProject: (id: string, patch: Partial<ProjectInput>) => void;
  deleteProject: (id: string) => void;
  addSubtask: (projectId: string, title: string) => void;
  toggleSubtask: (projectId: string, subtaskId: string) => void;
  renameSubtask: (projectId: string, subtaskId: string, title: string) => void;
  deleteSubtask: (projectId: string, subtaskId: string) => void;
  addTask: (title: string) => void;
  updateTask: (
    id: string,
    patch: Partial<Pick<SimpleTask, 'title' | 'memo' | 'tags' | 'deadline'>>,
  ) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  addEvent: (input: EventInput) => void;
  updateEvent: (id: string, patch: Partial<EventInput>) => void;
  deleteEvent: (id: string) => void;
  importData: (data: BackupData) => void;
}

function patchProject(
  projects: Project[],
  id: string,
  fn: (p: Project) => Project,
): Project[] {
  return projects.map((p) => (p.id === id ? fn(p) : p));
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      projects: [],
      tasks: [],
      events: [],
      activeTab: 'projects',
      selectedTag: null,
      introDismissed: false,

      setActiveTab: (tab) => set({ activeTab: tab }),
      toggleTag: (tag) =>
        set((s) => ({ selectedTag: s.selectedTag === tag ? null : tag })),
      dismissIntro: () => set({ introDismissed: true }),
      clearDoneTasks: () => set((s) => ({ tasks: s.tasks.filter((t) => !t.done) })),

      addProject: (input) =>
        set((s) => ({
          projects: [
            ...s.projects,
            {
              ...input,
              id: crypto.randomUUID(),
              subtasks: [],
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      updateProject: (id, patch) =>
        set((s) => ({ projects: patchProject(s.projects, id, (p) => ({ ...p, ...patch })) })),
      deleteProject: (id) =>
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

      addSubtask: (projectId, title) =>
        set((s) => ({
          projects: patchProject(s.projects, projectId, (p) => ({
            ...p,
            subtasks: [...p.subtasks, { id: crypto.randomUUID(), title, done: false }],
          })),
        })),
      toggleSubtask: (projectId, subtaskId) =>
        set((s) => ({
          projects: patchProject(s.projects, projectId, (p) => ({
            ...p,
            subtasks: p.subtasks.map((st) =>
              st.id === subtaskId ? { ...st, done: !st.done } : st,
            ),
          })),
        })),
      renameSubtask: (projectId, subtaskId, title) =>
        set((s) => ({
          projects: patchProject(s.projects, projectId, (p) => ({
            ...p,
            subtasks: p.subtasks.map((st) =>
              st.id === subtaskId ? { ...st, title } : st,
            ),
          })),
        })),
      deleteSubtask: (projectId, subtaskId) =>
        set((s) => ({
          projects: patchProject(s.projects, projectId, (p) => ({
            ...p,
            subtasks: p.subtasks.filter((st) => st.id !== subtaskId),
          })),
        })),

      addTask: (title) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: crypto.randomUUID(),
              title,
              done: false,
              tags: [],
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addEvent: (input) =>
        set((s) => ({
          events: [...s.events, { ...input, id: crypto.randomUUID() }],
        })),
      updateEvent: (id, patch) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      importData: (data) =>
        set({ projects: data.projects, tasks: data.tasks, events: data.events }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ projects, tasks, events, introDismissed }) => ({
        projects,
        tasks,
        events,
        introDismissed,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) localStorage.setItem(`${STORAGE_KEY}:corrupt-backup`, raw);
        }
      },
    },
  ),
);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) void useAppStore.persist.rehydrate();
  });
}
