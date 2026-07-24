import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup } from '../utils/backup';
import { useAppStore } from './useAppStore';

const initial = useAppStore.getInitialState();

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({
    ...initial,
    projects: [],
    tasks: [],
    events: [],
    activeTab: 'projects',
    selectedTag: null,
  });
});

describe('프로젝트 액션', () => {
  it('addProject 기본값(빈 subtasks, createdAt 생성)', () => {
    useAppStore.getState().addProject({ title: '새 프로젝트', tags: ['공부'] });
    const [p] = useAppStore.getState().projects;
    expect(p.title).toBe('새 프로젝트');
    expect(p.subtasks).toEqual([]);
    expect(p.id).toBeTruthy();
    expect(p.createdAt).toBeTruthy();
  });

  it('addSubtask + toggleSubtask는 불변 갱신', () => {
    useAppStore.getState().addProject({ title: 'p', tags: [] });
    const pid = useAppStore.getState().projects[0].id;
    useAppStore.getState().addSubtask(pid, '세부1');
    const before = useAppStore.getState().projects[0];
    const sid = before.subtasks[0].id;
    useAppStore.getState().toggleSubtask(pid, sid);
    const after = useAppStore.getState().projects[0];
    expect(after.subtasks[0].done).toBe(true);
    expect(before.subtasks[0].done).toBe(false);
  });

  it('updateProject / deleteProject / renameSubtask / deleteSubtask', () => {
    useAppStore.getState().addProject({ title: 'p', tags: [] });
    const pid = useAppStore.getState().projects[0].id;
    useAppStore.getState().updateProject(pid, { title: '수정됨', deadline: '2026-08-01' });
    expect(useAppStore.getState().projects[0].title).toBe('수정됨');
    useAppStore.getState().addSubtask(pid, '세부');
    const sid = useAppStore.getState().projects[0].subtasks[0].id;
    useAppStore.getState().renameSubtask(pid, sid, '이름변경');
    expect(useAppStore.getState().projects[0].subtasks[0].title).toBe('이름변경');
    useAppStore.getState().deleteSubtask(pid, sid);
    expect(useAppStore.getState().projects[0].subtasks).toHaveLength(0);
    useAppStore.getState().deleteProject(pid);
    expect(useAppStore.getState().projects).toHaveLength(0);
  });
});

describe('할 일·일정 액션', () => {
  it('addTask/toggleTask/updateTask/deleteTask', () => {
    useAppStore.getState().addTask('빨래');
    const id = useAppStore.getState().tasks[0].id;
    useAppStore.getState().toggleTask(id);
    expect(useAppStore.getState().tasks[0].done).toBe(true);
    useAppStore.getState().updateTask(id, { memo: '메모', tags: ['집안일'] });
    expect(useAppStore.getState().tasks[0].memo).toBe('메모');
    useAppStore.getState().deleteTask(id);
    expect(useAppStore.getState().tasks).toHaveLength(0);
  });

  it('addEvent/updateEvent/deleteEvent', () => {
    useAppStore.getState().addEvent({ title: '회의', date: '2026-07-25', time: '10:00' });
    const id = useAppStore.getState().events[0].id;
    useAppStore.getState().updateEvent(id, { time: '11:00' });
    expect(useAppStore.getState().events[0].time).toBe('11:00');
    useAppStore.getState().deleteEvent(id);
    expect(useAppStore.getState().events).toHaveLength(0);
  });
});

describe('UI 상태', () => {
  it('toggleTag 재클릭 시 해제', () => {
    useAppStore.getState().toggleTag('공부');
    expect(useAppStore.getState().selectedTag).toBe('공부');
    useAppStore.getState().toggleTag('공부');
    expect(useAppStore.getState().selectedTag).toBeNull();
  });
  it('setActiveTab', () => {
    useAppStore.getState().setActiveTab('events');
    expect(useAppStore.getState().activeTab).toBe('events');
  });
});

describe('importData', () => {
  it('전체 데이터를 교체', () => {
    useAppStore.getState().addTask('기존');
    const backup = buildBackup(
      [],
      [
        {
          id: 'new',
          title: '가져온 할일',
          done: false,
          tags: [],
          createdAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      [],
    );
    useAppStore.getState().importData(backup);
    expect(useAppStore.getState().tasks.map((t) => t.title)).toEqual(['가져온 할일']);
    expect(useAppStore.getState().projects).toEqual([]);
  });
});

describe('완료됨 정리·인트로', () => {
  it('clearDoneTasks는 완료 항목만 제거', () => {
    useAppStore.getState().addTask('남을 것');
    useAppStore.getState().addTask('지울 것');
    const doneId = useAppStore.getState().tasks[1].id;
    useAppStore.getState().toggleTask(doneId);
    useAppStore.getState().clearDoneTasks();
    expect(useAppStore.getState().tasks.map((t) => t.title)).toEqual(['남을 것']);
  });

  it('dismissIntro 플래그 설정', () => {
    expect(useAppStore.getState().introDismissed).toBe(false);
    useAppStore.getState().dismissIntro();
    expect(useAppStore.getState().introDismissed).toBe(true);
  });
});

describe('persist', () => {
  it('도메인 데이터+introDismissed만 저장(activeTab·selectedTag 제외)', async () => {
    useAppStore.getState().addTask('저장 확인');
    useAppStore.getState().setActiveTab('events');
    await useAppStore.persist.rehydrate();
    const raw = localStorage.getItem('todo-app-storage');
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw as string) as { state: Record<string, unknown> };
    expect(Object.keys(saved.state).sort()).toEqual([
      'events',
      'introDismissed',
      'projects',
      'tasks',
    ]);
  });
});
