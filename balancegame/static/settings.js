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
    ${img ? `
    <button class="btn-rotate" data-id="${item.id}" data-dir="ccw" title="왼쪽으로 90° 회전">↺</button>
    <button class="btn-rotate" data-id="${item.id}" data-dir="cw" title="오른쪽으로 90° 회전">↻</button>` : ''}
    <div class="pol-photo">
      ${img ? `<img src="${img}" alt="${esc(item.title)}">` : `<div class="pol-placeholder">${initial(item.title)}</div>`}
    </div>
    <div class="item-title"></div>
    <div class="win-badge">🏆 ${item.win_count}회</div>
  `;
  renderTitle(card.querySelector('.item-title'), item.title);
  return card;
}

function renderTitle(el, title) {
  el.dataset.title = title;
  el.textContent = title;
  const pen = document.createElement('span');
  pen.className = 'edit-pen';
  pen.textContent = ' ✎';
  el.appendChild(pen);
}

function startTitleEdit(titleEl) {
  const card = titleEl.closest('.item-card');
  const id = card.dataset.id;
  const old = titleEl.dataset.title;

  titleEl.textContent = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'title-input';
  input.value = old;
  titleEl.appendChild(input);
  input.focus();
  input.select();

  let done = false;
  const finish = async (save) => {
    if (done) return;
    done = true;
    const val = input.value.trim();
    if (!save || !val || val === old) { renderTitle(titleEl, old); return; }
    const res = await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: val })
    });
    if (res.ok) {
      renderTitle(titleEl, val);
      const ph = card.querySelector('.pol-placeholder');
      if (ph) ph.textContent = val.charAt(0).toUpperCase();
      window.refreshSetsUI?.();
    } else {
      renderTitle(titleEl, old);
      const err = await res.json().catch(() => ({}));
      showMsg(status, err.error || '이름 수정에 실패했어요.');
    }
  };
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') finish(true);
    if (ev.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
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
  const rot = e.target.closest('.btn-rotate');
  if (rot) {
    rot.disabled = true;
    const res = await fetch(`/api/items/${rot.dataset.id}/rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir: rot.dataset.dir })
    });
    rot.disabled = false;
    if (res.ok) {
      const data = await res.json();
      const im = document.querySelector(`.item-card[data-id="${rot.dataset.id}"] .pol-photo img`);
      if (im) im.src = imageUrl(data.image_path);
    } else {
      const err = await res.json().catch(() => ({}));
      showMsg(status, err.error || '회전에 실패했어요.');
    }
    return;
  }

  const titleEl = e.target.closest('.item-title');
  if (titleEl && !titleEl.querySelector('input')) {
    startTitleEdit(titleEl);
    return;
  }

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
