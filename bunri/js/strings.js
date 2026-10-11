// 문구·조사·단계 정보
export const STAGES = [
  { n: 1, name: '기초', desc: '기본 수거함 다섯 개로 시작해요.' },
  { n: 2, name: '헷갈리는 것들', desc: '비닐·음식물·투명 페트병이 더해져요.' },
  { n: 3, name: '분리배출 마스터', desc: '종이팩·스티로폼·특수까지 모두 나눠요.' },
  { n: 4, name: '무한 도전', desc: '시간 제한 없이 하트가 다할 때까지! 벨트는 점점 빨라져요.', endless: true },
];

export const stageInfo = (n) => STAGES.find((s) => s.n === n) || STAGES[0];

export const PRINCIPLES = ['비운다', '헹군다', '분리한다', '섞지 않는다'];

/** 마지막 글자 받침 여부 — 한글이 아니면 null */
export function hasBatchim(word) {
  const s = String(word).trim();
  const code = s.charCodeAt(s.length - 1);
  if (!(code >= 0xac00 && code <= 0xd7a3)) return null;
  return (code - 0xac00) % 28 !== 0;
}

/** josa('생수병', '은/는') → '생수병은' · 한글이 아니면 '은(는)' */
export function josa(word, pair) {
  const [withB, withoutB] = pair.split('/');
  const b = hasBatchim(word);
  if (b === null) return `${word}${withB}(${withoutB})`;
  return word + (b ? withB : withoutB);
}

export const starText = (n, max = 3) => '★'.repeat(n) + '☆'.repeat(Math.max(0, max - n));

export const CORRECT_WORDS = ['정답!', '척척!', '딩동댕!', '잘했어요!'];
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
