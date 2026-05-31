import { makeFirecrawlSource } from './firecrawlSource';

const KR_SITES = ['coupang.com', 'shopping.naver.com', '11st.co.kr', 'gmarket.co.kr'];

export const krSource = makeFirecrawlSource('kr', KR_SITES);
