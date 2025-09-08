-- BLOG ANALYTICS için yeni metrik alanları
ALTER TABLE public.blog_analytics ADD COLUMN IF NOT EXISTS avg_words_per_post INTEGER DEFAULT 0;
ALTER TABLE public.blog_analytics ADD COLUMN IF NOT EXISTS growth_rate INTEGER DEFAULT 0;
ALTER TABLE public.blog_analytics ADD COLUMN IF NOT EXISTS keyword_diversity_score INTEGER DEFAULT 0;
ALTER TABLE public.blog_analytics ADD COLUMN IF NOT EXISTS publication_trend JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.blog_analytics ADD COLUMN IF NOT EXISTS monthly_posts JSONB DEFAULT '[]'::jsonb;

-- BLOG SEO SCORES için yeni alanlar
ALTER TABLE public.blog_seo_scores ADD COLUMN IF NOT EXISTS readability_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE public.blog_seo_scores ADD COLUMN IF NOT EXISTS mobile_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE public.blog_seo_scores ADD COLUMN IF NOT EXISTS technical_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE public.blog_seo_scores ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;
ALTER TABLE public.blog_seo_scores ADD COLUMN IF NOT EXISTS reading_time INTEGER DEFAULT 0;
