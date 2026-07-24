import { useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { BackupData } from '../../types';
import {
  backupFilename,
  buildBackup,
  downloadJson,
  parseBackup,
} from '../../utils/backup';
import { todayStr } from '../../utils/date';
import { ConfirmDialog } from '../common/ConfirmDialog';

const buttonClass =
  'rounded-xl bg-white px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-lavender-50';

export function Header() {
  const fileRef = useRef<HTMLInputElement>(null);
  const importData = useAppStore((s) => s.importData);
  const [pendingImport, setPendingImport] = useState<BackupData | null>(null);

  const handleExport = () => {
    const { projects, tasks, events } = useAppStore.getState();
    const data = buildBackup(projects, tasks, events);
    downloadJson(backupFilename(todayStr()), JSON.stringify(data, null, 2));
  };

  const applyImport = (data: BackupData) => {
    const { projects, tasks, events } = useAppStore.getState();
    localStorage.setItem(
      'todo-app-storage:pre-import',
      JSON.stringify(buildBackup(projects, tasks, events)),
    );
    importData(data);
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = parseBackup(text);
      const { projects, tasks, events } = useAppStore.getState();
      const hasData = projects.length + tasks.length + events.length > 0;
      if (hasData) setPendingImport(data);
      else applyImport(data);
    } catch {
      alert('잘못된 백업 파일입니다.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const pendingSummary = pendingImport
    ? `프로젝트 ${pendingImport.projects.length}·할 일 ${pendingImport.tasks.length}·일정 ${pendingImport.events.length}`
    : '';

  return (
    <header className="flex items-center justify-between pt-6">
      <h1 className="text-2xl font-extrabold tracking-tight">
        todo<span className="text-lavender-400">.</span>
      </h1>
      <div className="flex gap-2">
        <button type="button" onClick={handleExport} className={buttonClass}>
          내보내기
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={buttonClass}
        >
          가져오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void handleImport(e.target.files?.[0])}
        />
      </div>
      <ConfirmDialog
        open={pendingImport !== null}
        message={`현재 데이터를 가져온 파일(${pendingSummary})로 전부 교체할까요? 기존 데이터는 사라집니다.`}
        confirmLabel="교체"
        onConfirm={() => {
          if (pendingImport) applyImport(pendingImport);
          setPendingImport(null);
        }}
        onCancel={() => setPendingImport(null)}
      />
    </header>
  );
}
