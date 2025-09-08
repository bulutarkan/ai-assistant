import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { wordpressService } from '../../services/wordpressService';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { analyzeDashboardMetrics } from '../../services/blogAIService';

interface BlogAnalytics {
  id: string;
  wordpress_url: string;
  total_posts: number;
  total_keywords: number;
  top_keywords: any[];
  treatment_coverage: any[];
  category_stats: any[];
  last_updated: string;
  publication_trend: any[];
  avg_words_per_post: number;
  growth_rate: number;
  keyword_diversity_score: number;
  monthly_posts: any[];
}

const DashboardView: React.FC = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<BlogAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const wordpressUrl = 'https://ckhealthturkey.com';

  const fetchData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Fetch data from WordPress
      wordpressService.setBaseUrl(wordpressUrl);
      const blogData = await wordpressService.getBlogData();

      // Calculate analytics
      const totalPosts = blogData.posts.length;
      const totalKeywords = blogData.keywords.length;

      // Get top keywords with frequency
      const keywordFreq: { [key: string]: number } = {};
      blogData.keywords.forEach(keyword => {
        keywordFreq[keyword] = 0;
      });

      blogData.posts.forEach(post => {
        const strippedContent = wordpressService.stripHtmlTags(post.content.rendered).toLowerCase();
        const content = `${post.title.rendered} ${strippedContent}`;
        blogData.keywords.forEach(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
          const matches = content.match(regex);
          if (matches) {
            keywordFreq[keyword] += matches.length;
          }
        });
      });

      const topKeywords = Object.entries(keywordFreq)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20)
        .map(([keyword, freq]) => ({ keyword, frequency: freq }));

      // Category statistics
      const categoryCount: { [key: string]: number } = {};
      blogData.posts.forEach(post => {
        post.categories.forEach(catId => {
          const category = blogData.categories.find(c => c.id === catId);
          if (category) {
            categoryCount[category.name] = (categoryCount[category.name] || 0) + 1;
          }
        });
      });

      const categoryStats = Object.entries(categoryCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Treatment coverage - only include treatments with matches
      const treatmentCoverage = blogData.treatmentMatches
        .filter(match => match.frequency > 0)
        .map(match => ({
          treatment: match.treatment,
          postCount: match.frequency,
          percentage: Math.round((match.frequency / totalPosts) * 100)
        }));

      // Calculate new metrics
      // Publication trend (last 30 days vs 31-90 days)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const recentPosts = blogData.posts.filter(post =>
        new Date(post.date) >= thirtyDaysAgo
      ).length;

      const olderPosts = blogData.posts.filter(post =>
        new Date(post.date) >= ninetyDaysAgo && new Date(post.date) < thirtyDaysAgo
      ).length;

      const publicationTrend = [
        { period: 'Last 30 days', posts: recentPosts },
        { period: '31-90 days ago', posts: olderPosts }
      ];

      // Average words per post
      const totalWords = blogData.posts.reduce((acc, post) => {
        const strippedContent = wordpressService.stripHtmlTags(post.content.rendered);
        return acc + strippedContent.split(/\s+/).filter(word => word.length > 0).length;
      }, 0);

      const avgWordsPerPost = Math.round(totalWords / totalPosts);

      // Growth rate (simple calculation based on date distribution)
      const growthRate = recentPosts > 0 ? Math.round(((recentPosts - olderPosts / 2) / (olderPosts / 2 || 1)) * 100) : 0;

      // Keyword diversity score (unique keywords usage %)
      const allWords = new Set();
      blogData.posts.forEach(post => {
        const strippedContent = wordpressService.stripHtmlTags(post.content.rendered).toLowerCase();
        const content = `${post.title.rendered} ${strippedContent}`;
        const words = content.match(/\b\w+\b/g) || [];
        words.forEach(word => {
          // Filter out HTML tags and short words
          if (word.length > 3 && !word.match(/^(strong|class|span|nbsp|block|section|list|level)$/i)) {
            allWords.add(word);
          }
        });
      });

      const keywordDiversityScore = Math.min(100, Math.round((blogData.keywords.length / allWords.size) * 100));

      // Monthly posts chart data (last 12 months)
      const monthlyPosts = [];
      const currentDate = new Date();

        for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 1);

        const postsCount = blogData.posts.filter(post => {
          const postDate = new Date(post.date);
          return postDate >= monthDate && postDate < nextMonth;
        }).length;

        monthlyPosts.push({
          month: monthDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
          posts: postsCount
        });
      }

      // Save to Supabase
      const { data, error } = await supabase
        .from('blog_analytics')
        .upsert({
          user_id: user.id,
          wordpress_url: wordpressUrl,
          total_posts: totalPosts,
          total_keywords: totalKeywords,
          top_keywords: topKeywords,
          treatment_coverage: treatmentCoverage,
          category_stats: categoryStats,
          avg_words_per_post: avgWordsPerPost,
          growth_rate: growthRate,
          keyword_diversity_score: keywordDiversityScore,
          publication_trend: publicationTrend,
          monthly_posts: monthlyPosts,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'user_id,wordpress_url'
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state with all metrics
      setAnalytics({
        id: data?.id || '',
        wordpress_url: wordpressUrl,
        total_posts: totalPosts,
        total_keywords: totalKeywords,
        top_keywords: topKeywords,
        treatment_coverage: treatmentCoverage,
        category_stats: categoryStats,
        last_updated: new Date().toISOString(),
        publication_trend: publicationTrend,
        avg_words_per_post: avgWordsPerPost,
        growth_rate: growthRate,
        keyword_diversity_score: keywordDiversityScore,
        monthly_posts: monthlyPosts
      });

      setLastUpdated(new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }));

    } catch (error) {
      console.error('Error fetching blog data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadExistingData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('blog_analytics')
        .select('*')
        .eq('user_id', user.id)
        .eq('wordpress_url', wordpressUrl)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setAnalytics(data);
        setLastUpdated(new Date(data.last_updated).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }));
      }
    } catch (error) {
      console.error('Error loading existing data:', error);
    }
  };

  const handleAskAI = async () => {
    if (!analytics) return;

    setIsAnalyzing(true);
    try {
      const analysisResult = await analyzeDashboardMetrics(analytics);
      setAiAnalysis(analysisResult);
    } catch (error) {
      console.error('AI analysis error:', error);
      setAiAnalysis('An error occurred during AI analysis. Please try again later.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    loadExistingData();
  }, [user]);

  return (
    <div className="h-full overflow-y-auto bg-dark-bg chat-scroll">
      {/* Header with Fetch Button */}
      <div className="sticky top-0 bg-dark-bg border-b border-dark-border p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Blog Dashboard</h1>
          {lastUpdated && (
            <p className="text-sm text-text-secondary mt-1">Last updated: {lastUpdated}</p>
          )}
        </div>

        <Button
          onClick={fetchData}
          disabled={isLoading}
          variant="secondary"
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>Fetching Data...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Fetch Data</span>
            </>
          )}
        </Button>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {!analytics ? (
          <div className="h-full">
            {isLoading ? (
              <div className="space-y-6 animate-pulse">
                {/* Skeleton Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="bg-gradient-to-br from-dark-card to-dark-card/60 p-6 rounded-xl border border-dark-border">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-dark-border/50 rounded w-24"></div>
                          <div className="h-8 bg-dark-border/30 rounded w-16"></div>
                          <div className="h-1 bg-dark-border/20 rounded w-12"></div>
                        </div>
                        <div className="w-14 h-14 bg-dark-border/40 rounded-xl"></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Skeleton for second row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="bg-gradient-to-br from-dark-card to-dark-card/60 p-6 rounded-xl border border-dark-border">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-dark-border/50 rounded w-32"></div>
                          <div className="h-8 bg-dark-border/30 rounded w-12"></div>
                          <div className="h-1 bg-dark-border/20 rounded w-16"></div>
                        </div>
                        <div className="w-14 h-14 bg-dark-border/40 rounded-xl"></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Skeleton for content sections */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-dark-card to-dark-card/60 p-6 rounded-lg border border-dark-border">
                    <div className="h-6 bg-dark-border/40 rounded w-48 mb-4"></div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {[...Array(8)].map((_, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-dark-border/20 rounded-lg">
                          <div className="h-4 bg-dark-border/40 rounded w-16"></div>
                          <div className="h-3 bg-dark-border/30 rounded w-8"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-dark-card to-dark-card/60 p-6 rounded-lg border border-dark-border">
                    <div className="h-6 bg-dark-border/40 rounded w-40 mb-4"></div>
                    <div className="space-y-3">
                      {[...Array(5)].map((_, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <div className="h-4 bg-dark-border/50 rounded w-32"></div>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-dark-border/20 rounded-full overflow-hidden">
                              <div className="h-full bg-dark-border/30 rounded-full w-3/4"></div>
                            </div>
                            <div className="h-4 bg-dark-border/40 rounded w-8"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-text-primary mb-2">Blog Dashboard</h3>
                  <p className="text-text-secondary mb-4">Click "Fetch Data" to pull data from your WordPress site</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="group bg-gradient-to-br from-dark-card to-dark-card/80 p-6 rounded-xl border border-dark-border hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 transform hover:scale-105 hover:rotate-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Total Posts</p>
                    <p className="text-3xl font-bold text-text-primary group-hover:text-white transition-colors duration-300">{analytics.total_posts}</p>
                    <div className="w-8 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mt-2"></div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center group-hover:from-blue-500/40 group-hover:to-purple-500/40 transition-all duration-300">
                    <svg className="w-7 h-7 text-blue-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group bg-gradient-to-br from-dark-card to-dark-card/80 p-6 rounded-xl border border-dark-border hover:border-green-500/50 hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-500 transform hover:scale-105 hover:-rotate-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Total Keywords</p>
                    <p className="text-3xl font-bold text-text-primary group-hover:text-white transition-colors duration-300">{analytics.total_keywords}</p>
                    <div className="w-8 h-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mt-2"></div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center group-hover:from-green-500/40 group-hover:to-emerald-500/40 transition-all duration-300">
                    <svg className="w-7 h-7 text-green-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group bg-gradient-to-br from-dark-card to-dark-card/80 p-6 rounded-xl border border-dark-border hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 transform hover:scale-105 hover:rotate-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Category Count</p>
                    <p className="text-3xl font-bold text-text-primary group-hover:text-white transition-colors duration-300">{analytics.category_stats.length}</p>
                    <div className="w-8 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mt-2"></div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center group-hover:from-purple-500/40 group-hover:to-pink-500/40 transition-all duration-300">
                    <svg className="w-7 h-7 text-purple-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group bg-gradient-to-br from-dark-card to-dark-card/80 p-6 rounded-xl border border-dark-border hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-500 transform hover:scale-105 hover:-rotate-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Treatment Coverage</p>
                    <p className="text-3xl font-bold text-text-primary group-hover:text-white transition-colors duration-300">{analytics.treatment_coverage.length}</p>
                    <div className="w-8 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mt-2"></div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl flex items-center justify-center group-hover:from-orange-500/40 group-hover:to-red-500/40 transition-all duration-300">
                    <svg className="w-7 h-7 text-orange-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* New Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="group bg-gradient-to-br from-dark-card to-dark-card/80 p-6 rounded-xl border border-dark-border hover:border-teal-500/50 hover:shadow-2xl hover:shadow-teal-500/10 transition-all duration-500 transform hover:scale-105 hover:rotate-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Avg Words per Post</p>
                    <p className="text-3xl font-bold text-text-primary group-hover:text-white transition-colors duration-300">{analytics.avg_words_per_post}</p>
                    <div className="w-8 h-1 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full mt-2"></div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center group-hover:from-teal-500/40 group-hover:to-cyan-500/40 transition-all duration-300">
                    <svg className="w-7 h-7 text-teal-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group bg-gradient-to-br from-dark-card to-dark-card/80 p-6 rounded-xl border border-dark-border hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 transform hover:scale-105 hover:-rotate-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Growth Rate</p>
                    <p className="text-3xl font-bold text-text-primary group-hover:text-white transition-colors duration-300">{analytics.growth_rate > 0 ? '+' : ''}{analytics.growth_rate}%</p>
                    <div className="w-8 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mt-2"></div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl flex items-center justify-center group-hover:from-indigo-500/40 group-hover:to-purple-500/40 transition-all duration-300">
                    <svg className="w-7 h-7 text-indigo-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group bg-gradient-to-br from-dark-card to-dark-card/80 p-6 rounded-xl border border-dark-border hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500 transform hover:scale-105 hover:rotate-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Keyword Diversity</p>
                    <p className="text-3xl font-bold text-text-primary group-hover:text-white transition-colors duration-300">{analytics.keyword_diversity_score}</p>
                    <div className="w-8 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full mt-2"></div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl flex items-center justify-center group-hover:from-cyan-500/40 group-hover:to-blue-500/40 transition-all duration-300">
                    <svg className="w-7 h-7 text-cyan-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group bg-gradient-to-br from-dark-card to-dark-card/80 p-6 rounded-xl border border-dark-border hover:border-lime-500/50 hover:shadow-2xl hover:shadow-lime-500/10 transition-all duration-500 transform hover:scale-105 hover:-rotate-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Recent Activity</p>
                    <p className="text-3xl font-bold text-text-primary group-hover:text-white transition-colors duration-300">{analytics.publication_trend[0]?.posts || 0}</p>
                    <p className="text-xs text-text-tertiary">Last 30 days</p>
                    <div className="w-8 h-1 bg-gradient-to-r from-lime-500 to-green-500 rounded-full mt-2"></div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-lime-500/20 to-green-500/20 rounded-xl flex items-center justify-center group-hover:from-lime-500/40 group-hover:to-green-500/40 transition-all duration-300">
                    <svg className="w-7 h-7 text-lime-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Keywords */}
            <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Most Used Keywords</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {analytics.top_keywords.slice(0, 12).map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-dark-bg rounded-lg">
                    <span className="text-sm text-text-primary truncate">{item.keyword}</span>
                    <span className="text-xs text-text-secondary ml-2">{item.frequency}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Stats */}
            <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Category Distribution</h3>
              <div className="space-y-3">
                {analytics.category_stats.slice(0, 10).map((category: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-text-primary">{category.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-dark-bg rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(category.count / analytics.total_posts) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-text-secondary w-12 text-right">{category.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Posts Chart */}
            {analytics.monthly_posts && (
              <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Monthly Content Publishing</h3>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {analytics.monthly_posts.map((month: any, index: number) => (
                    <div key={index} className="text-center p-3 bg-dark-bg rounded-lg">
                      <div className="text-lg font-bold text-text-primary">{month.posts}</div>
                      <div className="text-xs text-text-secondary">{month.month}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Treatment Coverage */}
            <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Treatment Coverage</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analytics.treatment_coverage.map((treatment: any, index: number) => (
                  <div key={index} className="p-4 bg-dark-bg rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-text-primary">{treatment.treatment}</span>
                      <span className="text-sm text-text-secondary">{treatment.postCount} posts</span>
                    </div>
                    <div className="w-full h-2 bg-dark-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${treatment.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-text-tertiary mt-1">{treatment.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ask AI Button */}
            <div className="mt-8 flex justify-center">
              <button
                onClick={handleAskAI}
                disabled={!analytics || isAnalyzing}
                className="flex items-center gap-3 px-6 py-3 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg border border-gray-600 hover:border-gray-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>AI Analyzing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Ask AI for Insights</span>
                  </>
                )}
              </button>
            </div>

            {/* AI Analysis Modal */}
            {aiAnalysis && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out">
                <div className="bg-dark-card border border-dark-border rounded-xl max-w-6xl w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in fade-in duration-300">
                  <div className="p-8 border-b border-dark-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-text-primary">Dashboard AI Analysis</h3>
                    </div>
                    <Button
                      onClick={() => setAiAnalysis(null)}
                      variant="ghost"
                      size="sm"
                      className="text-text-secondary hover:text-text-primary hover:bg-dark-bg rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                    >
                      ✕
                    </Button>
                  </div>
                  <div className="p-8">
                    <div className="prose prose-invert max-w-none text-text-primary">
                      <div
                        className="whitespace-pre-wrap font-sans text-base leading-relaxed [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-6 [&_h1]:text-text-primary [&_h1]:border-b [&_h1]:border-dark-border [&_h1]:pb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-4 [&_h2]:text-text-primary [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mb-3 [&_h3]:text-text-primary [&_p]:mb-4 [&_ul]:mb-6 [&_li]:mb-2 [&_li]:ml-4 [&_strong]:font-bold [&_strong]:text-text-primary [&_code]:bg-dark-bg [&_code]:px-2 [&_code]:py-1 [&_code]:rounded [&_code]:text-sm [&_code]:text-primary [&_code]:border [&_code]:border-dark-border [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:text-text-secondary [&_blockquote]:bg-dark-bg/50 [&_blockquote]:py-4 [&_blockquote]:pr-4"
                        dangerouslySetInnerHTML={{
                          __html: aiAnalysis?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/^# (.+)$/gm, '<h1>$1</h1>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^- (.+)$/gm, '<li>$1</li>').replace(/\n\n/g, '</p><p>').replace(/(<li>.+<\/li>)/gs, '<ul>$1</ul>') || ''
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
