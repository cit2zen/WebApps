import type { ProductSource } from './types';
import { normalizeListing } from './normalize';

/** 개발/E2E용 결정적 소스. 네트워크 비의존. */
export const mockSource: ProductSource = {
  name: 'mock',
  async search(intent, limit) {
    const variants = ['베이직 모델', '프로 RGB', '미니 휴대용'];
    return Array.from({ length: Math.min(limit, 3) }).map((_, i) => ({
      url: `https://example.com/mock/${i}`,
      title: `${intent.rawQuery} ${variants[i] ?? `옵션 ${i}`}`,
      marketplace: i % 2 === 0 ? '쿠팡' : '네이버',
    }));
  },
  async fetchListing(hit) {
    const idx = Number(hit.url.split('/').pop() ?? 0);
    return normalizeListing(
      {
        url: hit.url,
        marketplace: hit.marketplace,
        title: hit.title,
        price: `${(idx + 3) * 10000}원`,
        shipping: idx === 0 ? '무료배송' : '3,000원',
        seller: '목판매자',
        rating: 4.2 + idx * 0.1,
        reviewCount: `${(idx + 1) * 250}`,
        images: ['https://example.com/img.jpg'],
        specs: { 연결: '무선' },
      },
      'kr',
    );
  },
};
