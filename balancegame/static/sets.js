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
  return Array.from(document.querySelectorAll('.item-pick-card.selected'))
    .map(c => parseInt(c.dataset.id));
}

function setChecked(ids) {
  document.querySelectorAll('.item-pick-card').forEach(c => {
    c.classList.toggle('selected', ids.includes(parseInt(c.dataset.id)));
  });
}

async function loadCheckboxes() {
  const res = await fetch('/api/items');
  const items = await res.json();
  itemCbWrap.innerHTML = '';

  if (!items.length) {
    itemCbWrap.innerHTML = `<p style="font-style:italic;color:var(--ink-light);font-size:0.85rem">
      항목이 없습니다. <a href="/" style="color:var(--gold-mid)">항목 관리</a>에서 추가해주세요.</p>`;
    return;
  }

  items.forEach(item => {
    const img = item.image_path ? '/uploads/' + esc(item.image_path) : null;
    const card = document.createElement('div');
    card.className = 'item-pick-card';
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="item-pick-photo">
        ${img
          ? `<img src="${img}" alt="${esc(item.title)}">`
          : `<div class="item-pick-init">${esc(item.title.charAt(0).toUpperCase())}</div>`}
      </div>
      <div class="item-pick-check">✓</div>
      <div class="item-pick-title">${esc(item.title)}</div>
    `;
    card.addEventListener('click', () => card.classList.toggle('selected'));
    itemCbWrap.appendChild(card);
  });
}

function renderSetGroup(set) {
  const initial = esc(set.question.charAt(0).toUpperCase());
  const wrap = document.createElement('div');
  wrap.className = 'sset-wrap';
  wrap.dataset.id = set.id;

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

  const actions = document.createElement('div');
  actions.className = 'sset-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'sset-btn sset-btn-edit';
  editBtn.textContent = '수정';
  editBtn.addEventListener('click', async () => {
    const r = await fetch(`/api/sets/${set.id}`);
    const s = await r.json();
    inpQuestion.value = s.question;
    setChecked(s.items.map(i => i.id));
    editingSetId = parseInt(set.id);
    btnSaveSet.textContent = '수정하기';
    document.getElementById('set-form').scrollIntoView({ behavior: 'smooth' });
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'sset-btn sset-btn-del';
  delBtn.textContent = '삭제';
  delBtn.addEventListener('click', async () => {
    if (!confirm('셋을 삭제할까요?')) return;
    await fetch(`/api/sets/${set.id}`, { method: 'DELETE' });
    wrap.remove();
  });

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  wrap.appendChild(group);
  wrap.appendChild(actions);
  return wrap;
}

async function loadSets() {
  const res = await fetch('/api/sets');
  const sets = await res.json();
  setsCascade.innerHTML = '';
  if (!sets.length) {
    setsCascade.innerHTML = `<p style="font-style:italic;color:var(--ink-light);font-size:0.9rem">
      아직 만든 셋이 없습니다.</p>`;
    return;
  }
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
