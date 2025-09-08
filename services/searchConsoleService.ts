export interface SearchConsoleQueryData {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleData {
  rows: SearchConsoleQueryData[];
  responseAggregationType: string;
}

export interface TreatmentMatch {
  treatment: string;
  keywords: string[];
  matchPercentage: number;
  severity: 'high' | 'medium' | 'low';
}

export interface DetailedRecommendation {
  type: string;
  title: string;
  description: string;
  items: (SearchConsoleQueryData | TreatmentMatch)[];
  action: string;
}

export interface SearchConsoleInsights {
  topPerformingQueries: SearchConsoleQueryData[];
  opportunityQueries: SearchConsoleQueryData[];
  treatmentMatches: TreatmentMatch[];
  recommendations: DetailedRecommendation[];
}

export class SearchConsoleService {
  private baseUrl = 'https://www.googleapis.com/webmasters/v3/sites';
  private accessToken: string | null = null;

  constructor(siteUrl: string, accessToken?: string) {
    this.siteUrl = siteUrl;
    if (accessToken) {
      this.accessToken = accessToken;
    }
  }

  private siteUrl: string;

  async authenticate(): Promise<void> {
    if (!this.accessToken) {
      // For server-side implementations, you'd typically use OAuth2
      // For client-side, you might need to use a proxy or server-side implementation
      throw new Error('Access token not provided. Please set up Google OAuth2 authentication.');
    }

    // Validate token (you might want to add token refresh logic here)
    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(this.siteUrl)}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Search Console authentication error:', error);
      throw error;
    }
  }

  async fetchSearchAnalytics(
    startDate: string,
    endDate: string,
    dimensions: string[] = ['query'],
    rowLimit: number = 1000
  ): Promise<SearchConsoleData> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    const requestBody = {
      startDate,
      endDate,
      dimensions,
      rowLimit,
      startRow: 0
    };

    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(this.siteUrl)}/searchAnalytics/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data: SearchConsoleData = await response.json();
      return data;
    } catch (error) {
      console.error('Search Console API error:', error);
      throw error;
    }
  }

  async getLastMonthData(): Promise<SearchConsoleQueryData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const data = await this.fetchSearchAnalytics(startDateStr, endDateStr, ['query'], 1000);
    return data.rows || [];
  }

  async getTopQueries(limit: number = 20): Promise<SearchConsoleQueryData[]> {
    const rows = await this.getLastMonthData();
    return rows
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, limit);
  }

  async getTopImpressions(limit: number = 20): Promise<SearchConsoleQueryData[]> {
    const rows = await this.getLastMonthData();
    return rows
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, limit);
  }

  async getTopPositions(limit: number = 20): Promise<SearchConsoleQueryData[]> {
    const rows = await this.getLastMonthData();
    return rows
      .sort((a, b) => a.position - b.position) // Lower position number is better (page 1)
      .slice(0, limit);
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
}

