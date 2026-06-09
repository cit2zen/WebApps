let editingSetId = null;

const inpQuestion = document.getElementById('inp-question');
const btnSaveSet  = document.getElementById('btn-save-set');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const editBadge   = document.getElementById('edit-badge');
const setStatus   = document.getElementById('set-status');
const itemCbWrap  = document.getElementById('item-checkboxes');
const setsCascade = document.getElementById('sets-cascade');

function getSelectedIds() {
  return Array.from(document.querySelectorAll('.item-chip.selected'))
    .map(c => parseInt(c.dataset.id));
}

function setChecked(ids) {
  document.querySelectorAll('.item-chip').forEach(c => {
    c.classList.toggle('selected', ids.includes(parseInt(c.dataset.id)));
  });
}

async function loadCheckboxes() {
  const keep = getSelectedIds(); // 재로드 시 기존 선택 보존
  const res = await fetch('/api/items');
  const items = await res.json();
  itemCbWrap.innerHTML = '';

  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'empty-msg';
    p.textContent = '항목이 없어요. ';
    const a = document.createElement('a');
    a.href = '/';
    a.textContent = '항목 관리에서 먼저 추가해주세요.';
    a.style.color = 'var(--gold-mid)';
    a.addEventListener('click', e => {
      e.preventDefault();
      document.querySelector('.snav-btn[data-tab="items"]')?.click();
    });
    p.appendChild(a);
    itemCbWrap.appendChild(p);
    return;
  }

  items.forEach(item => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'item-chip';
    chip.dataset.id = item.id;
    chip.textContent = item.title;
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
    itemCbWrap.appendChild(chip);
  });
  setChecked(keep);
}

function enterEditMode(setId) {
  editingSetId = parseInt(setId);
  editBadge.style.display = 'inline-block';
  btnSaveSet.textContent = '수정 저장';
  btnCancelEdit.style.display = 'inline-block';
}

function resetForm() {
  editingSetId = null;
  inpQuestion.value = '';
  setChecked([]);
  editBadge.style.display = 'none';
  btnSaveSet.textContent = '셋 만들기';
  btnCancelEdit.style.display = 'none';
}

function previewTitles(set) {
  const titles = set.item_titles || [];
  if (!titles.length) return `${set.item_count}개 항목`;
  const head = titles.slice(0, 3).join(', ');
  return titles.length > 3 ? `${head} +${titles.length - 3}개` : head;
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
    <div class="sset-meta">${esc(previewTitles(set))}</div>
  `;
  group.appendChild(front);

  const actions = document.createElement('div');
  actions.className = 'sset-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'sset-btn sset-btn-edit';
  editBtn.textContent = '수정';
  editBtn.addEventListener('click', async () => {
    const r = await fetch(`/api/sets/${set.id}`);
    const s = await r.json();
    inpQuestion.value = s.question;
    await loadCheckboxes();
    setChecked(s.items.map(i => i.id));
    enterEditMode(set.id);
    document.getElementById('set-form').scrollIntoView({ behavior: 'smooth' });
  });

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'sset-btn sset-btn-del';
  delBtn.textContent = '삭제';
  delBtn.addEventListener('click', async () => {
    if (!confirm('셋을 삭제할까요?')) return;
    delBtn.disabled = true;
    const res = await fetch(`/api/sets/${set.id}`, { method: 'DELETE' });
    if (res.ok) {
      if (editingSetId === parseInt(set.id)) resetForm();
      wrap.remove();
      if (!setsCascade.querySelector('.sset-wrap')) loadSets();
    } else {
      delBtn.disabled = false;
    }
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
    setsCascade.innerHTML = `<p class="empty-msg">
      셋이 없어요. 항목을 2개 이상 선택하고 질문을 써서 첫 셋을 만들어보세요.</p>`;
    return;
  }
  sets.forEach(s => setsCascade.appendChild(renderSetGroup(s)));
}

btnSaveSet.addEventListener('click', async () => {
  const question = inpQuestion.value.trim();
  const item_ids = getSelectedIds();
  if (!question) { showMsg(setStatus, '질문을 입력해주세요.'); return; }
  if (item_ids.length < 2) { showMsg(setStatus, '항목을 2개 이상 선택해주세요.'); return; }

  const url    = editingSetId ? `/api/sets/${editingSetId}` : '/api/sets';
  const method = editingSetId ? 'PUT' : 'POST';
  const wasEditing = editingSetId;

  btnSaveSet.disabled = true;
  btnSaveSet.textContent = '저장 중...';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, item_ids })
  });
  btnSaveSet.disabled = false;

  if (res.ok) {
    resetForm();
    showMsg(setStatus, wasEditing ? '수정됐어요!' : '셋이 만들어졌어요!');
    await loadSets();
  } else {
    btnSaveSet.textContent = wasEditing ? '수정 저장' : '셋 만들기';
    const err = await res.json().catch(() => ({}));
    showMsg(setStatus, err.error || '오류가 발생했어요.');
  }
});

btnCancelEdit.addEventListener('click', resetForm);

// settings.js(항목 추가/삭제)에서 호출 — 칩·셋 목록 동기화
window.refreshSetsUI = () => { loadCheckboxes(); loadSets(); };

loadCheckboxes();
loadSets();
