import notes from '@/docs/tianji-ziwei/review/knowledge-notes.json';

export interface KnowledgeClaim {
  text: string;
  sources: string[];
}
export interface KnowledgeReview {
  heading: string;
  scope: string;
  correction: string;
  claims: KnowledgeClaim[];
}
export interface KnowledgeSource {
  kind: 'transcript' | 'classic';
  label: string;
  url: string;
  note: string;
  reviewLevel: 'transcript-compared' | 'electronic-text-compared';
  line?: number;
  entryHash?: string;
  section?: string;
}
export const KNOWLEDGE_REVIEWS: Record<string, KnowledgeReview> = notes.pages;
export const KNOWLEDGE_SOURCES = notes.sources as Record<string, KnowledgeSource>;
export const KNOWLEDGE_REVIEW_DATE = notes.reviewedAt;
