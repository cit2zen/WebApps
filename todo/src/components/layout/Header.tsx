import { useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  backupFilename,
  buildBackup,
  downloadJson,
  parseBackup,
} from '../../utils/backup';
import { todayStr } from '../../utils/date';

const buttonClass =
  'rounded-xl bg-white px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-lavender-50';

export function Header() {
  const fileRef = useRef<HTMLInputElement>(null);
  const importData = useAppStore((s) => s.importData);

  const handleExport = () => {
    const { projects, tasks, events } = useAppStore.getState();
    const data = buildBackup(projects, tasks, events);
    downloadJson(backupFilename(todayStr()), JSON.stringify(data, null, 2));
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      importData(parseBackup(text));
    } catch {
      alert('잘못된 백업 파일입니다.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

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
    </header>
  );
}
