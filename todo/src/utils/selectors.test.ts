import { describe, expect, it } from 'vitest';
import type { Event, Project, SimpleTask, Subtask } from '../types';
import {
  collectTags,
  eventDateSet,
  eventsOn,
  filterByTag,
  isProjectDone,
  projectProgress,
  sortProjects,
  splitTasks,
  summarize,
} from './selectors';

const sub = (id: string, done: boolean): Subtask => ({ id, title: id, done });

const proj = (over: Partial<Project>): Project => ({
  id: 'p',
  title: '프로젝트',
  tags: [],
  subtasks: [],
  createdAt: '2026-07-01T00:00:00.000Z',
  ...over,
});

const task = (over: Partial<SimpleTask>): SimpleTask => ({
  id: 't',
  title: '할일',
  done: false,
  tags: [],
  createdAt: '2026-07-01T00:00:00.000Z',
  ...over,
});

const ev = (over: Partial<Event>): Event => ({
  id: 'e',
  title: '일정',
  date: '2026-07-24',
  ...over,
});

describe('projectProgress', () => {
  it('완료/전체 ×100 반올림', () => {
    const p = proj({ subtasks: [sub('a', true), sub('b', false), sub('c', false)] });
    expect(projectProgress(p)).toBe(33);
  });
  it('세부 할 일 0개면 0%', () => {
    expect(projectProgress(proj({}))).toBe(0);
  });
  it('전부 완료면 100', () => {
    expect(projectProgress(proj({ subtasks: [sub('a', true)] }))).toBe(100);
  });
});

describe('isProjectDone', () => {
  it('세부 1개 이상 + 100%만 완료', () => {
    expect(isProjectDone(proj({ subtasks: [sub('a', true)] }))).toBe(true);
    expect(isProjectDone(proj({}))).toBe(false);
    expect(isProjectDone(proj({ subtasks: [sub('a', false)] }))).toBe(false);
  });
});

describe('summarize', () => {
  const today = '2026-07-24';
  it('미완료·오늘마감·평균달성률 집계', () => {
    const projects = [
      proj({ id: 'p1', deadline: today, subtasks: [sub('a', true), sub('b', false)] }), // 50%, 미완료 1
      proj({ id: 'p2', subtasks: [sub('c', true)] }), // 100%
    ];
    const tasks = [
      task({ id: 't1', deadline: today }), // 오늘 마감 미완료
      task({ id: 't2', done: true, deadline: today }), // 완료 → 집계 제외
      task({ id: 't3' }),
    ];
    const s = summarize(projects, tasks, today);
    expect(s.incompleteCount).toBe(3); // t1,t3 + subtask b
    expect(s.dueTodayCount).toBe(2); // t1 + p1(50%<100)
    expect(s.avgProgress).toBe(75); // (50+100)/2
  });
  it('프로젝트 0개면 평균 0', () => {
    expect(summarize([], [], today).avgProgress).toBe(0);
  });
});

describe('filterByTag', () => {
  it('null이면 전체, 태그 지정 시 해당 태그만', () => {
    const items = [task({ id: 'a', tags: ['공부'] }), task({ id: 'b', tags: ['운동'] })];
    expect(filterByTag(items, null)).toHaveLength(2);
    expect(filterByTag(items, '공부').map((t) => t.id)).toEqual(['a']);
  });
});

describe('sortProjects', () => {
  it('최신 생성순, 완료(100%)는 뒤로', () => {
    const done = proj({
      id: 'done',
      createdAt: '2026-07-03T00:00:00.000Z',
      subtasks: [sub('a', true)],
    });
    const oldP = proj({ id: 'old', createdAt: '2026-07-01T00:00:00.000Z' });
    const newP = proj({ id: 'new', createdAt: '2026-07-02T00:00:00.000Z' });
    expect(sortProjects([oldP, done, newP]).map((p) => p.id)).toEqual([
      'new',
      'old',
      'done',
    ]);
  });
});

describe('splitTasks', () => {
  it('미완료는 마감 오름차순(무마감 뒤), 완료는 분리', () => {
    const a = task({ id: 'a', deadline: '2026-07-25' });
    const b = task({ id: 'b' });
    const c = task({ id: 'c', deadline: '2026-07-20' });
    const d = task({ id: 'd', done: true });
    const { pending, done } = splitTasks([a, b, c, d]);
    expect(pending.map((t) => t.id)).toEqual(['c', 'a', 'b']);
    expect(done.map((t) => t.id)).toEqual(['d']);
  });
});

describe('collectTags', () => {
  it('프로젝트+할일 태그 합집합, 이름순·중복 제거', () => {
    const projects = [proj({ tags: ['b', 'a'] })];
    const tasks = [task({ tags: ['a', 'c'] })];
    expect(collectTags(projects, tasks)).toEqual(['a', 'b', 'c']);
  });
});

describe('eventsOn / eventDateSet', () => {
  it('해당 날짜만, 무시간 먼저 후 시간순', () => {
    const e1 = ev({ id: '1', time: '14:00' });
    const e2 = ev({ id: '2' });
    const e3 = ev({ id: '3', time: '09:30' });
    const e4 = ev({ id: '4', date: '2026-07-25' });
    expect(eventsOn([e1, e2, e3, e4], '2026-07-24').map((e) => e.id)).toEqual([
      '2',
      '3',
      '1',
    ]);
    expect(eventDateSet([e1, e4]).has('2026-07-25')).toBe(true);
    expect(eventDateSet([e1, e4]).size).toBe(2);
  });
});
