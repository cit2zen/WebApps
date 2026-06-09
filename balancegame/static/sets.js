let editingSetId = null;

const inpQuestion = document.getElementById('inp-question');
const btnSaveSet  = document.getElementById('btn-save-set');
const setStatus   = document.getElementById('set-status');
const itemCbWrap  = document.getElementById('item-checkboxes');
const setsCascade = document.getElementById('sets-cascade');

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function getSelectedIds() {
  return Array.from(document.querySelectorAll('.item-cb:checked')).map(cb => parseInt(cb.value));
}

function setChecked(ids) {
  document.querySelectorAll('.item-cb').forEach(cb => {
    cb.checked = ids.includes(parseInt(cb.value));
  });
}

async function loadCheckboxes() {
  const res = await fetch('/api/items');
  const items = await res.json();
  itemCbWrap.innerHTML = items.map(item => `
    <label class="item-cb-label">
      <input type="checkbox" class="item-cb" value="${item.id}">
      ${esc(item.title)}
    </label>
  `).join('');
}

function renderSetGroup(set) {
  const initial = esc(set.question.charAt(0).toUpperCase());
  const wrap = document.createElement('div');
  wrap.className = 'sset-wrap';
  wrap.dataset.id = set.id;

  // Cascade group
  const group = document.createElement('div');
  group.className = 'sset-group';

  for (let i = 0; i < 2; i++) {
    const card = document.createElement('div');
    card.className = 'sset-card';
    card.innerHTML = `<div class="sset-photo"><span class="sset-deco">⚖</span></div>`;
    group.appendChild(card);
  }

  const front = document.createElement('div');
  front.className = 'sset-card';
  front.innerHTML = `
    <div class="sset-photo"><span class="sset-initial">${initial}</span></div>
    <div class="sset-q">"${esc(set.question)}"</div>
    <div class="sset-meta">${set.item_count}개 항목</div>
  `;
  group.appendChild(front);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'sset-actions';
  actions.style.width = 'calc(var(--lw, 160px) + 2rem)';
  actions.innerHTML = `
    <button class="sset-btn sset-btn-edit" data-id="${set.id}">수정</button>
    <button class="sset-btn sset-btn-del"  data-id="${set.id}">삭제</button>
  `;

  actions.querySelector('.sset-btn-del').addEventListener('click', async () => {
    if (!confirm('셋을 삭제할까요?')) return;
    await fetch(`/api/sets/${set.id}`, { method: 'DELETE' });
    wrap.remove();
  });

  actions.querySelector('.sset-btn-edit').addEventListener('click', async () => {
    const res = await fetch(`/api/sets/${set.id}`);
    const s = await res.json();
    inpQuestion.value = s.question;
    setChecked(s.items.map(i => i.id));
    editingSetId = parseInt(set.id);
    btnSaveSet.textContent = '수정하기';
    document.getElementById('set-form').scrollIntoView({ behavior: 'smooth' });
  });

  wrap.appendChild(group);
  wrap.appendChild(actions);
  return wrap;
}

async function loadSets() {
  const res = await fetch('/api/sets');
  const sets = await res.json();
  setsCascade.innerHTML = '';
  sets.forEach(s => setsCascade.appendChild(renderSetGroup(s)));
}

btnSaveSet.addEventListener('click', async () => {
  const question = inpQuestion.value.trim();
  const item_ids = getSelectedIds();
  if (!question) { setStatus.textContent = '질문을 입력해주세요.'; return; }
  if (item_ids.length < 2) { setStatus.textContent = '항목을 2개 이상 선택해주세요.'; return; }

  const url    = editingSetId ? `/api/sets/${editingSetId}` : '/api/sets';
  const method = editingSetId ? 'PUT' : 'POST';

  btnSaveSet.disabled = true;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, item_ids })
  });
  btnSaveSet.disabled = false;

  if (res.ok) {
    const wasEditing = editingSetId;
    editingSetId = null;
    btnSaveSet.textContent = '셋 만들기';
    inpQuestion.value = '';
    setChecked([]);
    setStatus.textContent = wasEditing ? '수정됐어요!' : '셋이 만들어졌어요!';
    setTimeout(() => { setStatus.textContent = ''; }, 2000);
    await loadSets();
  } else {
    const err = await res.json().catch(() => ({}));
    setStatus.textContent = err.error || '오류가 발생했어요.';
  }
});

loadCheckboxes();
loadSets();
