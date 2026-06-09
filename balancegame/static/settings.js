const inpTitle = document.getElementById('inp-title');
const inpFile  = document.getElementById('inp-file');
const btnAdd   = document.getElementById('btn-add');
const status   = document.getElementById('status');
const grid     = document.getElementById('items-grid');
const dropZone = document.getElementById('drop-zone');
const dropPreview = document.getElementById('drop-preview');
const dropHint = document.getElementById('drop-hint');

function initial(title) { return esc(title.charAt(0).toUpperCase()); }

function showPreview(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    dropPreview.src = e.target.result;
    dropPreview.style.display = 'block';
    dropHint.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

inpFile.addEventListener('change', () => showPreview(inpFile.files[0]));

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    inpFile.files = dt.files;
    showPreview(file);
  }
});

function renderItem(item) {
  const card = document.createElement('div');
  card.className = 'item-card';
  card.dataset.id = item.id;
  const img = imageUrl(item.image_path);
  card.innerHTML = `
    <button class="btn-delete" data-id="${item.id}" title="삭제">×</button>
    <div class="pol-photo">
      ${img ? `<img src="${img}" alt="${esc(item.title)}">` : `<div class="pol-placeholder">${initial(item.title)}</div>`}
    </div>
    <div class="item-title">${esc(item.title)}</div>
    <div class="win-badge">🏆 ${item.win_count}회</div>
  `;
  return card;
}

function showEmptyIfNeeded() {
  if (grid.querySelector('.item-card')) return;
  grid.innerHTML = `<p class="empty-msg">아직 항목이 없어요. 위 폼에서 이름과 사진으로 첫 항목을 추가해보세요.</p>`;
}

async function loadItems() {
  const res = await fetch('/api/items');
  const items = await res.json();
  grid.innerHTML = '';
  items.forEach(item => grid.appendChild(renderItem(item)));
  showEmptyIfNeeded();
}

btnAdd.addEventListener('click', async () => {
  const title = inpTitle.value.trim();
  if (!title) { showMsg(status, '이름을 입력해주세요.'); return; }

  const file = inpFile.files[0];
  if (file && file.size > 5 * 1024 * 1024) {
    showMsg(status, '이미지가 5MB를 초과합니다.');
    return;
  }

  const fd = new FormData();
  fd.append('title', title);
  if (file) fd.append('image', file);

  btnAdd.disabled = true;
  btnAdd.textContent = '추가 중...';
  status.textContent = '';

  const res = await fetch('/api/items', { method: 'POST', body: fd });
  btnAdd.disabled = false;
  btnAdd.textContent = '추가하기';

  if (res.ok) {
    const item = await res.json();
    grid.querySelector('.empty-msg')?.remove();
    grid.appendChild(renderItem(item));
    inpTitle.value = '';
    inpFile.value = '';
    dropPreview.style.display = 'none';
    dropHint.style.display = 'block';
    showMsg(status, '추가됐어요!');
    window.refreshSetsUI?.();
  } else {
    const err = await res.json().catch(() => ({}));
    showMsg(status, err.error || '오류가 발생했어요.');
  }
});

grid.addEventListener('click', async e => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  const id = btn.dataset.id;
  if (!confirm('삭제할까요?')) return;
  btn.disabled = true;
  const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
  if (res.ok) {
    document.querySelector(`.item-card[data-id="${id}"]`)?.remove();
    showEmptyIfNeeded();
    window.refreshSetsUI?.();
  } else {
    btn.disabled = false;
  }
});

loadItems();
