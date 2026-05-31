import type { PurchaseIntent, Recommendation } from '@/lib/types';

export interface Conversation {
  id: string;
  intent?: PurchaseIntent;
  lastRecommendation?: Recommendation;
}

export interface Store {
  getConversation(id: string): Promise<Conversation | null>;
  saveConversation(c: Conversation): Promise<void>;
}
