// 척척이 대사 — 전국 공통 분리배출 기본 규칙만 (환경부 안내 기준)
export const TIPS = [
  '페트병은 라벨을 떼고 찌그러뜨려요!',
  '우유팩은 종이랑 따로 모아요!',
  '뼈다귀는 음식물이 아니라 일반쓰레기야!',
  '병뚜껑은 따로 빼서 버려요!',
  '깨진 유리는 신문지에 싸서 일반쓰레기로!',
  '폐건전지는 전용 수거함에 넣어요!',
  '음식이 묻은 비닐은 씻어서 버려요!',
  '스티로폼은 테이프랑 스티커를 떼요!',
  '캔은 내용물을 비우고 헹궈요!',
  '택배 상자는 테이프를 떼고 접어요!',
  '비우고, 헹구고, 분리하고, 섞지 않기!',
];

export const GREET = ['안녕! 나는 척척이야', '같이 분리수거 하자!', '나를 눌러 봐!'];
export const CORRECT = ['척척!', '좋아!', '완벽해!', '최고!'];

export const PLAY = {
  start: '가 보자!',
  combo: (n) => `콤보 ${n}!`,
  fever: '피버 타임!',
  wrong: '앗! 다음엔 맞힐 거야',
  miss: '아까워!',
  danger: '서둘러!',
  rush: '러시다! 힘내!',
  split: '분해 성공!',
  shield: '방패 덕분에 살았다!',
  bonus: '퀴즈 박사!',
  power: '황금 아이템!',
};

/** 결과 화면 — run:end 내용에 따라 [기분, 말] */
export function resultLine(r) {
  if (!r) return ['happy', '수고했어!'];
  if (r.mode === 'review') return ['cheer', '복습 끝! 똑똑해졌어!'];
  if (r.mode === 'daily') return ['cheer', '오늘의 도전 완료!'];
  if (r.endless || r.mode === 'endless') return ['cheer', '대단해! 끝까지 달렸어!'];
  if (r.success) return ['cheer', '최고야!'];
  return ['sad', '괜찮아, 다시 해 보자!'];
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
