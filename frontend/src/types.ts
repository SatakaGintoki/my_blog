export interface Taxonomy { id: number; name: string; slug: string }
export interface Site { title: string; description: string; author: string; about: string; comments_enabled: boolean }
export interface PostSummary {
  id: number; title: string; slug: string; summary: string; status: 'draft' | 'published';
  category: Taxonomy | null; tags: Taxonomy[]; created_at: string; updated_at: string; published_at: string | null;
}
export interface Post extends PostSummary { content: string }
export interface PostPage { items: PostSummary[]; total: number; page: number; page_size: number }
export interface Comment { id: number; post_id: number; author: string; content: string; approved: boolean; created_at: string }
export interface PostInput {
  title: string; slug: string; summary: string; content: string; status: 'draft' | 'published';
  category_id: number | null; tag_ids: number[]; expected_updated_at?: string;
}
