// js/rng.js — §5 결정성 규약의 fnv·mulberry32 두 줄(원문 그대로, export만 붙임 — §6 정합 #2)
export const fnv=s=>{let h=0x811c9dc5;for(const b of new TextEncoder().encode(s)){h^=b;h=Math.imul(h,0x01000193)>>>0;}return h;};
export const mulberry32=a=>()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
