import type { ProductSource } from './types';
import { krSource } from './krSource';
import { globalSource } from './globalSource';
import { mockSource } from './mockSource';

/** 환경변수 SHOPSCOUT_SOURCES=mock 이면 결정적 목 소스, 아니면 실 소스(국내+해외). */
export function resolveSources(): ProductSource[] {
  if (process.env.SHOPSCOUT_SOURCES === 'mock') return [mockSource];
  return [krSource, globalSource];
}
