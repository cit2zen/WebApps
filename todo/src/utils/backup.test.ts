import { describe, expect, it } from 'vitest';
import type { Project, SimpleTask } from '../types';
import { backupFilename, buildBackup, parseBackup } from './backup';

const project: Project = {
  id: 'p1',
  title: '프로젝트',
  tags: ['태그'],
  subtasks: [{ id: 's1', title: '세부', done: false }],
  createdAt: '2026-07-01T00:00:00.000Z',
};

const task: SimpleTask = {
  id: 't1',
  title: '할일',
  done: false,
  tags: [],
  createdAt: '2026-07-01T00:00:00.000Z',
};

describe('buildBackup / parseBackup 라운드트립', () => {
  it('직렬화 후 파싱하면 동일 데이터', () => {
    const data = buildBackup([project], [task], []);
    const parsed = parseBackup(JSON.stringify(data));
    expect(parsed.projects).toEqual([project]);
    expect(parsed.tasks).toEqual([task]);
    expect(parsed.events).toEqual([]);
    expect(parsed.version).toBe(1);
  });
});

describe('backupFilename', () => {
  it('todo-backup-YYYY-MM-DD.json', () => {
    expect(backupFilename('2026-07-24')).toBe('todo-backup-2026-07-24.json');
  });
});

describe('parseBackup 검증', () => {
  it('비JSON은 throw', () => {
    expect(() => parseBackup('not json')).toThrow();
  });
  it('version 불일치는 throw', () => {
    const bad = { ...buildBackup([], [], []), version: 2 };
    expect(() => parseBackup(JSON.stringify(bad))).toThrow('INVALID_BACKUP');
  });
  it('배열 아닌 필드는 throw', () => {
    const bad = { ...buildBackup([], [], []), tasks: 'oops' };
    expect(() => parseBackup(JSON.stringify(bad))).toThrow('INVALID_BACKUP');
  });
  it('필수 필드 누락 항목은 throw', () => {
    const bad = buildBackup([], [{ ...task, title: 123 as unknown as string }], []);
    expect(() => parseBackup(JSON.stringify(bad))).toThrow('INVALID_BACKUP');
  });
  it('subtask 형식 오류는 throw', () => {
    const badProject = {
      ...project,
      subtasks: [{ id: 's', title: '세부' }],
    } as unknown as Project;
    const bad = buildBackup([badProject], [], []);
    expect(() => parseBackup(JSON.stringify(bad))).toThrow('INVALID_BACKUP');
  });
});
