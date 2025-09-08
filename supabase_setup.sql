-- =================================================
-- BLOG ANALYTICS TABLE (Dashboard için)
-- =================================================
CREATE TABLE IF NOT EXISTS public.blog_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    wordpress_url TEXT NOT NULL,
    total_posts INTEGER NOT NULL DEFAULT 0,
    total_keywords INTEGER NOT NULL DEFAULT 0,
    top_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    treatment_coverage JSONB NOT NULL DEFAULT '[]'::jsonb,
    category_stats JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Unique constraint for upsert operations (Dashboard için gerekli)
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_analytics_user_url 
ON public.blog_analytics(user_id, wordpress_url);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_analytics_user_id ON public.blog_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_analytics_created_at ON public.blog_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_analytics_last_updated ON public.blog_analytics(last_updated DESC);

-- =================================================
-- BLOG SEO SCORES TABLE (SEO Assistant için)
-- =================================================
CREATE TABLE IF NOT EXISTS public.blog_seo_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    post_id INTEGER NOT NULL,
    post_title TEXT NOT NULL,
    wordpress_url TEXT NOT NULL,
    seo_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    keyword_score DECIMAL(5,2) DEFAULT 0,
    title_score DECIMAL(5,2) DEFAULT 0,
    content_score DECIMAL(5,2) DEFAULT 0,
    readability_score DECIMAL(5,2) DEFAULT 0,
    mobile_score DECIMAL(5,2) DEFAULT 0,
    technical_score DECIMAL(5,2) DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    reading_time INTEGER DEFAULT 0,
    last_analyzed TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Unique constraint for SEO scores (post bazlı)
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_seo_scores_user_post 
ON public.blog_seo_scores(user_id, post_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_seo_scores_user_id ON public.blog_seo_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_seo_scores_created_at ON public.blog_seo_scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_seo_scores_seo_score ON public.blog_seo_scores(seo_score DESC);

-- =================================================
-- ROW LEVEL SECURITY (BOTH TABLES)
-- =================================================

-- BLOG ANALYTICS RLS
ALTER TABLE public.blog_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blog_analytics"
ON public.blog_analytics FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own blog_analytics"
ON public.blog_analytics FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blog_analytics"
ON public.blog_analytics FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blog_analytics"
ON public.blog_analytics FOR DELETE
USING (auth.uid() = user_id);

-- BLOG SEO SCORES RLS
ALTER TABLE public.blog_seo_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blog_seo_scores"
ON public.blog_seo_scores FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own blog_seo_scores"
ON public.blog_seo_scores FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blog_seo_scores"
ON public.blog_seo_scores FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blog_seo_scores"
ON public.blog_seo_scores FOR DELETE
USING (auth.uid() = user_id);

-- =================================================
-- PERMISSIONS
-- =================================================
GRANT ALL ON public.blog_analytics TO authenticated;
GRANT ALL ON public.blog_analytics TO anon;
GRANT ALL ON public.blog_seo_scores TO authenticated;
GRANT ALL ON public.blog_seo_scores TO anon;

-- =================================================
-- BLOG SCHEDULES TABLE (Blog Schedule için)
-- =================================================
CREATE TABLE IF NOT EXISTS public.blog_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    keyword TEXT NOT NULL,
    assigned_date DATE NULL, -- Nullable çünkü draft keyword'ler henüz tarihi olmayabilir
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published')),
    notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Unique constraint - bir user aynı keyword'e birden fazla kez schedule edemesin (draft/scheduled fark etmeksızın)
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_schedules_user_keyword
ON public.blog_schedules(user_id, keyword);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_schedules_user_id ON public.blog_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_schedules_status ON public.blog_schedules(status);
CREATE INDEX IF NOT EXISTS idx_blog_schedules_assigned_date ON public.blog_schedules(assigned_date);
CREATE INDEX IF NOT EXISTS idx_blog_schedules_created_at ON public.blog_schedules(created_at DESC);

-- =================================================
-- BLOG SCHEDULES ROW LEVEL SECURITY (RLS)
-- =================================================

ALTER TABLE public.blog_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blog_schedules"
ON public.blog_schedules FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own blog_schedules"
ON public.blog_schedules FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blog_schedules"
ON public.blog_schedules FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blog_schedules"
ON public.blog_schedules FOR DELETE
USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON public.blog_schedules TO authenticated;
GRANT ALL ON public.blog_schedules TO anon;

-- Updated_at trigger for blog_schedules
CREATE TRIGGER handle_updated_at_blog_schedules
    BEFORE UPDATE ON public.blog_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =================================================
-- UPDATED_AT TRIGGER FUNCTIONS
-- =================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER handle_updated_at_blog_analytics
    BEFORE UPDATE ON public.blog_analytics
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_blog_seo_scores
    BEFORE UPDATE ON public.blog_seo_scores
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =================================================
-- MIGRATION FOR NEW FIELDS (Run this if you already have the table)
-- =================================================
ALTER TABLE public.blog_seo_scores ADD COLUMN IF NOT EXISTS readability_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE public.blog_seo_scores ADD COLUMN IF NOT EXISTS mobile_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE public.blog_seo_scores ADD COLUMN IF NOT EXISTS technical_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE public.blog_seo_scores ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;
ALTER TABLE public.blog_seo_scores ADD COLUMN IF NOT EXISTS reading_time INTEGER DEFAULT 0;
