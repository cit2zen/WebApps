let editingSetId = null;

const inpQuestion  = document.getElementById('inp-question');
const btnSaveSet   = document.getElementById('btn-save-set');
const setStatus    = document.getElementById('set-status');
const itemCbWrap   = document.getElementById('item-checkboxes');
const setsList     = document.getElementById('sets-list');

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

function renderSetItem(set) {
  const div = document.createElement('div');
  div.className = 'set-list-item';
  div.dataset.id = set.id;
  div.innerHTML = `
    <div>
      <div class="set-list-q">"${esc(set.question)}"</div>
      <div class="set-list-meta">${set.item_count}개 항목</div>
    </div>
    <div class="set-actions">
      <button class="btn-sm btn-edit-set" data-id="${set.id}">수정</button>
      <button class="btn-sm btn-del-set" data-id="${set.id}">삭제</button>
    </div>
  `;
  return div;
}

async function loadSets() {
  const res = await fetch('/api/sets');
  const sets = await res.json();
  setsList.innerHTML = '';
  sets.forEach(s => setsList.appendChild(renderSetItem(s)));
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

setsList.addEventListener('click', async e => {
  const delBtn = e.target.closest('.btn-del-set');
  if (delBtn) {
    const id = delBtn.dataset.id;
    if (!confirm('셋을 삭제할까요?')) return;
    await fetch(`/api/sets/${id}`, { method: 'DELETE' });
    document.querySelector(`.set-list-item[data-id="${id}"]`)?.remove();
    return;
  }

  const editBtn = e.target.closest('.btn-edit-set');
  if (editBtn) {
    const id = editBtn.dataset.id;
    const res = await fetch(`/api/sets/${id}`);
    const set = await res.json();
    inpQuestion.value = set.question;
    setChecked(set.items.map(i => i.id));
    editingSetId = parseInt(id);
    btnSaveSet.textContent = '수정하기';
    document.getElementById('set-form').scrollIntoView({ behavior: 'smooth' });
  }
});

loadCheckboxes();
loadSets();
