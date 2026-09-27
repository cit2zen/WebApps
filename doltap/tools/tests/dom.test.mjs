import { test } from 'node:test';
import assert from 'node:assert/strict';

// 최소 가짜 document: createElement → attrs 기록 + textContent
globalThis.document = {
  createElement: tag => ({ tagName: tag.toUpperCase(), attrs: {}, textContent: '',
    setAttribute(k, v) { this.attrs[k] = v; } }),
};
const { h, setText, fmt, setAria } = await import('../../js/dom.js');

test('h: 허용 키만 setAttribute, text는 textContent', () => {
  const el = h('button', { class: 'pol-btn-primary', type: 'button', 'aria-label': '공유', 'data-k': '3',
    disabled: true, readonly: false, tabindex: 0, id: 'share', role: 'button', alt: 'x' }, '<b>공유</b>');
  assert.equal(el.tagName, 'BUTTON');
  assert.deepEqual(el.attrs, { class: 'pol-btn-primary', type: 'button', 'aria-label': '공유', 'data-k': '3',
    disabled: '', tabindex: '0', id: 'share', role: 'button', alt: 'x' });
  assert.equal(el.textContent, '<b>공유</b>');
});

test('h: style·on*·href·src·그 밖의 키는 throw', () => {
  for (const k of ['style', 'onclick', 'onload', 'href', 'src', 'srcdoc', 'value', 'aria-', 'data-', 'ARIA-LABEL']) {
    assert.throws(() => h('div', { [k]: 'x' }), /허용하지 않는 속성/, k);
  }
});

test('setText·setAria', () => {
  const el = h('p');
  setText(el, '<img src=x onerror=alert(1)>');
  assert.equal(el.textContent, '<img src=x onerror=alert(1)>');
  setAria(el, 12);
  assert.equal(el.attrs['aria-label'], '12');
});

test('fmt: {key} 치환, 없는 키는 유지, HTML은 문자 그대로', () => {
  assert.equal(fmt('#{n} · {m}월 {d}일 · {trail}', { n: 1, m: 10, d: 1, trail: '달빛암 앞 돌길' }), '#1 · 10월 1일 · 달빛암 앞 돌길');
  assert.equal(fmt('친구 {F}cm', {}), '친구 {F}cm');
  assert.equal(fmt('{x}', { x: '<script>' }), '<script>');
  assert.equal(fmt('{toString}', {}), '{toString}');
});
