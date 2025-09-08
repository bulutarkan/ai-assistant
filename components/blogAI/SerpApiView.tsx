import React, { useState } from 'react';
import { SerpApiService, SerpApiSearchParams, SerpApiResponse, SerpOrganicResult, COUNTRY_OPTIONS, LANGUAGE_OPTIONS } from '../../services/serpApiService';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Search, Loader2, ExternalLink, MapPin, Globe, Languages, TrendingUp } from 'lucide-react';

const SerpApiView: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [results, setResults] = useState<SerpApiResponse | null>(null);

  // Search parameters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('gb');
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  const serpApiService = new SerpApiService();

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsLoading(true);
    setError('');
    setResults(null);

    try {
      const searchParams: SerpApiSearchParams = {
        q: searchQuery.trim(),
        gl: selectedCountry,
        hl: selectedLanguage,
        num: 20, // Get top 20 results
      };

      console.log('🚀 Starting SerpApi search:', searchParams);
      const response = await serpApiService.searchKeyword(searchParams);
      setResults(response);
      console.log('✅ Search completed successfully');

    } catch (err: any) {
      console.error('❌ Search error details:', {
        message: err.message,
        name: err.name,
        stack: err.stack
      });

      // Show more detailed error messages
      if (err.message.includes('CORS')) {
        setError('CORS Error: Please check your internet connection and try again. If error persists, contact support.');
      } else if (err.message.includes('404')) {
        setError('API endpoint not found. Please try again or contact support.');
      } else if (err.message.includes('Load failed')) {
        setError('Connection failed. Please check your internet connection and try again.');
      } else {
        setError(`Search failed: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSearchQuery('');
    setSelectedCountry('gb');
    setSelectedLanguage('en');
    setResults(null);
    setError('');
  };

  const formatNumber = (num: number) => num.toLocaleString();

  const getCurrentCountryFlag = () => COUNTRY_OPTIONS.find(c => c.code === selectedCountry)?.flag || '🌍';
  const getCurrentLanguageFlag = () => LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.flag || '🇺🇸';

  return (
    <div className="h-full overflow-y-auto bg-dark-bg chat-scroll">
      {/* Header */}
      <div className="sticky top-0 bg-dark-bg border-b border-dark-border p-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">SerpApi Keyword Research</h1>
          <p className="text-text-secondary">Analyze Google search results with advanced location targeting</p>
        </div>
      </div>

      {/* Search Form */}
      <div className="p-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Keyword Search Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Query Input */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Search Query
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter keyword or search phrase..."
                className="w-full bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                disabled={isLoading}
              />
            </div>

            {/* Parameter Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Language Selector */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Languages className="w-4 h-4" />
                  Interface Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="appearance-none bg-dark-card border border-dark-border rounded-lg px-4 py-2.5 pr-8 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 min-w-[140px] hover:bg-dark-bg"
                  disabled={isLoading}
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.flag} {option.name} ({option.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Country Selector */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Target Country
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="appearance-none bg-dark-card border border-dark-border rounded-lg px-4 py-2.5 pr-8 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 min-w-[140px] hover:bg-dark-bg"
                  disabled={isLoading}
                >
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.flag} {option.name} ({option.code.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Current Settings Display */}
            <div className="bg-dark-card/50 border border-dark-border rounded-lg p-4">
              <div className="text-sm text-text-secondary mb-2">Current Search Settings:</div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1">
                  {getCurrentLanguageFlag()}
                  <strong>Language:</strong> {LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name} ({selectedLanguage})
                </span>
                <span className="flex items-center gap-1">
                  {getCurrentCountryFlag()}
                  <strong>Target Country:</strong> {COUNTRY_OPTIONS.find(c => c.code === selectedCountry)?.name} ({selectedCountry.toUpperCase()})
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4 border-t border-dark-border">
              <Button
                onClick={handleSearch}
                disabled={isLoading || !searchQuery.trim()}
                className="flex-1 justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-3 py-2 flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search Keyword
                  </>
                )}
              </Button>
              <Button onClick={handleReset} variant="outline" disabled={isLoading}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400">
                <span className="text-sm">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card className="mb-6">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Searching Google</h3>
                  <p className="text-text-secondary">Fetching search results from SerpApi...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Display */}
        {results && results.organic_results && results.organic_results.length > 0 && (
          <div className="space-y-6">
            {/* Search Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Search Results Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-text-primary">{results.organic_results.length}</div>
                    <div className="text-sm text-text-secondary">Results Found</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-text-primary">{results.search_metadata.processing_time_taken}s</div>
                    <div className="text-sm text-text-secondary">Processing Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-text-primary">{results.organic_results[0]?.position || 'N/A'}</div>
                    <div className="text-sm text-text-secondary">Top Position</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-text-primary">{(results.organic_results.reduce((sum, r) => sum + r.position, 0) / results.organic_results.length).toFixed(1)}</div>
                    <div className="text-sm text-text-secondary">Avg Position</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Organic Results */}
            <Card>
              <CardHeader>
                <CardTitle>Organic Search Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {results.organic_results.slice(0, 20).map((result: SerpOrganicResult, index: number) => (
                    <div key={index} className="border border-dark-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                      <div className="flex items-start gap-4">
                        {/* Position Badge */}
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            result.position === 1 ? 'bg-green-500 text-white' :
                            result.position <= 3 ? 'bg-blue-500 text-white' :
                            result.position <= 10 ? 'bg-yellow-500 text-black' :
                            'bg-gray-500 text-white'
                          }`}>
                            {result.position}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-text-primary mb-1">
                            <a
                              href={result.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary transition-colors flex items-center gap-1"
                            >
                              {result.title}
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          </h3>
                          <div className="text-sm text-green-400 mb-2 font-medium">
                            {result.displayed_link}
                          </div>
                          {result.snippet && (
                            <p className="text-text-secondary text-sm leading-relaxed">
                              {result.snippet}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Answer Box (if available) */}
            {results.answer_box && (
              <Card>
                <CardHeader>
                  <CardTitle>Featured Snippet / Answer Box</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="text-text-primary" dangerouslySetInnerHTML={{ __html: results.answer_box.answer || results.answer_box.snippet || 'Featured snippet available' }} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* No Results State */}
        {results && results.organic_results && results.organic_results.length === 0 && !isLoading && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <Search className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-text-primary mb-2">No Results Found</h3>
                <p className="text-text-secondary">Try adjusting your search parameters or keyword</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SerpApiView;
