// js/dom.js — 보안 DOM 헬퍼(§6 보안 규칙). 사용자 입력·데이터 문자열은 이 4개 경로로만 DOM에 들어간다
const ALLOW = new Set(['class', 'id', 'type', 'role', 'tabindex', 'alt', 'disabled', 'readonly']);
const allowed = k => ALLOW.has(k) || /^aria-[a-z]+(-[a-z]+)*$/.test(k) || /^data-[a-z0-9]+(-[a-z0-9]+)*$/.test(k);

// createElement + setAttribute(허용 키만) + textContent. style·on*·href·src 등 그 밖의 키는 throw
export function h(tag, props = {}, text) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (!allowed(k)) throw new Error(`dom.h: 허용하지 않는 속성 "${k}"`);
    if (v === false || v === null || v === undefined) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}

export function setText(node, s) { node.textContent = String(s); }

// {key} → String(vars[key]). 없는 키는 그대로 둔다. 결과는 반드시 setText/h로 넣는다
export function fmt(tpl, vars = {}) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
}

export function setAria(node, s) { node.setAttribute('aria-label', String(s)); }
