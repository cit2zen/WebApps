// 토너먼트 상태
let bracket = [];   // 현재 라운드 항목 배열
let roundWinners = [];
let currentMatch = 0;
let roundNum = 0;
let totalRounds = 0;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function imageUrl(path) {
  return path ? '/uploads/' + path : null;
}

function renderCard(el, item) {
  const img = imageUrl(item.image_path);
  const initial = esc(item.title.charAt(0).toUpperCase());
  el.innerHTML = `
    <div class="pol-photo">
      ${img
        ? `<img src="${img}" alt="${esc(item.title)}">`
        : `<div class="pol-placeholder">${initial}</div>`}
    </div>
    <div class="pol-caption">${esc(item.title)}</div>
  `;
  el.dataset.id = item.id;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildBracket(items) {
  // 홀수면 마지막 항목 부전승으로 roundWinners에 먼저 추가
  const shuffled = shuffle([...items]);
  if (shuffled.length % 2 === 1) {
    roundWinners = [shuffled.pop()];
  } else {
    roundWinners = [];
  }
  bracket = shuffled;
}

function getRoundLabel() {
  const total = bracket.length + roundWinners.length;
  if (total === 2) return '결승';
  if (total === 4) return '4강';
  if (total === 8) return '8강';
  if (total === 16) return '16강';
  return `${total}강`;
}

function showMatch() {
  const a = bracket[currentMatch * 2];
  const b = bracket[currentMatch * 2 + 1];
  const matchesTotal = Math.floor(bracket.length / 2);

  document.getElementById('round-badge').textContent =
    `${getRoundLabel()} ${currentMatch + 1} / ${matchesTotal}`;
  document.getElementById('round-badge').style.display = 'block';

  const cardA = document.getElementById('card-a');
  const cardB = document.getElementById('card-b');
  renderCard(cardA, a);
  renderCard(cardB, b);
  cardA.classList.remove('chosen');
  cardB.classList.remove('chosen');

  document.getElementById('battle-area').style.display = 'flex';
  document.getElementById('loading').style.display = 'none';
}

async function onChoose(winner) {
  // 애니메이션
  const winEl = winner.id === parseInt(document.getElementById('card-a').dataset.id)
    ? document.getElementById('card-a')
    : document.getElementById('card-b');
  winEl.classList.add('chosen');

  await new Promise(r => setTimeout(r, 500));

  roundWinners.push(winner);
  currentMatch++;

  if (currentMatch >= Math.floor(bracket.length / 2)) {
    // 라운드 끝
    if (roundWinners.length === 1) {
      // 우승자 확정
      await recordWin(roundWinners[0].id);
      goToResult(roundWinners[0]);
      return;
    }
    // 다음 라운드 준비
    buildBracket(roundWinners);
    currentMatch = 0;
    roundNum++;
  }
  showMatch();
}

async function recordWin(id) {
  await fetch(`/api/win/${id}`, { method: 'POST' });
}

function goToResult(winner) {
  sessionStorage.setItem('winner', JSON.stringify(winner));
  location.href = '/result';
}

async function init() {
  const res = await fetch('/api/items');
  const items = await res.json();
  if (items.length < 2) {
    document.getElementById('loading').textContent = '항목이 2개 이상 필요합니다. 설정 페이지에서 추가해주세요.';
    return;
  }
  totalRounds = Math.ceil(Math.log2(items.length));
  buildBracket(items);
  showMatch();

  document.getElementById('card-a').addEventListener('click', () => {
    const a = bracket[currentMatch * 2];
    onChoose(a);
  });
  document.getElementById('card-b').addEventListener('click', () => {
    const b = bracket[currentMatch * 2 + 1];
    onChoose(b);
  });
}

init();
