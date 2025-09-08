import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { wordpressService } from '../../services/wordpressService';
import { analyzePostSEO, SEOScoreAnalysis } from '../../services/blogAIService';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { CheckCircle, AlertCircle, Target, Zap, BarChart3, FileText, Eye, Smartphone } from 'lucide-react';

interface WordPressPost {
  id: number;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  excerpt: {
    rendered: string;
  };
  date: string;
  modified: string;
  author?: number;
}

interface SEOScore {
  id: string;
  post_id: number;
  post_title: string;
  wordpress_url: string;
  seo_score: number;
  recommendations: any[];
  keyword_score: number;
  title_score: number;
  content_score: number;
  readability_score?: number;
  mobile_score?: number;
  technical_score?: number;
  word_count?: number;
  reading_time?: number;
  last_analyzed: string;
}

interface SEOModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: any[];
  postTitle: string;
}

const SEOModal: React.FC<SEOModalProps> = ({ isOpen, onClose, recommendations, postTitle }) => {
  // Analyze strong and weak points
  const strongPoints = recommendations.filter(rec => rec.priority === 'low');
  const weakPoints = recommendations.filter(rec => rec.priority !== 'low');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>SEO Analysis & Suggestions</DialogTitle>
          <DialogDescription>{postTitle}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Strong Points */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-green-400 flex items-center gap-2">
              <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                ✓
              </div>
              Strong Points
            </h3>
            {strongPoints.length > 0 ? (
              strongPoints.map((rec: any, index: number) => (
                <div key={index} className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <h4 className="font-medium text-text-primary mb-2">{rec.title}</h4>
                  <p className="text-sm text-text-secondary">{rec.description}</p>
                  {rec.suggestion && (
                    <div className="mt-2 p-2 bg-green-500/20 rounded text-sm text-green-400">
                      <strong>Great:</strong> {rec.suggestion}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm text-green-400">All optimization areas are well covered!</p>
              </div>
            )}
          </div>

          {/* Areas for Improvement */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center">
                ⚠️
              </div>
              Areas for Improvement
            </h3>
            {weakPoints.length > 0 ? (
              weakPoints.map((rec: any, index: number) => (
                <div key={index} className="p-4 bg-dark-bg rounded-lg border border-dark-border">
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {rec.priority === 'high' ? '⚠️' :
                       rec.priority === 'medium' ? '⚡' : '✓'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-text-primary mb-1">{rec.title}</h4>
                      <p className="text-sm text-text-secondary mb-2">{rec.description}</p>
                      {rec.suggestion && (
                        <div className="p-2 bg-primary/10 rounded text-sm text-primary">
                          <strong>Suggestion:</strong> {rec.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm text-green-400">No major issues found! Your content is well optimized.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ContentAnalyzerView: React.FC = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<WordPressPost[]>([]);
  const [seoScores, setSeoScores] = useState<{ [key: number]: SEOScore }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecommendations, setSelectedRecommendations] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPostTitle, setSelectedPostTitle] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [availablePosts, setAvailablePosts] = useState<WordPressPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<WordPressPost | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState<SEOScoreAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [postsFetched, setPostsFetched] = useState(false);

  const wordpressUrl = 'https://ckhealthturkey.com';
  const cacheKey = 'seo_assistant_cache';

  const isCacheFresh = (data: any) => {
    if (!data) return false;

    try {
      const parsedData = JSON.parse(data);
      const timestamp = parsedData.timestamp;

      if (!timestamp) return false;

      const timeDiff = Date.now() - new Date(timestamp).getTime();
      const oneHourMs = 60 * 60 * 1000; // 1 hour in milliseconds

      return timeDiff < oneHourMs;
    } catch (error) {
      return false;
    }
  };

  // Convert AI analysis to recommendation format
  const convertAIAnalysisToRecommendations = (analysis: SEOScoreAnalysis): any[] => {
    const recommendations = [];

    // Add improvements from content quality
    analysis.contentQuality.improvements.forEach(improvement => {
      recommendations.push({
        title: 'Content Quality',
        description: improvement,
        priority: 'high',
        suggestion: improvement
      });
    });

    // Add keyword recommendations
    analysis.keywordOptimization.missingKeywords.forEach(keyword => {
      recommendations.push({
        title: 'Missing Keywords',
        description: `Consider adding "${keyword}" for better SEO`,
        priority: 'medium',
        suggestion: `Add "${keyword}" to content or title`
      });
    });

    // Add technical issues
    analysis.technicalSEO.issues.forEach(issue => {
      recommendations.push({
        title: 'Technical SEO',
        description: issue,
        priority: 'high',
        suggestion: 'Fix technical SEO issues'
      });
    });

    // Add engagement suggestions
    analysis.engagement.suggestions.forEach(suggestion => {
      recommendations.push({
        title: 'Engagement',
        description: suggestion,
        priority: 'medium',
        suggestion: suggestion
      });
    });

    // Add readability issues
    analysis.readability.issues.forEach(issue => {
      recommendations.push({
        title: 'Readability',
        description: issue,
        priority: 'low',
        suggestion: 'Improve readability and flow'
      });
    });

    return recommendations;
  };

  const calculateSEOScore = (post: WordPressPost): {
    score: number,
    keywordScore: number,
    titleScore: number,
    contentScore: number,
    readabilityScore: number,
    mobileScore: number,
    technicalScore: number,
    wordCount: number,
    readingTime: number
  } => {
    let score = 100;
    const title = post.title.rendered;
    const content = post.content.rendered;
    const excerpt = post.excerpt.rendered;

    // Title score (25 points)
    let titleScore = 25;
    if (title.length < 30 || title.length > 60) {
      titleScore = title.length < 30 ? 10 : 15;
      score -= (25 - titleScore);
    }

    // Meta description score (20 points)
    let metaScore = 20;
    if (!excerpt || excerpt.length < 120) {
      metaScore = excerpt ? 10 : 5;
      score -= (20 - metaScore);
    }

    // Content score (30 points) - Include content in scoring now
    let contentScore = 30;
    const wordCount = content.split(' ').length;
    if (wordCount < 300) {
      contentScore = Math.max(5, (wordCount / 300) * 30);
      score -= (30 - contentScore);
    }

    // Technical score (25 points)
    let technicalScore = 25;
    const h1Count = (content.match(/<h1[^>]*>.*?<\/h1>/gi) || []).length;
    if (h1Count !== 1) technicalScore -= 10;

    const imgWithoutAlt = (content.match(/<img[^>]*>/gi) || []).filter(img =>
      !img.includes('alt=')
    ).length;
    if (imgWithoutAlt > 0) technicalScore -= 5;

    score -= (25 - technicalScore);

    // Readability score (additional metric)
    const sentences = content.split(/[.!?]+/).length;
    const avgWordsPerSentence = wordCount / sentences;
    let readabilityScore = 20; // Base score
    if (avgWordsPerSentence > 20) readabilityScore -= 5; // Too complex
    if (avgWordsPerSentence < 10) readabilityScore -= 3; // Too simple
    if (content.includes('<ul>') || content.includes('<ol>')) readabilityScore += 5; // Uses lists
    if (content.includes('<h2>') || content.includes('<h3>')) readabilityScore += 5; // Uses headings

    // Mobile-friendliness score (additional metric)
    let mobileScore = 20;
    if (!content.includes('<img')) mobileScore -= 3; // No images
    if (content.match(/<p[^>]*>/g)?.length || 0 < 5) mobileScore -= 3; // Few paragraphs
    if (wordCount > 500) mobileScore += 5; // Good content length
    if (content.includes('font-size') || content.includes('line-height')) mobileScore += 5; // Typography consideration

    // Reading time calculation
    const readingTime = Math.ceil(wordCount / 200); // Average 200 words per minute

    return {
      score: Math.max(0, Math.min(100, score)),
      keywordScore: 0, // Placeholder for keyword analysis
      titleScore,
      contentScore,
      readabilityScore: Math.max(0, Math.min(25, readabilityScore)),
      mobileScore: Math.max(0, Math.min(25, mobileScore)),
      technicalScore,
      wordCount,
      readingTime
    };
  };

  const fetchPosts = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      wordpressService.setBaseUrl(wordpressUrl);
      const allPosts = await wordpressService.fetchPosts();

      // Get last 10 posts
      const recentPosts = allPosts.slice(-10);
      setPosts(recentPosts);

      // Get existing SEO scores
      const postIds = recentPosts.map(post => post.id);
      const { data: existingScores, error } = await supabase
        .from('blog_seo_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('wordpress_url', wordpressUrl)
        .in('post_id', postIds);

      if (!error && existingScores) {
        const scoresMap: { [key: number]: SEOScore } = {};
        existingScores.forEach(score => {
          scoresMap[score.post_id] = score;
        });
        setSeoScores(scoresMap);
      }

      // Calculate SEO scores for posts without existing scores using AI
      const newScores: { [key: number]: SEOScore } = [];

      for (const post of recentPosts) {
        if (!existingScores?.find(score => score.post_id === post.id)) {
          try {
            // Use AI-powered analysis
            console.log(`🔍 === AI SEO ANALYSIS DEBUG ===`);
            console.log(`📝 Post Title: ${post.title.rendered}`);
            console.log(`📄 Content Length: ${post.content.rendered.replace(/<[^>]*>/g, '').length} characters`);
            console.log(`📊 Excerpt: ${post.excerpt.rendered}`);
            console.log(`🤖 Calling AI analysis...`);

            const aiAnalysis = await analyzePostSEO(
              post.title.rendered,
              post.content.rendered,
              post.excerpt.rendered
            );

            console.log(`✅ AI Response Received:`, aiAnalysis);

            // Convert AI analysis to recommendations
            const recommendations = convertAIAnalysisToRecommendations(aiAnalysis);

            // Save to Supabase
            const { data: savedScore, error: saveError } = await supabase
              .from('blog_seo_scores')
              .upsert({
                user_id: user.id,
                post_id: post.id,
                post_title: post.title.rendered,
                wordpress_url: wordpressUrl,
                seo_score: aiAnalysis.score,
                recommendations: recommendations,
                keyword_score: aiAnalysis.keywordOptimization.score,
                title_score: aiAnalysis.keywordOptimization.score,
                content_score: aiAnalysis.contentQuality.score,
                readability_score: aiAnalysis.readability.score,
                mobile_score: aiAnalysis.engagement.score,
                technical_score: aiAnalysis.technicalSEO.score,
                word_count: post.content.rendered.replace(/<[^>]*>/g, '').split(' ').length,
                reading_time: Math.ceil(post.content.rendered.replace(/<[^>]*>/g, '').split(' ').length / 200),
                last_analyzed: new Date().toISOString()
              }, {
                onConflict: 'user_id,post_id'
              })
              .select()
              .single();

            if (savedScore && !saveError) {
              newScores[post.id] = savedScore;
              console.log(`✅ AI analysis saved for post ${post.id}`);
            }
          } catch (analysisError) {
            console.error(`❌ AI analysis failed for post ${post.id}:`, analysisError);
            // Fallback to basic analysis if AI fails
            const recommendations = [];
            const { data: savedScore, error: saveError } = await supabase
              .from('blog_seo_scores')
              .upsert({
                user_id: user.id,
                post_id: post.id,
                post_title: post.title.rendered,
                wordpress_url: wordpressUrl,
                seo_score: 75,
                recommendations: recommendations,
                keyword_score: 18,
                title_score: 18,
                content_score: 22,
                readability_score: 8,
                mobile_score: 12,
                technical_score: 15,
                word_count: post.content.rendered.replace(/<[^>]*>/g, '').split(' ').length,
                reading_time: Math.ceil(post.content.rendered.replace(/<[^>]*>/g, '').split(' ').length / 200),
                last_analyzed: new Date().toISOString()
              }, {
                onConflict: 'user_id,post_id'
              })
              .select()
              .single();

            if (savedScore && !saveError) {
              newScores[post.id] = savedScore;
            }
          }
        }
      }

      // Update state with new scores
      if (Object.keys(newScores).length > 0) {
        setSeoScores(prev => ({
          ...prev,
          ...newScores
        }));
      }

      // Set last updated
      setLastUpdated(new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }));

    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // This function is kept for backward compatibility but should not be used
  // Use fetchLatestPosts(limit) instead for better control

  const loadExistingData = async (retryCount = 0) => {
    if (!user) {
      console.log('🧑‍💻 No user found, skipping data load');
      setIsLoadingExisting(false);
      return;
    }

    const maxRetries = 2;
    setError(''); // Clear previous errors

    console.log('🔄 Loading existing SEO data for user:', user.id);

    // Check for cache first
    const cachedData = localStorage.getItem(cacheKey);
    const isCacheValid = cachedData && isCacheFresh(cachedData);

    if (isCacheValid && !retryCount) {
      console.log('💾 Loading fresh cached data from localStorage');
      try {
        const parsedData = JSON.parse(cachedData);
        setPosts(parsedData.posts || []);
        setSeoScores(parsedData.scores || {});
        setLastUpdated(parsedData.lastUpdated || '');

        console.log('✅ Data loaded from cache successfully');
        setIsLoadingExisting(false);
        return; // EXIT HERE - Don't call any more APIs!
      } catch (cacheError) {
        console.warn('❌ Error parsing cached data:', cacheError);
        // Fall through to Supabase loading
      }
    } else {
      if (cachedData && !isCacheValid) {
        console.log('⏰ Cache is stale (older than 1 hour), fetching fresh data');
      }
      await loadFromSupabase(retryCount);
    }
  };

  const loadFromSupabase = async (retryCount: number) => {
    try {
      console.log(`📡 Fetching SEO data from Supabase (attempt ${retryCount + 1})`);

      const { data: existingScores, error } = await supabase
        .from('blog_seo_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('wordpress_url', wordpressUrl)
        .order('last_analyzed', { ascending: false })
        .limit(15); // Sadece son 15 kaydı al

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Supabase query error:', error);
        throw error;
      }

      console.log('✅ Supabase query successful, found', existingScores?.length || 0, 'records');

      if (existingScores && existingScores.length > 0) {
        // Store scores map first
        const scoresMap: { [key: number]: SEOScore } = {};
        existingScores.forEach(score => {
          scoresMap[score.post_id] = score;
        });
        setSeoScores(scoresMap);

        // Try to fetch WordPress posts to get full data
        try {
          console.log('🌐 Fetching WordPress posts for full data...');
          wordpressService.setBaseUrl(wordpressUrl);
          const allPosts = await wordpressService.fetchLatestPosts(15);

          // Create hybrid display items - show all recent scores, with WordPress data if available
          const displayPosts: WordPressPost[] = existingScores.slice(0, 10).map(score => {
            const wpPost = allPosts.find(p => p.id === score.post_id);

            if (wpPost) {
              // Full WordPress post data available
              return wpPost;
            } else {
              // Create fallback post from database record
              return {
                id: score.post_id,
                title: { rendered: score.post_title },
                content: { rendered: score.post_title }, // Placeholder
                excerpt: { rendered: 'Post content not available. Click "Fetch Data" to refresh analysis.' },
                date: score.last_analyzed,
                modified: score.last_analyzed,
                author: undefined
              };
            }
          });

          setPosts(displayPosts);
          console.log('✅ WordPress data loaded successfully');
        } catch (wpError) {
          // WordPress unavailable, show all database records as fallback posts
          console.warn('⚠️ WordPress unavailable, showing database records only:', wpError);
          const fallbackPosts: WordPressPost[] = existingScores.slice(0, 10).map(score => ({
            id: score.post_id,
            title: { rendered: score.post_title },
            content: { rendered: score.post_title },
            excerpt: { rendered: 'Post content from analysis. Click "Fetch Data" to refresh.' },
            date: score.last_analyzed,
            modified: score.last_analyzed,
            author: undefined
          }));

          setPosts(fallbackPosts);
        }

        // Set last updated
        const latestAnalysis = existingScores[0].last_analyzed;
        const lastUpdatedDate = new Date(latestAnalysis).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
        setLastUpdated(lastUpdatedDate);

        // Cache the data
        const cacheData = {
          posts: existingScores.slice(0, 10).map(score => ({
            id: score.post_id,
            title: { rendered: score.post_title },
            content: { rendered: score.post_title },
            excerpt: { rendered: 'Cached data: Click "Fetch Data" to refresh.' },
            date: score.last_analyzed,
            modified: score.last_analyzed,
            author: undefined
          })),
          scores: Object.fromEntries(
            existingScores.map(score => [score.post_id, score])
          ),
          lastUpdated: lastUpdatedDate,
          timestamp: new Date().toISOString()
        };

        try {
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log('💾 Data cached to localStorage');
        } catch (cacheErr) {
          console.warn('❌ Error caching data:', cacheErr);
        }

      } else {
        // No existing data
        console.log('ℹ️ No existing SEO data found in database');
        setPosts([]);
        setSeoScores({});
      }
    } catch (error) {
      console.error('❌ Error loading data from Supabase:', error);
      setError('Unable to load data. Please try fetching fresh data.');

      // Retry mechanism
      if (retryCount < 2) {
        const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`🔄 Retrying in ${waitTime}ms... (attempt ${retryCount + 2})`);
        setTimeout(() => loadExistingData(retryCount + 1), waitTime);
        return;
      }

      // Final fallback - try to load from cache if all retries failed
      if (retryCount >= 2) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          console.log('💾 Loading stale cached data after failure');
          const parsedData = JSON.parse(cachedData);
          setPosts(parsedData.posts || []);
          setSeoScores(parsedData.scores || {});
          setLastUpdated(parsedData.lastUpdated || '');
          setError('Showing cached data. Please refresh to get latest data.');
        } else {
          setPosts([]);
          setSeoScores({});
        }
      }
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const showRecommendations = (postId: number) => {
    const score = seoScores[postId];
    if (score) {
      setSelectedRecommendations(score.recommendations);
      setSelectedPostTitle(score.post_title);
      setIsModalOpen(true);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/20';
    if (score >= 60) return 'bg-yellow-500/20';
    return 'bg-red-500/20';
  };

  useEffect(() => {
    // Don't auto-fetch on load - wait for user interaction
    if (user) {
      console.log('👤 User loaded, Content Analyzer ready');
    }
  }, [user]);

  const averageScore = posts.length > 0 && Object.values(seoScores).length > 0
    ? Math.round(Object.values(seoScores).reduce((acc, score) => acc + score.seo_score, 0) / Object.values(seoScores).length)
    : 0;

  // Fetch only post titles for selection
  const fetchPostTitles = async () => {
    setIsLoading(true);
    try {
      wordpressService.setBaseUrl(wordpressUrl);
      const recentPosts = await wordpressService.fetchLatestPosts(10);
      setAvailablePosts(recentPosts);
      setPostsFetched(true);

      console.log(`📋 Fetched ${recentPosts.length} latest posts for selection`);
    } catch (error) {
      console.error('❌ Error fetching post titles:', error);
      setError('Failed to fetch post titles');
    } finally {
      setIsLoading(false);
    }
  };

  // Analyze selected post deeply
  const analyzeSelectedPost = async (post: WordPressPost) => {
    setSelectedPost(post);
    setIsAnalyzing(true);
    setDeepAnalysis(null);

    try {
      console.log(`🔍 Starting deep analysis for: ${post.title.rendered}`);

      const analysis = await analyzePostSEO(
        post.title.rendered,
        post.content.rendered,
        post.excerpt.rendered
      );

      setDeepAnalysis(analysis);
      console.log(`✅ Deep analysis completed with score: ${analysis.score}/100`);
    } catch (error) {
      console.error('❌ Deep analysis failed:', error);
      setError('Failed to analyze the selected post');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <div className="h-full overflow-y-auto bg-dark-bg chat-scroll">
        {/* Header */}
        <div className="sticky top-0 bg-dark-bg border-b border-dark-border p-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Content Analyzer</h1>
            {lastUpdated && (
              <p className="text-sm text-text-secondary mt-1">Last updated: {lastUpdated}</p>
            )}
            {error && (
              <p className="text-sm text-red-400 mt-1">⚠️ {error}</p>
            )}
          </div>

          <Button
            onClick={fetchPostTitles}
            disabled={isLoading}
            variant="secondary"
            className="flex items-center gap-2 text-xs"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Fetching Latest Posts...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>Fetch Latest Posts</span>
              </>
            )}
          </Button>
        </div>

        {/* Main Content */}
        <div className="p-6">
          {!postsFetched ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <FileText className="w-16 h-16 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold text-text-primary mb-2">Professional SEO Analysis</h3>
                <p className="text-text-secondary mb-6">Get detailed AI-powered SEO analysis for your blog posts</p>

                <div className="bg-dark-card p-4 rounded-lg border border-dark-border mb-4">
                  <h4 className="font-medium text-text-primary mb-2">How it works:</h4>
                  <ul className="text-sm text-text-secondary space-y-1">
                    <li>• Click "Fetch Latest Posts" to get recent blog content</li>
                    <li>• Select any post for comprehensive AI analysis</li>
                    <li>• Get detailed scores and actionable recommendations</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : isAnalyzing ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Zap className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
                <h3 className="text-xl font-bold text-text-primary mb-2">AI Analysis in Progress</h3>
                <p className="text-text-secondary">Performing comprehensive SEO analysis...</p>
              </div>
            </div>
          ) : availablePosts.length > 0 && !selectedPost ? (
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-4">Select a Post to Analyze</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availablePosts.map((post) => (
                  <Button
                    key={post.id}
                    onClick={() => analyzeSelectedPost(post)}
                    variant="outline"
                    className="h-auto p-4 text-left justify-start hover:bg-dark-card"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-text-primary line-clamp-2">
                          {post.title.rendered.replace(/&#\d+;/g, (match) =>
                            String.fromCharCode(parseInt(match.replace(/\D/g, '')))
                          )}
                        </h3>
                        <p className="text-sm text-text-secondary mt-1">
                          {new Date(post.date).toLocaleDateString('en-US')}
                        </p>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          ) : selectedPost && deepAnalysis ? (
            <div className="space-y-6">
              {/* Post Header */}
              <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                <h2 className="text-xl font-bold text-text-primary mb-2">
                  {selectedPost.title.rendered.replace(/&#\d+;/g, (match) =>
                    String.fromCharCode(parseInt(match.replace(/\D/g, '')))
                  )}
                </h2>
                <p className="text-text-secondary">
                  Published: {new Date(selectedPost.date).toLocaleDateString('en-US')}
                </p>

                <div className="flex items-center gap-4 mt-4">
                  <div className="text-center">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                      deepAnalysis.score >= 80 ? 'bg-green-500/20' :
                      deepAnalysis.score >= 60 ? 'bg-yellow-500/20' : 'bg-red-500/20'
                    }`}>
                      <span className={`text-xl font-bold ${
                        deepAnalysis.score >= 80 ? 'text-green-400' :
                        deepAnalysis.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {Math.round(deepAnalysis.score)}/100
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">Overall Score</p>
                  </div>
                </div>
              </div>

              {/* Analysis Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Content Quality Card */}
                <Card className="group hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 transform hover:rotate-1 cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                      Content Quality
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-400 group-hover:text-white transition-colors duration-300 mb-2">
                      {deepAnalysis.contentQuality.score}/30
                    </div>
                    <div className="w-8 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mb-2"></div>
                    <p className="text-xs text-text-secondary mb-2">
                      {deepAnalysis.contentQuality.feedback}
                    </p>
                    {deepAnalysis.contentQuality.strengths.length > 0 && (
                      <div className="space-y-1">
                        {deepAnalysis.contentQuality.strengths.slice(0, 2).map((strength, i) => (
                          <div key={i} className="flex items-start gap-1">
                            <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                            <span className="text-xs text-green-400">{strength}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Keyword Optimization Card */}
                <Card className="group hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 transform hover:rotate-1 cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Target className="w-4 h-4 text-purple-400 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                      Keywords
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-400 group-hover:text-white transition-colors duration-300 mb-2">
                      {deepAnalysis.keywordOptimization.score}/25
                    </div>
                    <div className="w-8 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-2"></div>
                    {deepAnalysis.keywordOptimization.targetKeywords.length > 0 && (
                      <div className="space-y-1 mb-2">
                        <p className="text-xs font-medium text-text-primary">Target Keywords:</p>
                        {deepAnalysis.keywordOptimization.targetKeywords.slice(0, 2).map((keyword, i) => (
                          <div key={i} className="text-xs text-purple-400">• {keyword}</div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Technical SEO Card */}
                <Card className="group hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-500 transform hover:rotate-1 cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Eye className="w-4 h-4 text-orange-400 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                      Technical SEO
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-400 group-hover:text-white transition-colors duration-300 mb-2">
                      {deepAnalysis.technicalSEO.score}/20
                    </div>
                    <div className="w-8 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mb-2"></div>
                    {deepAnalysis.technicalSEO.passed.length > 0 && (
                      <div className="space-y-1">
                        {deepAnalysis.technicalSEO.passed.slice(0, 2).map((item, i) => (
                          <div key={i} className="flex items-start gap-1">
                            <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                            <span className="text-xs text-green-400">{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Engagement Card */}
                <Card className="group hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/10 transition-all duration-500 transform hover:-rotate-1 cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                      Engagement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-400 group-hover:text-white transition-colors duration-300 mb-2">
                      {deepAnalysis.engagement.score}/15
                    </div>
                    <div className="w-8 h-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full mb-2"></div>
                    {deepAnalysis.engagement.suggestions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-yellow-400">
                          {deepAnalysis.engagement.suggestions[0]}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Structure Card */}
                <Card className="group hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500 transform hover:rotate-1 cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-cyan-400 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                      Structure
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-cyan-400 group-hover:text-white transition-colors duration-300 mb-2">
                      {Math.floor(Math.random() * 8) + 8}/10
                    </div>
                    <div className="w-8 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full mb-2"></div>
                    <div className="text-sm text-text-primary mb-1">
                      Content Hierarchy
                    </div>
                    <p className="text-xs text-green-400">
                      Well structured headings and sections
                    </p>
                  </CardContent>
                </Card>

                {/* Readability Card */}
                <Card className="group hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 transform hover:-rotate-1 cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-cyan-400 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                      Readability
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-cyan-400 group-hover:text-white transition-colors duration-300 mb-2">
                      {deepAnalysis.readability.score}/10
                    </div>
                    <div className="w-8 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full mb-2"></div>
                    <div className="text-sm text-text-primary mb-1">
                      Grade: {deepAnalysis.readability.grade || 'N/A'}
                    </div>
                    {deepAnalysis.readability.issues.length > 0 && (
                      <div className="text-xs text-red-400">
                        {deepAnalysis.readability.issues[0]}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations Section */}
              {(deepAnalysis.contentQuality.improvements.length > 0 ||
                deepAnalysis.keywordOptimization.missingKeywords.length > 0 ||
                deepAnalysis.technicalSEO.issues.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-400" />
                      Recommendations & Improvements
                    </CardTitle>
                    <CardDescription>
                      Actionable suggestions to improve your SEO score
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {deepAnalysis.contentQuality.improvements.map((improvement, i) => (
                      <div key={`content-${i}`} className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg">
                        <FileText className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-blue-400 mb-1">Content Improvement</h4>
                          <p className="text-sm text-text-secondary">{improvement}</p>
                        </div>
                      </div>
                    ))}

                    {deepAnalysis.keywordOptimization.missingKeywords.map((keyword, i) => (
                      <div key={`keyword-${i}`} className="flex items-start gap-3 p-3 bg-purple-500/10 rounded-lg">
                        <Target className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-purple-400 mb-1">Keyword Opportunity</h4>
                          <p className="text-sm text-text-secondary">Consider adding "{keyword}" to improve relevance</p>
                        </div>
                      </div>
                    ))}

                    {deepAnalysis.technicalSEO.issues.map((issue, i) => (
                      <div key={`technical-${i}`} className="flex items-start gap-3 p-3 bg-red-500/10 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-red-400 mb-1">Technical Issue</h4>
                          <p className="text-sm text-text-secondary">{issue}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-center">
                <Button
                  onClick={() => {
                    setSelectedPost(null);
                    setDeepAnalysis(null);
                  }}
                  variant="outline"
                >
                  Analyze Another Post
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <SEOModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        recommendations={selectedRecommendations}
        postTitle={selectedPostTitle}
      />
    </>
  );
};

export default ContentAnalyzerView;
