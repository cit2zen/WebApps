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
  if (total <= 4) return '4강';
  if (total <= 8) return '8강';
  if (total <= 16) return '16강';
  if (total <= 32) return '32강';
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

  const count = Math.min(bracketSize, pool.length);
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