// Helper function to calculate insights
export function calculateSearchConsoleInsights(
  searchData: SearchConsoleQueryData[],
  treatments: string[]
): SearchConsoleInsights {
  // Top performing queries (by clicks)
  const topPerformingQueries = searchData
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  // Opportunity queries (high impressions, low CTR)
  const opportunityQueries = searchData
    .filter(row => row.impressions > 1000 && row.ctr < 0.02)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  // Treatment matches
  const treatmentMatches: TreatmentMatch[] = [];

  treatments.forEach(treatment => {
    const treatmentWords = treatment.toLowerCase().split(/\s+/);
    const matchingKeywords: string[] = [];

    searchData.forEach(row => {
      const queryWords = row.keys[0].toLowerCase().split(/\s+/);
      const matchCount = treatmentWords.filter(word =>
        queryWords.some(qWord => qWord.includes(word) || word.includes(qWord))
      ).length;

      if (matchCount > 0 && (matchCount / treatmentWords.length) >= 0.5) {
        matchingKeywords.push(row.keys[0]);
      }
    });

    if (matchingKeywords.length > 0) {
      const matchPercentage = Math.round((matchingKeywords.length / searchData.length) * 100);
      const severity = matchPercentage > 20 ? 'high' : matchPercentage > 10 ? 'medium' : 'low';

      treatmentMatches.push({
        treatment,
        keywords: matchingKeywords.slice(0, 5),
        matchPercentage,
        severity
      });
    }
  });

  // Sort by match percentage
  treatmentMatches.sort((a, b) => b.matchPercentage - a.matchPercentage);

  // Generate detailed recommendations
  const lowPositionQueries = searchData.filter(row => row.position > 10 && row.clicks > 10);
  const contentGaps = treatments.filter(treatment =>
    !treatmentMatches.find(tm =>
      tm.treatment.toLowerCase().includes(treatment.toLowerCase().slice(0, 10))
    )
  ).slice(0, 5);

  // Seasonal trend analysis (mock for now - in real app would use historical data)
  const seasonalQueries = searchData.filter(row =>
    row.keys[0].toLowerCase().includes('summer') ||
    row.keys[0].toLowerCase().includes('winter') ||
    row.keys[0].toLowerCase().includes('season') ||
    row.keys[0].toLowerCase().includes('holiday')
  ).slice(0, 3);

  // Geographic performance (Turkish cities/regions)
  const geographicQueries = searchData.filter(row =>
    row.keys[0].toLowerCase().includes('turkey') ||
    row.keys[0].toLowerCase().includes('istanbul') ||
    row.keys[0].toLowerCase().includes('ankara') ||
    row.keys[0].toLowerCase().includes('izmir')
  ).slice(0, 5);

  // Old/low-performing content analysis
  const oldLowPerformingQueries = searchData.filter(row =>
    row.position > 15 && row.clicks < row.impressions * 0.005
  ).slice(0, 5);

  const recommendations = [
    {
      type: 'opportunity_queries',
      title: `Found ${opportunityQueries.length} high-impression, low-CTR keywords`,
      description: 'These queries have high visibility but low click-through rates',
      items: opportunityQueries.slice(0, 10),
      action: 'Optimize title tags and meta descriptions to improve CTR'
    },
    {
      type: 'treatment_matches',
      title: `Identified ${treatmentMatches.length} treatments with matching search queries`,
      description: 'Content opportunities based on your treatment services',
      items: treatmentMatches.slice(0, 15),
      action: 'Create targeted blog content for these services'
    },
    {
      type: 'low_position_queries',
      title: `Found ${lowPositionQueries.length} queries ranking below position 10`,
      description: 'Keywords needing ranking improvement',
      items: lowPositionQueries.slice(0, 10),
      action: 'Improve content depth and internal linking'
    },
    {
      type: 'seasonal_trends',
      title: `${seasonalQueries.length} seasonal content opportunities`,
      description: 'Capitalize on seasonal search trends',
      items: seasonalQueries.slice(0, 8),
      action: 'Create content around seasonal treatment trends'
    },
    {
      type: 'geographic_performance',
      title: `${geographicQueries.length} location-based keyword opportunities`,
      description: 'Local search performance in Turkey and major cities',
      items: geographicQueries.slice(0, 8),
      action: 'Optimize for geographic search intent in key markets'
    },
    {
      type: 'content_freshness',
      title: `${oldLowPerformingQueries.length} aging content opportunities`,
      description: 'Update old content to improve rankings',
      items: oldLowPerformingQueries.slice(0, 8),
      action: 'Refresh outdated content with new information'
    },
    {
      type: 'content_gaps',
      title: `${contentGaps.length} services without search traffic`,
      description: 'Treatment opportunities not capturing search interest yet',
      items: contentGaps.map(treatment => ({ keys: [treatment], clicks: 0, impressions: 0, ctr: 0, position: 0 })),
      action: 'Consider creating awareness content for these services'
    }
  ].filter(rec => rec.items.length > 0);

  return {
    topPerformingQueries,
    opportunityQueries,
    treatmentMatches,
    recommendations
  };
}
