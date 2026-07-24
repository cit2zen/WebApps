import { useAppStore } from '../../store/useAppStore';

export function IntroCard() {
  const projects = useAppStore((s) => s.projects);
  const tasks = useAppStore((s) => s.tasks);
  const events = useAppStore((s) => s.events);
  const introDismissed = useAppStore((s) => s.introDismissed);
  const dismissIntro = useAppStore((s) => s.dismissIntro);

  const isEmpty = projects.length + tasks.length + events.length === 0;
  if (introDismissed || !isEmpty) return null;

  return (
    <div className="relative rounded-2xl bg-white p-5 shadow-sm">
      <button
        type="button"
        aria-label="안내 닫기"
        onClick={dismissIntro}
        className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted/60 hover:text-ink"
      >
        ×
      </button>
      <p className="pr-8 text-sm font-bold">👋 개인용 할 일 관리 앱이에요</p>
      <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
        <li>
          데이터는 <b className="text-ink">이 브라우저에만</b> 저장돼요 (서버 전송 없음).
          백업·기기 이동은 우상단 <b className="text-ink">내보내기/가져오기</b>.
        </li>
        <li>
          <b className="text-lavender-500">프로젝트</b> = 세부 체크리스트·진행률 ·{' '}
          <b className="text-mint-500">할 일</b> = 빠른 한 줄 추가 ·{' '}
          <b className="text-peach-500">일정</b> = 미니 캘린더.
        </li>
        <li>태그는 쉼표로 구분해 입력하면 상단에 # 필터 칩이 생겨요.</li>
      </ul>
    </div>
  );
}
