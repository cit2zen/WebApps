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
    <div className="pol-panel td-intro">
      <button
        type="button"
        aria-label="안내 닫기"
        onClick={dismissIntro}
        className="td-icon-btn td-intro-close"
      >
        ×
      </button>
      <p className="pol-eyebrow">처음 오셨나요</p>
      <p className="td-intro-title">👋 개인용 할 일 관리 앱이에요</p>
      <ul className="td-intro-list">
        <li>
          데이터는 <b className="td-strong">이 브라우저에만</b> 저장돼요 (서버 전송 없음).
          백업·기기 이동은 우상단 <b className="td-strong">내보내기/가져오기</b>.
        </li>
        <li>
          <b className="td-strong tone-projects">프로젝트</b> = 세부 체크리스트·진행률 ·{' '}
          <b className="td-strong tone-tasks">할 일</b> = 빠른 한 줄 추가 ·{' '}
          <b className="td-strong tone-events">일정</b> = 미니 캘린더.
        </li>
        <li>태그는 쉼표로 구분해 입력하면 상단에 # 필터 칩이 생겨요.</li>
      </ul>
    </div>
  );
}
