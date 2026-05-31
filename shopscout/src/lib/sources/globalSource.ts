import { makeFirecrawlSource } from './firecrawlSource';

const GLOBAL_SITES = ['amazon.com', 'ebay.com', 'aliexpress.com', 'temu.com'];

export const globalSource = makeFirecrawlSource('global', GLOBAL_SITES);
