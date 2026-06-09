const inpTitle = document.getElementById('inp-title');
const inpFile  = document.getElementById('inp-file');
const btnAdd   = document.getElementById('btn-add');
const status   = document.getElementById('status');
const grid     = document.getElementById('items-grid');
const dropZone = document.getElementById('drop-zone');
const dropPreview = document.getElementById('drop-preview');
const dropHint = document.getElementById('drop-hint');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function imageUrl(path) { return path ? '/uploads/' + path : null; }
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

async function loadItems() {
  const res = await fetch('/api/items');
  const items = await res.json();
  grid.innerHTML = '';
  items.forEach(item => grid.appendChild(renderItem(item)));
}

btnAdd.addEventListener('click', async () => {
  const title = inpTitle.value.trim();
  if (!title) { status.textContent = '이름을 입력해주세요.'; return; }

  const file = inpFile.files[0];
  if (file && file.size > 5 * 1024 * 1024) {
    status.textContent = '이미지가 5MB를 초과합니다.';
    return;
  }

  const fd = new FormData();
  fd.append('title', title);
  if (file) fd.append('image', file);

  btnAdd.disabled = true;
  status.textContent = '업로드 중...';

  const res = await fetch('/api/items', { method: 'POST', body: fd });
  btnAdd.disabled = false;

  if (res.ok) {
    const item = await res.json();
    grid.appendChild(renderItem(item));
    inpTitle.value = '';
    inpFile.value = '';
    dropPreview.style.display = 'none';
    dropHint.style.display = 'block';
    status.textContent = '추가됐어요!';
    setTimeout(() => { status.textContent = ''; }, 2000);
  } else {
    const err = await res.json();
    status.textContent = err.error || '오류가 발생했어요.';
  }
});

grid.addEventListener('click', async e => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  const id = btn.dataset.id;
  if (!confirm('삭제할까요?')) return;
  const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
  if (res.ok) {
    document.querySelector(`.item-card[data-id="${id}"]`)?.remove();
  }
});

loadItems();
