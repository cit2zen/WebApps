let bracket = [];
let roundWinners = [];
let currentMatch = 0;
let roundNum = 0;
let currentSetId = null;

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function imageUrl(path) { return path ? '/uploads/' + path : null; }

// 항상 2의거듭제곱: prevPow2(6)=4, prevPow2(8)=8, prevPow2(10)=8
function prevPow2(n) {
  if (n < 2) return 2;
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

function renderCard(el, item) {
  const img = imageUrl(item.image_path);
  el.innerHTML = `
    <div class="pol-photo">
      ${img
        ? `<img src="${img}" alt="${esc(item.title)}">`
        : `<div class="pol-placeholder">${esc(item.title.charAt(0).toUpperCase())}</div>`}
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
  // 2의거듭제곱이 보장되므로 bye 없음
  roundWinners = [];
  bracket = shuffle([...items]);
}

function getRoundLabel() {
  const total = bracket.length + roundWinners.length;
  if (total === 2) return '결승';
  return `${total}강`;
}

function showMatch() {
  const a = bracket[currentMatch * 2];
  const b = bracket[currentMatch * 2 + 1];
  const matchesTotal = Math.floor(bracket.length / 2);

  const badge = document.getElementById('round-badge');
  badge.textContent = `${getRoundLabel()} ${currentMatch + 1} / ${matchesTotal}`;
  badge.style.display = 'block';

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
  const winEl = winner.id === parseInt(document.getElementById('card-a').dataset.id)
    ? document.getElementById('card-a')
    : document.getElementById('card-b');
  winEl.classList.add('chosen');

  await new Promise(r => setTimeout(r, 500));

  roundWinners.push(winner);
  currentMatch++;

  if (currentMatch >= Math.floor(bracket.length / 2)) {
    if (roundWinners.length === 1) {
      await recordWin(roundWinners[0].id);
      goToResult(roundWinners[0]);
      return;
    }
    // 다음 라운드도 2의거듭제곱이 보장됨
    buildBracket(roundWinners);
    currentMatch = 0;
    roundNum++;
  }
  showMatch();
}

async function recordWin(id) {
  await fetch(`/api/win/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ set_id: currentSetId })
  });
}

function goToResult(winner) {
  sessionStorage.setItem('winner', JSON.stringify(winner));
  location.href = '/result';
}

async function init() {
  const setId = sessionStorage.getItem('selectedSetId');
  const bracketSize = parseInt(sessionStorage.getItem('bracketSize') || '16');

  if (!setId) { location.href = '/'; return; }
  currentSetId = parseInt(setId);

  const res = await fetch(`/api/sets/${setId}`);
  if (!res.ok) { location.href = '/'; return; }
  const setData = await res.json();

  const qEl = document.getElementById('game-question');
  qEl.textContent = `"${setData.question}"`;
  qEl.style.display = 'block';

  const pool = setData.items;
  if (pool.length < 2) {
    document.getElementById('loading').textContent = '항목이 2개 이상 필요합니다.';
    return;
  }

  // 선택한 강수와 보유 항목 중 작은 값을, 2의거듭제곱으로 내림
  const rawCount = Math.min(bracketSize, pool.length);
  const count = prevPow2(rawCount);

  const items = shuffle([...pool]).slice(0, count);
  buildBracket(items);
  showMatch();

  document.getElementById('card-a').addEventListener('click', () => {
    onChoose(bracket[currentMatch * 2]);
  });
  document.getElementById('card-b').addEventListener('click', () => {
    onChoose(bracket[currentMatch * 2 + 1]);
  });
}

init();
