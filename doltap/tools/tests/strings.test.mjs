import { test } from 'node:test';
import assert from 'node:assert/strict';
import S from '../../js/strings.js';
import { fmt } from '../../js/dom.js';

// §5 전문 + §6 추가 키 전체 목록(키 누락 0 검사)
const KEYS = {
  boot: ['loading'],
  lobby: ['todayTitle', 'todayDate', 'todayTries', 'todayDone', 'preLaunch', 'practiceTitle', 'practiceToday',
    'practicePast', 'practiceRandom', 'recordTitle', 'friendBadge', 'pastItem', 'sound', 'subtitle', 'friendPast',
    'pastBadge', 'todayChip', 'todayDoneChip', 'practiceCaption', 'recordCaption', 'recordNone', 'footer1',
    'footer2', 'close'],
  hud: ['skip', 'hold', 'milestone', 'flagBest', 'flagToday', 'flagFriend', 'rotCw', 'rotCcw', 'pause',
    'skipConfirm', 'cancelHint', 'portrait', 'subFriend', 'subBest'],
  pause: ['title', 'resume', 'toLobby', 'leaveWarn', 'leaveOk', 'leaveCancel', 'sound', 'hand', 'handRight',
    'handLeft', 'status', 'help', 'settings'],
  settings: ['vibe', 'on', 'off', 'tutReset'],
  toast: ['noTries', 'preLaunch', 'tutReset'],
  result: ['beatFriend', 'newBest', 'stats', 'shareBest', 'share', 'retry', 'lobby', 'physicsNote', 'copied',
    'copyFallback', 'practiceNote', 'header', 'headerPractice', 'sub', 'shareNote', 'retryLeft',
    'retryPracticeToday', 'retryPractice', 'selectAll', 'snapshotAlt'],
  record: ['today', 'best', 'streak', 'maxStreak', 'empty', 'bestLine', 'streakLine', 'maxLine', 'noStore',
    'todayLine', 'todayNone'],
  error: ['load', 'retry', 'hint'],
  share: ['head', 'headPractice', 'streak'],
};
const VARS = { n: 1, m: 10, d: 1, k: 2, H: '148.5', dd: 5, F: '148.5', t: 3, h: 100, left: 19, p: 4, x: '148.5',
  s: 1, best: '148.5', trail: '달빛암 앞 돌길', md: '10월 1일', placed: 12, grade: '산길 초입', r: 1 };

test('최상위 네임스페이스', () => {
  assert.deepEqual(Object.keys(S).sort(), ['boot', 'error', 'grade', 'help', 'helpKeys', 'helpNav', 'hud', 'lobby', 'pause',
    'record', 'result', 'settings', 'share', 'toast', 'version'].sort());
  assert.equal(S.version, 1);
});

test('키 누락 0 · 정의 밖 키 0 · 치환 뒤 { 잔존 0', () => {
  for (const [ns, keys] of Object.entries(KEYS)) {
    assert.deepEqual(Object.keys(S[ns]).sort(), [...keys].sort(), ns);
    for (const k of keys) {
      assert.equal(typeof S[ns][k], 'string', `${ns}.${k}`);
      assert.ok(S[ns][k].length > 0);
      assert.ok(!fmt(S[ns][k], VARS).includes('{'), `${ns}.${k} 치환 잔존`);
    }
  }
});

test('확정 값: pause.leaveOk·grade 5·help 3·helpKeys', () => {
  assert.equal(S.pause.leaveOk, '나가기');
  assert.deepEqual(S.grade, ['돌 하나 얹었다', '산길 초입', '암자 앞 돌탑', '큰스님도 끄덕', '산신령도 놀람']);
  assert.equal(S.help.length, 3);
  assert.equal(S.help[0], '끌어서 맞추고, 떼면 쿵');
  assert.equal(S.helpKeys, '←→ 이동 · ↑/X·Z 회전 · Space 낙하');
  assert.equal(S.result.snapshotAlt, '완성한 돌탑');
  assert.equal(S.error.hint, '인터넷 연결을 확인하고 다시 시도해 주세요');
});

test('공유 1·6행 형식(실례 2)', () => {
  assert.equal(fmt(S.share.head, { n: 1, H: (148.5).toFixed(1), left: 19 }), '돌탑 #1 🪨 148.5cm (19/24)');
  assert.equal(fmt(S.share.streak, { s: 1, k: 2 }), '🔥연속 1일 · 도전 2/3');
});
