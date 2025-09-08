import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { wordpressService } from '../../services/wordpressService';
import { analyzeKeywordUsage, KeywordAnalysisData, TreatmentGap, UKKeywordSuggestion } from '../../services/blogAIService';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import treatmentsData from '../../services/treatments.json';
import {
  Target,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Lightbulb,
  Search,
  BarChart3,
  FileText,
  Tag
} from 'lucide-react';

const KeywordAnalyzerView: React.FC = () => {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<KeywordAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [volumeFilter, setVolumeFilter] = useState<'all' | 'Low' | 'Medium' | 'High'>('all');
  const [intentFilter, setIntentFilter] = useState<'all' | 'Commercial' | 'Informational' | 'Transactional' | 'Navigational'>('all');
  const [competitionFilter, setCompetitionFilter] = useState<'all' | 'Low' | 'Medium' | 'High'>('all');

  const wordpressUrl = 'https://ckhealthturkey.com';

  const fetchAndAnalyzeData = async () => {
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      // Fetch blog data
      wordpressService.setBaseUrl(wordpressUrl);
      wordpressService.setTreatments(treatmentsData.treatments);
      const blogData = await wordpressService.getBlogData();

      setIsAnalyzing(true);

      // Get keyword analysis
      const keywordAnalysis = await analyzeKeywordUsage(blogData, treatmentsData.treatments);

      setIsAnalyzing(false);

      // Save to Supabase
      const { data, error: saveError } = await supabase
        .from('blog_keyword_analysis')
        .upsert({
          user_id: user.id,
          wordpress_url: wordpressUrl,
          total_posts_analyzed: keywordAnalysis.total_posts_analyzed,
          keyword_frequency_stats: keywordAnalysis.keyword_frequency_stats,
          treatment_gap_analysis: keywordAnalysis.treatment_gap_analysis,
          uk_keyword_suggestions: keywordAnalysis.uk_keyword_suggestions,
          content_gap_rate: keywordAnalysis.content_gap_rate,
          keyword_diversity_index: keywordAnalysis.keyword_diversity_index,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'user_id,wordpress_url'
        })
        .select()
        .single();

      if (saveError) throw saveError;

      setAnalysis(keywordAnalysis);
      setLastUpdated(new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }));

    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis');
      console.error('Keyword analysis error:', err);
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const loadExistingData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('blog_keyword_analysis')
        .select('*')
        .eq('user_id', user.id)
        .eq('wordpress_url', wordpressUrl)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setAnalysis({
          keyword_frequency_stats: data.keyword_frequency_stats,
          treatment_gap_analysis: data.treatment_gap_analysis,
          uk_keyword_suggestions: data.uk_keyword_suggestions,
          content_gap_rate: data.content_gap_rate,
          keyword_diversity_index: data.keyword_diversity_index,
          total_posts_analyzed: data.total_posts_analyzed
        });

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

  useEffect(() => {
    loadExistingData();
  }, [user]);

  const KeywordCard = ({ title, icon, value, subtitle, color, gradient, onClick }: {
    title: string;
    icon: React.ReactNode;
    value: string | number;
    subtitle?: string;
    color: string;
    gradient: string;
    onClick?: () => void;
  }) => (
    <Card
      className={`group hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 transform hover:rotate-1 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-text-secondary mb-1">{title}</p>
            <p className="text-3xl font-bold text-text-primary group-hover:text-white transition-colors duration-300 mb-2">{value}</p>
            {subtitle && (
              <p className="text-xs text-text-tertiary group-hover:text-text-secondary transition-colors duration-300">{subtitle}</p>
            )}
            <div className={`w-8 h-1 ${gradient} rounded-full mt-2`}></div>
          </div>
          <div className={`w-14 h-14 ${color} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-all duration-300`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const TreatmentGapCard = ({ gap }: { gap: TreatmentGap }) => {
    const gapColors = {
      high: 'text-red-400 border-red-500/20 bg-red-500/10',
      medium: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10',
      low: 'text-green-400 border-green-500/20 bg-green-500/10'
    };
    const gapLabels = {
      high: 'High Priority',
      medium: 'Medium Priority',
      low: 'Low Priority'
    };

    return (
      <Card className={`border ${gapColors[gap.gap_level]} hover:scale-105 transition-all duration-300`}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-text-primary">{gap.treatment}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${gapColors[gap.gap_level]}`}>
              {gapLabels[gap.gap_level]}
            </span>
          </div>
          <div className="text-sm text-text-secondary mb-2">
            Current content: {gap.current_post_count} posts
          </div>
          <div className="w-full h-2 bg-dark-bg rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                gap.gap_level === 'high' ? 'bg-red-500' :
                gap.gap_level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.max(10, (gap.current_post_count / 3) * 100)}%` }}
            ></div>
          </div>
          <div className="text-xs text-text-tertiary mt-1">
            Recommended: 3+ posts for good coverage
          </div>
        </CardContent>
      </Card>
    );
  };

  const KeywordSuggestionCard = ({ suggestion }: { suggestion: UKKeywordSuggestion }) => {
    const volumeColors = {
      High: 'text-green-400 bg-green-500/20',
      Medium: 'text-yellow-400 bg-yellow-500/20',
      Low: 'text-red-400 bg-red-500/20'
    };

    const competitionColors = {
      High: 'text-red-400',
      Medium: 'text-yellow-400',
      Low: 'text-green-400'
    };

    const intentColors = {
      Commercial: 'text-blue-400',
      Informational: 'text-green-400',
      Transactional: 'text-purple-400',
      Navigational: 'text-orange-400'
    };

    return (
      <Card className="hover:scale-105 transition-all duration-300 hover:shadow-lg">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-text-primary text-sm leading-tight">{suggestion.keyword}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${volumeColors[suggestion.estimated_search_volume]}`}>
              {suggestion.estimated_search_volume}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-text-secondary mb-3">
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              <span className={intentColors[suggestion.search_intent]}>{suggestion.search_intent}</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              <span className={competitionColors[suggestion.current_competition]}>{suggestion.current_competition}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-3 h-3 text-text-tertiary" />
              <span className="text-xs text-text-tertiary">
                Opportunity: <span className="text-primary font-medium">{suggestion.opportunity_score}/10</span>
              </span>
            </div>
          </div>

          {suggestion.suggested_content_angle && (
            <div className="mt-3 p-2 bg-primary/10 rounded text-xs text-primary">
              {suggestion.suggested_content_angle}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Filtered keywords for the modal
  const filteredKeywords = analysis?.uk_keyword_suggestions.filter(keyword => {
    const matchesSearch = searchTerm === '' ||
      keyword.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (keyword.suggested_content_angle && keyword.suggested_content_angle.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesVolume = volumeFilter === 'all' || keyword.estimated_search_volume === volumeFilter;
    const matchesIntent = intentFilter === 'all' || keyword.search_intent === intentFilter;
    const matchesCompetition = competitionFilter === 'all' || keyword.current_competition === competitionFilter;

    return matchesSearch && matchesVolume && matchesIntent && matchesCompetition;
  }) || [];

  // Copy all keywords to clipboard
  const copyAllKeywords = () => {
    const keywordsText = filteredKeywords
      .map(k => `${k.keyword} (${k.estimated_search_volume}) - ${k.search_intent}`)
      .join('\n');
    navigator.clipboard.writeText(keywordsText);
    // Could add a toast notification here
  };

  // Export to CSV
  const exportToCSV = () => {
    const csvContent = [
      'Keyword,Search Volume,Intent,Competition,Opportunity,Content Angle',
      ...filteredKeywords.map(k => `"${k.keyword}","${k.estimated_search_volume}","${k.search_intent}","${k.current_competition}","${k.opportunity_score}","${k.suggested_content_angle || ''}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'uk-keyword-suggestions.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="h-full overflow-y-auto bg-dark-bg chat-scroll">
      <style>{`
        /* Modal backdrop with smooth transition */
        [data-radix-dialog-overlay] {
          background-color: rgba(0, 0, 0, 0.85) !important;
          backdrop-filter: blur(8px) !important;
          transition: opacity 0.3s ease-out, backdrop-filter 0.3s ease-out;
        }

        /* Smooth modal entrance animation */
        [data-radix-dialog-content] {
          animation: modalFadeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* Staggered content animations */
        .modal-header {
          animation: slideDown 0.5s ease-out 0.1s both;
        }

        .modal-search {
          animation: slideDown 0.5s ease-out 0.2s both;
        }

        .modal-filters {
          animation: slideDown 0.5s ease-out 0.3s both;
        }

        .modal-results {
          animation: slideDown 0.5s ease-out 0.35s both;
        }

        .modal-keywords {
          animation: fadeInUp 0.6s ease-out 0.4s both;
        }

        .modal-footer {
          animation: slideUp 0.4s ease-out 0.5s both;
        }

        /* Individual animation keyframes */
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Keyword cards stagger animation */
        .keyword-card {
          animation: cardSlideIn 0.4s ease-out backwards;
        }

        .keyword-card:nth-child(1) { animation-delay: 0.45s; }
        .keyword-card:nth-child(2) { animation-delay: 0.47s; }
        .keyword-card:nth-child(3) { animation-delay: 0.49s; }
        .keyword-card:nth-child(4) { animation-delay: 0.51s; }
        .keyword-card:nth-child(5) { animation-delay: 0.53s; }
        .keyword-card:nth-child(6) { animation-delay: 0.55s; }
        .keyword-card:nth-child(7) { animation-delay: 0.57s; }
        .keyword-card:nth-child(8) { animation-delay: 0.59s; }
        .keyword-card:nth-child(9) { animation-delay: 0.61s; }

        @keyframes cardSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Enhanced button hover effects */
        .btn-primary:hover {
          transform: scale(1.05) translateY(-2px);
          box-shadow: 0 10px 25px rgba(99, 102, 241, 0.3);
        }

        .btn-outline:hover {
          transform: scale(1.02);
          border-color: rgb(99, 102, 241);
        }

        /* Custom scrollbar for modal content */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(238, 238, 238, 0.1);
          border-radius: 3px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.4);
          border-radius: 3px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.6);
        }
      `}</style>
      {/* Header */}
      <div className="sticky top-0 bg-dark-bg border-b border-dark-border p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Keyword Analyzer</h1>
          <p className="text-text-secondary">Analyze keyword usage and discover UK market opportunities</p>
        </div>

        <Button
          onClick={fetchAndAnalyzeData}
          disabled={isLoading || isAnalyzing}
          variant="secondary"
          className="flex items-center gap-2"
        >
          {(isLoading || isAnalyzing) ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{isAnalyzing ? 'AI Analyzing...' : 'Fetching Data...'}</span>
            </>
          ) : (
            <>
              <Target className="w-4 h-4" />
              <span>Analyze Keywords</span>
            </>
          )}
        </Button>
      </div>

      <div className="p-6">
        {!analysis ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <Tag className="w-16 h-16 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-text-primary mb-2">Keyword Analyzer</h3>
              <p className="text-text-secondary mb-6">Get comprehensive keyword analysis and UK market insights</p>
              {lastUpdated ? (
                <p className="text-sm text-text-tertiary">Last updated: {lastUpdated}</p>
              ) : (
                <p className="text-sm text-text-tertiary">Click "Analyze Keywords" to start</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KeywordCard
                title="Posts Analyzed"
                value={analysis.total_posts_analyzed}
                subtitle="Total blog posts"
                icon={<FileText className="w-6 h-6 text-blue-400" />}
                color="bg-blue-500/20"
                gradient="bg-gradient-to-r from-blue-500 to-purple-500"
              />

              <KeywordCard
                title="Content Gap Rate"
                value={`${analysis.content_gap_rate}%`}
                subtitle="Treatments needing content"
                icon={<AlertCircle className="w-6 h-6 text-red-400" />}
                color="bg-red-500/20"
                gradient="bg-gradient-to-r from-red-500 to-orange-500"
              />

              <KeywordCard
                title="Keyword Diversity"
                value={analysis.keyword_diversity_index}
                subtitle="Unique keywords diversity"
                icon={<TrendingUp className="w-6 h-6 text-green-400" />}
                color="bg-green-500/20"
                gradient="bg-gradient-to-r from-green-500 to-emerald-500"
              />

              <KeywordCard
                title="UK Suggestions"
                value={analysis.uk_keyword_suggestions.length}
                subtitle="Click to view all keywords"
                icon={<Search className="w-6 h-6 text-purple-400" />}
                color="bg-purple-500/20"
                gradient="bg-gradient-to-r from-purple-500 to-pink-500"
                onClick={() => setIsModalOpen(true)}
              />
            </div>

            {/* Treatment Gaps */}
            {analysis.treatment_gap_analysis.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Treatment Content Gaps ({analysis.treatment_gap_analysis.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.treatment_gap_analysis.slice(0, 6).map((gap, index) => (
                      <TreatmentGapCard key={index} gap={gap} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* UK Keyword Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  UK Market Keyword Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analysis.uk_keyword_suggestions.slice(0, 9).map((suggestion, index) => (
                    <KeywordSuggestionCard key={index} suggestion={suggestion} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Keyword Frequency Stats */}
            {analysis.keyword_frequency_stats && Object.keys(analysis.keyword_frequency_stats).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Top Keywords by Frequency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(analysis.keyword_frequency_stats)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 12)
                      .map(([keyword, frequency]) => (
                        <div key={keyword} className="flex justify-between items-center p-3 bg-dark-bg rounded-lg">
                          <span className="text-sm text-text-primary truncate">{keyword}</span>
                          <span className="text-sm text-text-secondary font-medium">{frequency}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {error && (
          <Card className="mt-6 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400">
                <span className="text-sm">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* All Keywords Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden bg-dark-card border border-dark-border shadow-2xl">
          <DialogHeader className="modal-header">
            <DialogTitle className="text-2xl font-bold">
              All ({filteredKeywords.length}) UK Keyword Suggestions
            </DialogTitle>
            <DialogDescription>
              Complete list of UK-specific keyword opportunities based on treatments needing content.
            </DialogDescription>
          </DialogHeader>

          {/* Filters and Controls */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center justify-between modal-search">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search keywords or content angles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-dark-card border border-dark-border rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2 flex-wrap modal-filters">
                <div className="relative">
                  <select
                    value={volumeFilter}
                    onChange={(e) => setVolumeFilter(e.target.value as any)}
                    className="appearance-none bg-dark-card border border-dark-border rounded-lg px-4 py-2.5 pr-8 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 min-w-[140px] hover:bg-dark-bg"
                  >
                    <option value="all">All Volumes</option>
                    <option value="High">🔥 High Volume</option>
                    <option value="Medium">📊 Medium Volume</option>
                    <option value="Low">📉 Low Volume</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <svg className="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={intentFilter}
                    onChange={(e) => setIntentFilter(e.target.value as any)}
                    className="appearance-none bg-dark-card border border-dark-border rounded-lg px-4 py-2.5 pr-8 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 min-w-[140px] hover:bg-dark-bg"
                  >
                    <option value="all">All Intents</option>
                    <option value="Commercial">💰 Commercial</option>
                    <option value="Informational">📚 Informational</option>
                    <option value="Transactional">🛒 Transactional</option>
                    <option value="Navigational">🧭 Navigational</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <svg className="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={competitionFilter}
                    onChange={(e) => setCompetitionFilter(e.target.value as any)}
                    className="appearance-none bg-dark-card border border-dark-border rounded-lg px-4 py-2.5 pr-8 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 min-w-[140px] hover:bg-dark-bg"
                  >
                    <option value="all">All Competition</option>
                    <option value="High">⚠️ High Competition</option>
                    <option value="Medium">⚖️ Medium Competition</option>
                    <option value="Low">✅ Low Competition</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <svg className="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyAllKeywords}>
                  <FileText className="w-4 h-4 mr-2" />
                  Copy All
                </Button>
                <Button size="sm" variant="outline" onClick={exportToCSV}>
                  📥 Export CSV
                </Button>
              </div>
            </div>

            {/* Results Count */}
            <p className="text-sm text-text-secondary modal-results">
              Showing {filteredKeywords.length} keywords {analysis && `(of ${analysis.uk_keyword_suggestions.length} total)`}
            </p>
          </div>

          {/* Keywords Grid */}
          <div className="max-h-96 overflow-y-auto chat-scroll custom-scrollbar modal-keywords">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredKeywords.map((suggestion, index) => (
                <div key={index} className="keyword-card">
                  <KeywordSuggestionCard suggestion={suggestion} />
                </div>
              ))}
            </div>
            {filteredKeywords.length === 0 && (
              <div className="text-center py-12 text-text-secondary">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No keywords match your current filters</p>
                <p className="text-xs mt-2">Try adjusting your search or filters</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-dark-border modal-footer">
            <p className="text-sm text-text-secondary">
              💡 Click and drag to select keywords for easy copying
            </p>
            <Button onClick={() => setIsModalOpen(false)} variant="outline" className="btn-outline">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KeywordAnalyzerView;
