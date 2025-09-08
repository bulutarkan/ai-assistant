import React, { useState, useEffect } from 'react';
import { SearchConsoleService, SearchConsoleQueryData, calculateSearchConsoleInsights } from '../../services/searchConsoleService';
import { generateBlogResponseStream } from '../../services/blogAIService';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import treatmentsData from '../../services/treatments.json';
import {
  Search,
  TrendingUp,
  Eye,
  MousePointer,
  Target,
  Lightbulb,
  FileText,
  RefreshCw,
  LogIn,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { createGoogleAuthService } from '../../services/googleAuthService';

interface ContentSuggestion {
  topic: string;
  keywords: string[];
  treatmentMatch: string;
  reasoning: string;
}

const SearchConsoleView: React.FC = () => {
  const { user } = useAuth();
  const [searchData, setSearchData] = useState<SearchConsoleQueryData[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [contentSuggestions, setContentSuggestions] = useState<ContentSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [error, setError] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [expandedRecommendations, setExpandedRecommendations] = useState<Set<number>>(new Set());

  const siteUrl = 'https://ckhealthturkey.com';
  const searchConsoleService = new SearchConsoleService(siteUrl);

  // Toggle recommendation expand/collapse
  const toggleRecommendation = (index: number) => {
    const newExpanded = new Set(expandedRecommendations);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRecommendations(newExpanded);
  };

  // Check authentication status
  useEffect(() => {
    const checkAuth = () => {
      try {
        const authService = createGoogleAuthService();
        if (authService) {
          const isAuth = authService.isAuthenticated();
          setIsAuthenticated(isAuth);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setError(`Authentication setup failed: ${error.message}`);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const authenticateWithGoogle = () => {
    try {
      console.log('🔐 Starting Google OAuth authentication...');
      const authService = createGoogleAuthService();
      console.log('✅ Google Auth service created');
      const authUrl = authService.generateAuthUrl();
      console.log('🔗 Generated auth URL:', authUrl.substring(0, 50) + '...');
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('❌ Authentication error:', error);
      setError(`Failed to start Google authentication: ${error.message}`);
    }
  };

  const fetchSearchConsoleData = async () => {
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      // In a real implementation, you would get the access token from secure storage
      // For now, we'll use a placeholder - you need to set up OAuth2 flow
      const accessToken = localStorage.getItem('searchConsoleToken');

      if (!accessToken) {
        throw new Error('Google Search Console not connected. Please authenticate first.');
      }

      searchConsoleService.setAccessToken(accessToken);
      await searchConsoleService.authenticate();

      const data = await searchConsoleService.getLastMonthData();
      setSearchData(data);

      // Calculate insights
      const insightsData = calculateSearchConsoleInsights(data, treatmentsData.treatments);
      setInsights(insightsData);

    } catch (err: any) {
      setError(err.message || 'Failed to fetch Search Console data');
      console.error('Search Console error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateContentIdeas = async () => {
    if (!insights || !searchData.length) return;

    setIsAIGenerating(true);

    try {
      const prompt = `
You are a content strategist for CK Health Turkey. Analyze these search queries and suggest blog content ideas that align with our medical tourism services.

SEARCH DATA SUMMARY:
- Total queries analyzed: ${searchData.length}
- Top performing queries: ${insights.topPerformingQueries.slice(0, 5).map(q => q.keys[0]).join(', ')}
- Treatments we offer: ${treatmentsData.treatments.slice(0, 10).join(', ')}
- Matching treatments found: ${insights.treatmentMatches.slice(0, 3).map(m => m.treatment).join(', ')}

Please suggest 5 specific blog post ideas based on:
1. High-performing search queries that match our services
2. Opportunity queries with high impressions but low CTR
3. Treatment gaps where we could create content

Format your response as JSON:
[
  {
    "topic": "Blog post title",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "treatmentMatch": "Matching treatment service",
    "reasoning": "Why this topic would work"
  }
]

Focus on medical tourism, cosmetic surgery, dental treatments, and wellness services. Make suggestions actionable for a medical tourism blog.`;

      let fullResponse = '';
      for await (const chunk of generateBlogResponseStream({
        prompt,
        user: user,
        wordpressUrl: siteUrl,
      })) {
        fullResponse += chunk;
      }

      // Parse the JSON response
      try {
        const cleanResponse = fullResponse.replace(/```json\s*|\s*```/g, '').trim();
        const suggestions = JSON.parse(cleanResponse);
        setContentSuggestions(suggestions);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        // Fallback to manual suggestions
        generateFallbackSuggestions();
      }

    } catch (err) {
      console.error('AI generation error:', err);
      generateFallbackSuggestions();
    } finally {
      setIsAIGenerating(false);
    }
  };

  const generateFallbackSuggestions = () => {
    const suggestions: ContentSuggestion[] = [
      {
        topic: "Complete Guide to Dental Implants in Turkey 2025",
        keywords: ["dental implants turkey", "dental implants cost turkey"],
        treatmentMatch: "Dental Implants in Turkey",
        reasoning: "High search volume for this core service with good CTR"
      },
      {
        topic: "Hair Transplant Success Stories: Before and After",
        keywords: ["hair transplant turkey", "hair transplant results"],
        treatmentMatch: "Hair Transplant in Turkey",
        reasoning: "Popular service with consistent search interest"
      },
      {
        topic: "Rhinoplasty Recovery: What to Expect After Nose Surgery",
        keywords: ["rhinoplasty recovery time", "nose surgery recovery"],
        treatmentMatch: "Rhinoplasty in Turkey",
        reasoning: "High-intent queries about recovery process"
      }
    ];
    setContentSuggestions(suggestions);
  };

  useEffect(() => {
    // Check if we have stored data
    const storedData = localStorage.getItem('searchConsoleData');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        setSearchData(parsed.data || []);
        setInsights(parsed.insights || null);
      } catch (err) {
        console.error('Failed to load stored data:', err);
      }
    }
  }, []);

  // Save data to localStorage when it changes
  useEffect(() => {
    if (searchData.length > 0 || insights) {
      localStorage.setItem('searchConsoleData', JSON.stringify({
        data: searchData,
        insights: insights
      }));
    }
  }, [searchData, insights]);

  const MetricCard = ({ title, value, icon, color, gradient }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    gradient: string;
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="group hover:scale-105 hover:shadow-2xl transition-all duration-500 transform hover:scale-105 hover:rotate-1 cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-text-secondary mb-1">{title}</p>
              <p className="text-3xl font-bold text-text-primary group-hover:text-white transition-colors duration-300">{value}</p>
              <div className={`w-8 h-1 ${gradient} rounded-full mt-2`}></div>
            </div>
            <div className={`w-14 h-14 ${color} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-all duration-300`}>
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const KeywordRow = ({ data, showCTR = true }: { data: SearchConsoleQueryData; showCTR?: boolean }) => (
    <div className="flex justify-between items-center p-3 bg-dark-bg rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{data.keys[0]}</p>
      </div>
      <div className="flex items-center gap-4 text-sm text-text-secondary">
        <div className="text-center">
          <p className="font-medium text-text-primary">{data.impressions.toLocaleString()}</p>
          <p className="text-xs">Impressions</p>
        </div>
        <div className="text-center">
          <p className="font-medium text-text-primary">{data.clicks}</p>
          <p className="text-xs">Clicks</p>
        </div>
        {showCTR && (
          <div className="text-center">
            <p className="font-medium text-text-primary">{(data.ctr * 100).toFixed(2)}%</p>
            <p className="text-xs">CTR</p>
          </div>
        )}
        <div className="text-center">
          <p className="font-medium text-text-primary">{data.position.toFixed(1)}</p>
          <p className="text-xs">Position</p>
        </div>
      </div>
    </div>
  );

  const totalClicks = searchData.reduce((sum, row) => sum + row.clicks, 0);
  const totalImpressions = searchData.reduce((sum, row) => sum + row.impressions, 0);
  const avgCTR = searchData.length > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgPosition = searchData.length > 0 ? searchData.reduce((sum, row) => sum + row.position, 0) / searchData.length : 0;

  return (
    <div className="h-full overflow-y-auto bg-dark-bg chat-scroll">
      {/* Header */}
        <div className="sticky top-0 bg-dark-bg border-b border-dark-border p-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Search Console</h1>
            <p className="text-text-secondary">Analyze your site's search performance</p>
          </div>

        <div className="flex items-center gap-3">
          {!isAuthenticated && (
            <Button
              onClick={authenticateWithGoogle}
              variant="default"
              className="justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-3 py-2 flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Connect Google</span>
            </Button>
          )}

          {isAuthenticated && (
            <Button
              onClick={fetchSearchConsoleData}
              disabled={isLoading}
              variant="secondary"
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Fetching Data...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Fetch Data</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {error && (
          <Card className="mb-6 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400">
                <span className="text-sm">{error}</span>
              </div>
              <p className="text-sm text-text-secondary mt-2">
                To use Search Console, you need to:
                <br />1. Set up Google Search Console for your site
                <br />2. Create OAuth2 credentials
                <br />3. Configure the access token in your application
              </p>
            </CardContent>
          </Card>
        )}

        {!searchData.length && !isLoading && !error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">Search Console</h3>
              <p className="text-text-secondary mb-4">Click "Fetch Data" to pull search analytics from Google</p>
              <Button onClick={fetchSearchConsoleData} variant="secondary">
                Get Started
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Total Queries"
                value={searchData.length.toLocaleString()}
                icon={<Search className="w-6 h-6 text-blue-400" />}
                color="bg-blue-500/20"
                gradient="bg-gradient-to-r from-blue-500 to-purple-500"
              />
              <MetricCard
                title="Total Clicks"
                value={totalClicks.toLocaleString()}
                icon={<MousePointer className="w-6 h-6 text-green-400" />}
                color="bg-green-500/20"
                gradient="bg-gradient-to-r from-green-500 to-emerald-500"
              />
              <MetricCard
                title="Total Impressions"
                value={totalImpressions.toLocaleString()}
                icon={<Eye className="w-6 h-6 text-purple-400" />}
                color="bg-purple-500/20"
                gradient="bg-gradient-to-r from-purple-500 to-pink-500"
              />
              <MetricCard
                title="Average CTR"
                value={`${avgCTR.toFixed(2)}%`}
                icon={<Target className="w-6 h-6 text-orange-400" />}
                color="bg-orange-500/20"
                gradient="bg-gradient-to-r from-orange-500 to-red-500"
              />
            </div>

            {/* Top Keywords */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Top Performing Keywords
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {searchData
                    .sort((a, b) => b.clicks - a.clicks)
                    .slice(0, 15)
                    .map((row, index) => (
                      <KeywordRow key={index} data={row} />
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            {insights && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    AI Insights & Treatment Matching
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Treatment Matches */}
                  <div>
                    <h4 className="font-semibold text-text-primary mb-3">Treatment Service Matches</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {insights.treatmentMatches.slice(0, 6).map((match: any, index: number) => (
                        <div key={index} className="p-4 bg-dark-bg rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-text-primary">{match.treatment}</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              match.severity === 'high' ? 'bg-green-500/20 text-green-400' :
                              match.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {match.matchPercentage}% match
                            </span>
                          </div>
                          <div className="text-xs text-text-secondary">
                            Keywords: {match.keywords.slice(0, 3).join(', ')}
                            {match.keywords.length > 3 && '...'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h4 className="font-semibold text-text-primary mb-3">Detailed Recommendations</h4>
                    <div className="space-y-3">
                      {insights.recommendations.map((rec: any, index: number) => {
                        const isExpanded = expandedRecommendations.has(index);
                        return (
                          <div key={index} className="border border-dark-border rounded-lg p-4 bg-dark-bg">
                            <div className="flex items-start gap-3 mb-3">
                              <Lightbulb className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <h5 className="font-medium text-text-primary mb-1">{rec.title}</h5>
                                <p className="text-sm text-text-secondary mb-3">{rec.description}</p>
                                <div className="text-sm text-blue-400 font-medium mb-3">💡 {rec.action}</div>

                                {/* Show Examples Button */}
                                <div className="flex justify-center">
                                  <Button
                                    onClick={() => toggleRecommendation(index)}
                                    variant="secondary"
                                    size="sm"
                                    className="flex items-center gap-2"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <span>Hide Examples</span>
                                        <ChevronUp className="w-4 h-4" />
                                      </>
                                    ) : (
                                      <>
                                        <span>Show Examples</span>
                                        <ChevronDown className="w-4 h-4" />
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Expandable Items Section */}
                            {isExpanded && (
                              <div className="mt-4 pt-3 border-t border-dark-border">
                                <div className="space-y-2">
                                  <div className="text-xs text-text-secondary font-medium uppercase tracking-wide">Examples:</div>
                                  <div className="space-y-2">
                                    {rec.items.map((item: any, itemIndex: number) => (
                                      <div key={itemIndex} className="flex items-center justify-between text-sm p-2 bg-dark-card rounded border border-dark-border/50">
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-text-primary truncate">
                                            {typeof item === 'string' ? item :
                                             item.keys ? item.keys[0] :
                                             item.treatment || item.keys?.[0] || 'Unknown'}
                                          </div>
                                          {item.treatment && item.keywords && (
                                            <div className="text-xs text-text-secondary mt-1">
                                              Keywords: {item.keywords.join(', ')}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-text-secondary ml-3">
                                          {item.clicks !== undefined && (
                                            <div className="text-center">
                                              <div className="font-medium text-text-primary">{item.clicks.toLocaleString()}</div>
                                              <div className="text-text-secondary">Clicks</div>
                                            </div>
                                          )}
                                          {item.impressions !== undefined && (
                                            <div className="text-center">
                                              <div className="font-medium text-text-primary">{item.impressions.toLocaleString()}</div>
                                              <div className="text-text-secondary">Impressions</div>
                                            </div>
                                          )}
                                          {item.ctr !== undefined && item.ctr > 0 && (
                                            <div className="text-center">
                                              <div className="font-medium text-text-primary">{(item.ctr * 100).toFixed(1)}%</div>
                                              <div className="text-text-secondary">CTR</div>
                                            </div>
                                          )}
                                          {item.position !== undefined && item.position > 0 && (
                                            <div className="text-center">
                                              <div className="font-medium text-text-primary">{item.position.toFixed(1)}</div>
                                              <div className="text-text-secondary">Position</div>
                                            </div>
                                          )}
                                          {item.matchPercentage !== undefined && (
                                            <div className="text-center">
                                              <div className={`px-2 py-1 rounded text-xs font-medium ${
                                                item.severity === 'high' ? 'bg-green-500/20 text-green-400' :
                                                item.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-gray-500/20 text-gray-400'
                                              }`}>
                                                {item.matchPercentage}%
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Content Ideas Button */}
                  <div className="pt-4 border-t border-dark-border">
                    <Button
                      onClick={generateContentIdeas}
                      disabled={isAIGenerating}
                      variant="secondary"
                      className="w-full"
                    >
                      {isAIGenerating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                          Generating Content Ideas...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          Content Ideas
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Content Suggestions */}
            {contentSuggestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    AI Content Ideas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {contentSuggestions.map((suggestion, index) => (
                      <div key={index} className="p-4 bg-dark-bg rounded-lg border border-dark-border">
                        <h4 className="font-semibold text-text-primary mb-2">{suggestion.topic}</h4>
                        <div className="text-sm text-text-secondary mb-2">
                          <strong>Keywords:</strong> {suggestion.keywords.join(', ')}
                        </div>
                        <div className="text-sm text-text-secondary mb-2">
                          <strong>Service Match:</strong> {suggestion.treatmentMatch}
                        </div>
                        <div className="text-sm text-text-primary">
                          <strong>Why this works:</strong> {suggestion.reasoning}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchConsoleView;
