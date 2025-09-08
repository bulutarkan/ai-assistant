// SerpApi Service for Google Search integration
export interface SerpApiSearchParams {
  q: string;
  location?: string;
  gl?: string; // country code (us, gb, de, etc.)
  hl?: string; // language code (en, es, fr, etc.)
  num?: number; // number of results (default 10)
}

export interface SerpOrganicResult {
  position: number;
  title: string;
  link: string;
  displayed_link: string;
  snippet?: string;
  cached_page_link?: string;
}

export interface SerpApiResponse {
  search_metadata: {
    status: string;
    created_at: string;
    processing_time_taken: number;
  };
  search_parameters: {
    engine: string;
    q: string;
    location?: string;
    gl?: string;
    hl?: string;
  };
  organic_results: SerpOrganicResult[];
  local_results?: any[];
  answer_box?: any;
  error?: string;
}

export class SerpApiService {
  private baseUrl: string;
  private apiKey: string;
  private mockMode: boolean;

  constructor() {
    this.apiKey = import.meta.env.VITE_SERPAPI_KEY;
    this.mockMode = import.meta.env.VITE_SERPAPI_MOCK_MODE === 'true';

    if (!this.apiKey) {
      throw new Error('SerpApi key not found in environment variables');
    }

    // Use proxy in development, PHP proxy in production or when proxy fails
    this.baseUrl = this.mockMode ? '' : (import.meta.env.DEV ? '/api/serpapi/search.json' : '/serpapi-proxy.php');
  }

  async searchKeyword(params: SerpApiSearchParams): Promise<SerpApiResponse> {
    // Return mock data if mock mode is enabled
    if (this.mockMode) {
      console.log('🔧 Mock mode enabled - returning mock data for:', params.q);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
      return this.getMockResponse(params);
    }

    try {
      console.log('🔍 Searching keyword:', params.q);

      // First try with XHR (Universal CORS bypass)
      try {
        return await this.universalSerpApiCall(params);
      } catch (xhrError) {
        console.log('⚠️ XHR approach failed, falling back to fetch:', xhrError.message);
        // Fall back to fetch approach
        return await this.fetchSerpApiCall(params);
      }
    } catch (error) {
      console.error('❌ All SerpApi approaches failed:', error);
      throw new Error(`Keyword search failed: ${error.message}`);
    }
  }

  // Analyze search results for keywords
  analyzeResults(results: SerpApiResponse): {
    topResults: SerpOrganicResult[];
    position: number;
    averagePosition: number;
    totalResults: number;
  } {
    const organicResults = results.organic_results || [];

    return {
      topResults: organicResults.slice(0, 10),
      position: organicResults.length > 0 ? organicResults[0].position : 0,
      averagePosition: organicResults.length > 0
        ? organicResults.reduce((sum, result) => sum + result.position, 0) / organicResults.length
        : 0,
      totalResults: organicResults.length,
    };
  }

  // Mock response for development/testing
  private getMockResponse(params: SerpApiSearchParams): SerpApiResponse {
    const mockResults: SerpOrganicResult[] = [
      {
        position: 1,
        title: `${params.q} - Example Website 1`,
        link: 'https://example.com/1',
        displayed_link: 'example.com › 1',
        snippet: `This is an example website about ${params.q}. It provides information and resources related to the search topic.`
      },
      {
        position: 2,
        title: `${params.q} Guide - Example Website 2`,
        link: 'https://example.com/2',
        displayed_link: 'example.com › guide',
        snippet: `Complete guide to ${params.q}. Learn everything you need to know with step-by-step instructions and examples.`
      },
      {
        position: 3,
        title: `Best ${params.q} Resources - Example Website 3`,
        link: 'https://example.com/3',
        displayed_link: 'example.com › resources',
        snippet: `Discover the best resources for ${params.q}. Reviews, comparisons, and recommendations from experts.`
      }
    ];

    return {
      search_metadata: {
        status: 'ok',
        created_at: new Date().toISOString(),
        processing_time_taken: 1.2
      },
      search_parameters: {
        engine: 'google',
        q: params.q,
        gl: params.gl || 'us',
        hl: params.hl || 'en'
      },
      organic_results: mockResults,
      local_results: [],
      answer_box: undefined
    };
  }

  // XHR-based universal CORS bypass call
  private universalSerpApiCall(params: SerpApiSearchParams): Promise<SerpApiResponse> {
    return new Promise<SerpApiResponse>((resolve, reject) => {
      console.log('🔄 Attempting XHR-based API call...');

      const url = this.buildSerpApiUrl(params);
      const xhr = new XMLHttpRequest();

      xhr.open('GET', url, true);

      xhr.onload = () => {
        try {
          if (xhr.status === 200) {
            const data: SerpApiResponse = JSON.parse(xhr.responseText);
            console.log('✅ XHR API call successful:', {
              results: data.organic_results?.length || 0,
              status: xhr.status
            });
            resolve(data);
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        } catch (parseError) {
          reject(new Error(`JSON Parse Error: ${parseError.message}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network Error - XHR failed'));
      };

      xhr.timeout = 30000; // 30 second timeout
      xhr.ontimeout = () => {
        reject(new Error('Request timeout'));
      };

      console.log('📡 XHR Request starting:', url.replace(/\bapi_key=[^&]*/, 'api_key=***'));
      xhr.send();
    });
  }

  // Fetch-based fallback call
  private fetchSerpApiCall(params: SerpApiSearchParams): Promise<SerpApiResponse> {
    console.log('⚠️ XHR failed, trying fetch fallback...');

    if (import.meta.env.DEV) {
      // Development: Use proxy with proper mode
      return this.devFetchCall(params);
    } else {
      // Production: Use no-cors mode with limitations
      return this.productionFetchCall(params);
    }
  }

  // Development fetch call with proxy
  private async devFetchCall(params: SerpApiSearchParams): Promise<SerpApiResponse> {
    const queryParams = new URLSearchParams({
      q: params.q,
      engine: 'google',
      api_key: this.apiKey,
    });

    if (params.location) queryParams.append('location', params.location);
    if (params.gl) queryParams.append('gl', params.gl);
    if (params.hl) queryParams.append('hl', params.hl);
    if (params.num) queryParams.append('num', params.num.toString());

    const fullUrl = `${this.baseUrl}?${queryParams.toString()}`;
    console.log('🌐 Dev proxy URL:', fullUrl.replace(/\bapi_key=[^&]*/, 'api_key=***'));

    const response = await fetch(fullUrl, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Dev fetch failed:', {
        status: response.status,
        url: fullUrl
      });
      throw new Error(`Proxy fetch failed: ${response.status}`);
    }

    const data: SerpApiResponse = await response.json();
    console.log('✅ Dev fetch successful');
    return data;
  }

  // Production fetch call with PHP proxy
  private async productionFetchCall(params: SerpApiSearchParams): Promise<SerpApiResponse> {
    // Build URL with API key as parameter for PHP proxy
    const queryParams = new URLSearchParams({
      q: params.q,
      engine: 'google',
      api_key: this.apiKey, // Send to PHP proxy
    });

    if (params.location) queryParams.append('location', params.location);
    if (params.gl) queryParams.append('gl', params.gl);
    if (params.hl) queryParams.append('hl', params.hl);
    if (params.num) queryParams.append('num', params.num.toString());

    const url = `${this.baseUrl}?${queryParams.toString()}`;
    console.log('🌐 Production PHP Proxy URL:', url.replace(/api_key=[^&]*/, 'api_key=***'));

    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ PHP proxy fetch failed:', {
        status: response.status,
        url: url.replace(/api_key=[^&]*/, 'api_key=***'),
        error: errorText
      });
      throw new Error(`PHP proxy fetch failed: ${response.status} - ${errorText}`);
    }

    const data: SerpApiResponse = await response.json();
    console.log('✅ PHP proxy fetch successful:', {
      results: data.organic_results?.length || 0,
      status: 'PHP proxy response'
    });
    return data;
  }

  // Build URL helper method
  private buildSerpApiUrl(params: SerpApiSearchParams): string {
    const url = new URL(`https://serpapi.com/search.json`);
    url.searchParams.append('engine', 'google');
    url.searchParams.append('q', params.q);
    url.searchParams.append('api_key', this.apiKey);

    if (params.location) url.searchParams.append('location', params.location);
    if (params.gl) url.searchParams.append('gl', params.gl);
    if (params.hl) url.searchParams.append('hl', params.hl);
    if (params.num) url.searchParams.append('num', params.num.toString());

    return url.toString();
  }

  // Fallback direct API call (bypasses proxy)
  private fallbackDirectCall = async (params: SerpApiSearchParams): Promise<SerpApiResponse> => {
    console.log('🔄 Attempting direct API call to SerpApi...');
    try {
      const queryParams = new URLSearchParams({
        q: params.q,
        engine: 'google',
        api_key: this.apiKey,
      });

      if (params.location) queryParams.append('location', params.location);
      if (params.gl) queryParams.append('gl', params.gl);
      if (params.hl) queryParams.append('hl', params.hl);
      if (params.num) queryParams.append('num', params.num.toString());

      const directUrl = `https://serpapi.com/search.json?${queryParams.toString()}`;
      console.log('📡 Direct API URL:', directUrl.replace(/\bapi_key=[^&]*/, 'api_key=***'));

      const response = await fetch(directUrl, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-cache',
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Direct API call failed: ${response.status} ${response.statusText}`);
      }

      const data: SerpApiResponse = await response.json();
      console.log('✅ Direct API call successful');
      return data;

    } catch (fallbackError) {
      console.error('❌ Direct API call also failed:', fallbackError);
      throw new Error(`All API connection attempts failed. Please check your internet connection or try again later.`);
    }
  }
}

// Utility functions for country/location mapping
export const COUNTRY_OPTIONS = [
  // Avrupa Birliği
  { code: 'at', name: 'Austria', flag: '🇦🇹' },
  { code: 'be', name: 'Belgium', flag: '🇧🇪' },
  { code: 'bg', name: 'Bulgaria', flag: '🇧🇬' },
  { code: 'hr', name: 'Croatia', flag: '🇭🇷' },
  { code: 'cy', name: 'Cyprus', flag: '🇨🇾' },
  { code: 'cz', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'dk', name: 'Denmark', flag: '🇩🇰' },
  { code: 'ee', name: 'Estonia', flag: '🇪🇪' },
  { code: 'fi', name: 'Finland', flag: '🇫🇮' },
  { code: 'fr', name: 'France', flag: '🇫🇷' },
  { code: 'de', name: 'Germany', flag: '🇩🇪' },
  { code: 'gr', name: 'Greece', flag: '🇬🇷' },
  { code: 'hu', name: 'Hungary', flag: '🇭🇺' },
  { code: 'ie', name: 'Ireland', flag: '🇮🇪' },
  { code: 'it', name: 'Italy', flag: '🇮🇹' },
  { code: 'lv', name: 'Latvia', flag: '🇱🇻' },
  { code: 'lt', name: 'Lithuania', flag: '🇱🇹' },
  { code: 'lu', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'mt', name: 'Malta', flag: '🇲🇹' },
  { code: 'nl', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Poland', flag: '🇵🇱' },
  { code: 'pt', name: 'Portugal', flag: '🇵🇹' },
  { code: 'ro', name: 'Romania', flag: '🇷🇴' },
  { code: 'sk', name: 'Slovakia', flag: '🇸🇰' },
  { code: 'si', name: 'Slovenia', flag: '🇸🇮' },
  { code: 'es', name: 'Spain', flag: '🇪🇸' },
  { code: 'se', name: 'Sweden', flag: '🇸🇪' },
  { code: 'gb', name: 'United Kingdom', flag: '🇬🇧' },

  // Kuzey Amerika
  { code: 'us', name: 'United States', flag: '🇺🇸' },
  { code: 'ca', name: 'Canada', flag: '🇨🇦' },

  // Avrupa (AB dışı)
  { code: 'ch', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'no', name: 'Norway', flag: '🇳🇴' },
  { code: 'is', name: 'Iceland', flag: '🇮🇸' },
  { code: 'tr', name: 'Turkey', flag: '🇹🇷' },
  { code: 'ru', name: 'Russia', flag: '🇷🇺' },
  { code: 'ua', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'al', name: 'Albania', flag: '🇦🇱' },
  { code: 'ba', name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  { code: 'mk', name: 'North Macedonia', flag: '🇲🇰' },
  { code: 'rs', name: 'Serbia', flag: '🇷🇸' },
  { code: 'me', name: 'Montenegro', flag: '🇲🇪' },

  // Asya
  { code: 'cn', name: 'China', flag: '🇨🇳' },
  { code: 'jp', name: 'Japan', flag: '🇯🇵' },
  { code: 'kr', name: 'South Korea', flag: '🇰🇷' },
  { code: 'in', name: 'India', flag: '🇮🇳' },
  { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'my', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'ph', name: 'Philippines', flag: '🇵🇭' },
  { code: 'sg', name: 'Singapore', flag: '🇸🇬' },
  { code: 'th', name: 'Thailand', flag: '🇹🇭' },
  { code: 'vn', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'pk', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'bd', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'np', name: 'Nepal', flag: '🇳🇵' },
  { code: 'lk', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'hk', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'tw', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'kz', name: 'Kazakhstan', flag: '🇰🇿' },
  { code: 'uz', name: 'Uzbekistan', flag: '🇺🇿' },
  { code: 'kg', name: 'Kyrgyzstan', flag: '🇰🇬' },
  { code: 'tj', name: 'Tajikistan', flag: '🇹🇯' },
  { code: 'tm', name: 'Turkmenistan', flag: '🇹🇲' },
  { code: 'az', name: 'Azerbaijan', flag: '🇦🇿' },
  { code: 'ge', name: 'Georgia', flag: '🇬🇪' },
  { code: 'am', name: 'Armenia', flag: '🇦🇲' },

  // Orta Doğu
  { code: 'ir', name: 'Iran', flag: '🇮🇷' },
  { code: 'sa', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'ae', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'qa', name: 'Qatar', flag: '🇶🇦' },
  { code: 'kw', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'bh', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'il', name: 'Israel', flag: '🇮🇱' },
  { code: 'jo', name: 'Jordan', flag: '🇯🇴' },
  { code: 'lb', name: 'Lebanon', flag: '🇱🇧' },
  { code: 'iq', name: 'Iraq', flag: '🇮🇶' },
  { code: 'sy', name: 'Syria', flag: '🇸🇾' },
  { code: 'om', name: 'Oman', flag: '🇴🇲' },
  { code: 'ye', name: 'Yemen', flag: '🇾🇪' },

  // Afrika
  { code: 'za', name: 'South Africa', flag: '🇿🇦' },
  { code: 'ng', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'eg', name: 'Egypt', flag: '🇪🇬' },
  { code: 'ma', name: 'Morocco', flag: '🇲🇦' },
  { code: 'tn', name: 'Tunisia', flag: '🇹🇳' },
  { code: 'dz', name: 'Algeria', flag: '🇩🇿' },
  { code: 'ke', name: 'Kenya', flag: '🇰🇪' },
  { code: 'tz', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'ug', name: 'Uganda', flag: '🇺🇬' },
  { code: 'gh', name: 'Ghana', flag: '🇬🇭' },
  { code: 'et', name: 'Ethiopia', flag: '🇪🇹' },
  { code: 'rw', name: 'Rwanda', flag: '🇷🇼' },
  { code: 'zm', name: 'Zambia', flag: '🇿🇲' },
  { code: 'zw', name: 'Zimbabwe', flag: '🇿🇼' },
  { code: 'bw', name: 'Botswana', flag: '🇧🇼' },
  { code: 'mw', name: 'Malawi', flag: '🇲🇼' },

  // Latin Amerika
  { code: 'ar', name: 'Argentina', flag: '🇦🇷' },
  { code: 'br', name: 'Brazil', flag: '🇧🇷' },
  { code: 'cl', name: 'Chile', flag: '🇨🇱' },
  { code: 'co', name: 'Colombia', flag: '🇨🇴' },
  { code: 'mx', name: 'Mexico', flag: '🇲🇽' },
  { code: 'pe', name: 'Peru', flag: '🇵🇪' },
  { code: 'uy', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'py', name: 'Paraguay', flag: '🇵🇾' },
  { code: 'bo', name: 'Bolivia', flag: '🇧🇴' },
  { code: 'ec', name: 'Ecuador', flag: '🇪🇨' },
  { code: 've', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'cr', name: 'Costa Rica', flag: '🇨🇷' },
  { code: 'sv', name: 'El Salvador', flag: '🇸🇻' },
  { code: 'gt', name: 'Guatemala', flag: '🇬🇹' },
  { code: 'hn', name: 'Honduras', flag: '🇭🇳' },
  { code: 'ni', name: 'Nicaragua', flag: '🇳🇮' },
  { code: 'pa', name: 'Panama', flag: '🇵🇦' },
  { code: 'do', name: 'Dominican Republic', flag: '🇩🇴' },

  // Okyanusya
  { code: 'au', name: 'Australia', flag: '🇦🇺' },
  { code: 'nz', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'fj', name: 'Fiji', flag: '🇫🇯' },
  { code: 'pf', name: 'French Polynesia', flag: '🇵🇫' },
  { code: 'gu', name: 'Guam', flag: '🇬🇺' },
  { code: 'mp', name: 'Northern Mariana Islands', flag: '🇲🇵' },

];

export const LANGUAGE_OPTIONS = [
  // Avrupa Dilleri
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
  { code: 'sl', name: 'Slovenščina', flag: '🇸🇮' },
  { code: 'sk', name: 'Slovenčina', flag: '🇸🇰' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' },
  { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' },
  { code: 'sr', name: 'Srpski', flag: '🇷🇸' },
  { code: 'bs', name: 'Bosanski', flag: '🇧🇦' },
  { code: 'mk', name: 'Македонски', flag: '🇲🇰' },
  { code: 'bg', name: 'Български', flag: '🇧🇬' },

  // Asya Dilleri
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
  { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
  { code: 'ur', name: 'اردو', flag: '🇵🇰' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी', flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
  { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn', name: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'tl', name: 'Tagalog', flag: '🇵🇭' },
  { code: 'sw', name: 'Kiswahili', flag: '🇹🇿' },
  { code: 'am', name: 'አማርኛ', flag: '🇪🇹' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },

  // Orta Doğu & İslam Dünyası
  { code: 'fa', name: 'فارسی', flag: '🇮🇷' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'he', name: 'עברית', flag: '🇮🇱' },
  { code: 'ka', name: 'ქართული', flag: '🇬🇪' },
  { code: 'hy', name: 'Հայերեն', flag: '🇦🇲' },
  { code: 'az', name: 'Azərbaycan', flag: '🇦🇿' },
  { code: 'kk', name: 'Қазақша', flag: '🇰🇿' },
  { code: 'ky', name: 'Кыргызча', flag: '🇰🇬' },
  { code: 'tk', name: 'Türkmençe', flag: '🇹🇲' },

  // Afrika Dilleri
  { code: 'af', name: 'Afrikaans', flag: '🇿🇦' },
  { code: 'zu', name: 'isiZulu', flag: '🇿🇦' },
  { code: 'xh', name: 'isiXhosa', flag: '🇿🇦' },
  { code: 'yo', name: 'Yorùbá', flag: '🇳🇬' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },

  // Diğer
  { code: 'sq', name: 'Shqip', flag: '🇦🇱' },
  { code: 'et', name: 'Eesti', flag: '🇪🇪' },
  { code: 'lv', name: 'Latviešu', flag: '🇱🇻' },
  { code: 'lt', name: 'Lietuvių', flag: '🇱🇹' },
  { code: 'is', name: 'Íslenska', flag: '🇮🇸' },
  { code: 'ga', name: 'Gaeilge', flag: '🇮🇪' },
  { code: 'cy', name: 'Cymraeg', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
];

export const LOCATION_OPTIONS = [
  // Temel Ülkeler / Bölgeler
  { name: 'United Kingdom', searchValue: 'United Kingdom' },
  { name: 'England', searchValue: 'England, United Kingdom' },
  { name: 'Scotland', searchValue: 'Scotland, United Kingdom' },
  { name: 'Wales', searchValue: 'Wales, United Kingdom' },
  { name: 'Northern Ireland', searchValue: 'Northern Ireland, United Kingdom' },
  { name: 'United States', searchValue: 'United States' },
  { name: 'Canada', searchValue: 'Canada' },
  { name: 'Australia', searchValue: 'Australia' },
  { name: 'Germany', searchValue: 'Germany' },
  { name: 'France', searchValue: 'France' },
  { name: 'Spain', searchValue: 'Spain' },
  { name: 'Italy', searchValue: 'Italy' },
  { name: 'Netherlands', searchValue: 'Netherlands' },
  { name: 'Sweden', searchValue: 'Sweden' },

  // İngiltere Şehirleri
  { name: 'London, England', searchValue: 'London, England, United Kingdom' },
  { name: 'Manchester, England', searchValue: 'Manchester, England, United Kingdom' },
  { name: 'Birmingham, England', searchValue: 'Birmingham, England, United Kingdom' },
  { name: 'Leeds, England', searchValue: 'Leeds, England, United Kingdom' },
  { name: 'Liverpool, England', searchValue: 'Liverpool, England, United Kingdom' },
  { name: 'Bristol, England', searchValue: 'Bristol, England, United Kingdom' },
  { name: 'Sheffield, England', searchValue: 'Sheffield, England, United Kingdom' },
  { name: 'Newcastle, England', searchValue: 'Newcastle, England, United Kingdom' },
  { name: 'Cardiff, Wales', searchValue: 'Cardiff, Wales, United Kingdom' },
  { name: 'Edinburgh, Scotland', searchValue: 'Edinburgh, Scotland, United Kingdom' },
  { name: 'Glasgow, Scotland', searchValue: 'Glasgow, Scotland, United Kingdom' },
  { name: 'Glasgow, Scotland', searchValue: 'Glasgow, Scotland, United Kingdom' },
  { name: 'Belfast, Northern Ireland', searchValue: 'Belfast, Northern Ireland, United Kingdom' },

  // Büyük Şehirler & Global Hub'lar
  { name: 'New York, United States', searchValue: 'New York, NY, United States' },
  { name: 'Los Angeles, United States', searchValue: 'Los Angeles, CA, United States' },
  { name: 'Chicago, United States', searchValue: 'Chicago, IL, United States' },
  { name: 'Houston, United States', searchValue: 'Houston, TX, United States' },
  { name: 'Phoenix, United States', searchValue: 'Phoenix, AZ, United States' },
  { name: 'Philadelphia, United States', searchValue: 'Philadelphia, PA, United States' },
  { name: 'San Antonio, United States', searchValue: 'San Antonio, TX, United States' },
  { name: 'San Diego, United States', searchValue: 'San Diego, CA, United States' },
  { name: 'Dallas, United States', searchValue: 'Dallas, TX, United States' },
  { name: 'Toronto, Canada', searchValue: 'Toronto, ON, Canada' },
  { name: 'Vancouver, Canada', searchValue: 'Vancouver, BC, Canada' },
  { name: 'Montreal, Canada', searchValue: 'Montreal, QC, Canada' },
  { name: 'Sydney, Australia', searchValue: 'Sydney, NSW, Australia' },
  { name: 'Melbourne, Australia', searchValue: 'Melbourne, VIC, Australia' },
  { name: 'Berlin, Germany', searchValue: 'Berlin, Germany' },
  { name: 'Hamburg, Germany', searchValue: 'Hamburg, Germany' },
  { name: 'Munich, Germany', searchValue: 'Munich, Germany' },
  { name: 'Cologne, Germany', searchValue: 'Cologne, Germany' },
  { name: 'Frankfurt, Germany', searchValue: 'Frankfurt, Germany' },
  { name: 'Paris, France', searchValue: 'Paris, France' },
  { name: 'Marseille, France', searchValue: 'Marseille, France' },
  { name: 'Barcelona, Spain', searchValue: 'Barcelona, Spain' },
  { name: 'Madrid, Spain', searchValue: 'Madrid, Spain' },
  { name: 'Rome, Italy', searchValue: 'Rome, Italy' },
  { name: 'Milan, Italy', searchValue: 'Milan, Italy' },
  { name: 'Naples, Italy', searchValue: 'Naples, Italy' },
  { name: 'Amsterdam, Netherlands', searchValue: 'Amsterdam, Netherlands' },
  { name: 'Rotterdam, Netherlands', searchValue: 'Rotterdam, Netherlands' },
  { name: 'Stockholm, Sweden', searchValue: 'Stockholm, Sweden' },
  { name: 'Gothenburg, Sweden', searchValue: 'Gothenburg, Sweden' },

  // Asya Şehirleri
  { name: 'Tokyo, Japan', searchValue: 'Tokyo, Japan' },
  { name: 'Yokohama, Japan', searchValue: 'Yokohama, Japan' },
  { name: 'Osaka, Japan', searchValue: 'Osaka, Japan' },
  { name: 'Seoul, South Korea', searchValue: 'Seoul, South Korea' },
  { name: 'Busan, South Korea', searchValue: 'Busan, South Korea' },
  { name: 'Beijing, China', searchValue: 'Beijing, China' },
  { name: 'Shanghai, China', searchValue: 'Shanghai, China' },
  { name: 'Hong Kong', searchValue: 'Hong Kong' },
  { name: 'Singapore', searchValue: 'Singapore' },
  { name: 'Mumbai, India', searchValue: 'Mumbai, India' },
  { name: 'Delhi, India', searchValue: 'Delhi, India' },
  { name: 'Bangalore, India', searchValue: 'Bangalore, India' },
  { name: 'Istanbul, Turkey', searchValue: 'Istanbul, Turkey' },
  { name: 'Ankara, Turkey', searchValue: 'Ankara, Turkey' },
  { name: 'Izmir, Turkey', searchValue: 'Izmir, Turkey' },
  { name: 'Dubai, UAE', searchValue: 'Dubai, UAE' },
  { name: 'Abu Dhabi, UAE', searchValue: 'Abu Dhabi, UAE' },
  { name: 'Tel Aviv, Israel', searchValue: 'Tel Aviv, Israel' },
  { name: 'Jerusalem, Israel', searchValue: 'Jerusalem, Israel' },

  // Orta Doğu & Körfez
  { name: 'Riyadh, Saudi Arabia', searchValue: 'Riyadh, Saudi Arabia' },
  { name: 'Jeddah, Saudi Arabia', searchValue: 'Jeddah, Saudi Arabia' },
  { name: 'Doha, Qatar', searchValue: 'Doha, Qatar' },
  { name: 'Kuwait City, Kuwait', searchValue: 'Kuwait City, Kuwait' },
  { name: 'Manama, Bahrain', searchValue: 'Manama, Bahrain' },
  { name: 'Muscat, Oman', searchValue: 'Muscat, Oman' },
  { name: 'Tehran, Iran', searchValue: 'Tehran, Iran' },

  // Afrika Şehirleri
  { name: 'Johannesburg, South Africa', searchValue: 'Johannesburg, South Africa' },
  { name: 'Cape Town, South Africa', searchValue: 'Cape Town, South Africa' },
  { name: 'Pretoria, South Africa', searchValue: 'Pretoria, South Africa' },
  { name: 'Lagos, Nigeria', searchValue: 'Lagos, Nigeria' },
  { name: 'Abuja, Nigeria', searchValue: 'Abuja, Nigeria' },
  { name: 'Cairo, Egypt', searchValue: 'Cairo, Egypt' },
  { name: 'Alexandria, Egypt', searchValue: 'Alexandria, Egypt' },
  { name: 'Casablanca, Morocco', searchValue: 'Casablanca, Morocco' },
  { name: 'Rabat, Morocco', searchValue: 'Rabat, Morocco' },
  { name: 'Nairobi, Kenya', searchValue: 'Nairobi, Kenya' },
  { name: 'Accra, Ghana', searchValue: 'Accra, Ghana' },
  { name: 'Tunis, Tunisia', searchValue: 'Tunis, Tunisia' },
  { name: 'Algiers, Algeria', searchValue: 'Algiers, Algeria' },
  { name: 'Addis Ababa, Ethiopia', searchValue: 'Addis Ababa, Ethiopia' },

  // Latin Amerika Şehirleri
  { name: 'Rio de Janeiro, Brazil', searchValue: 'Rio de Janeiro, Brazil' },
  { name: 'São Paulo, Brazil', searchValue: 'São Paulo, Brazil' },
  { name: 'Brasília, Brazil', searchValue: 'Brasília, Brazil' },
  { name: 'Buenos Aires, Argentina', searchValue: 'Buenos Aires, Argentina' },
  { name: 'Córdoba, Argentina', searchValue: 'Córdoba, Argentina' },
  { name: 'Lima, Peru', searchValue: 'Lima, Peru' },
  { name: 'Bogotá, Colombia', searchValue: 'Bogotá, Colombia' },
  { name: 'Medellín, Colombia', searchValue: 'Medellín, Colombia' },
  { name: 'Mexico City, Mexico', searchValue: 'Mexico City, Mexico' },
  { name: 'Guadalajara, Mexico', searchValue: 'Guadalajara, Mexico' },
  { name: 'Monterrey, Mexico', searchValue: 'Monterrey, Mexico' },
  { name: 'Santiago, Chile', searchValue: 'Santiago, Chile' },
  { name: 'Caracas, Venezuela', searchValue: 'Caracas, Venezuela' },
  { name: 'Montevideo, Uruguay', searchValue: 'Montevideo, Uruguay' },

  // Baltık ve Doğu Avrupa
  { name: 'Warsaw, Poland', searchValue: 'Warsaw, Poland' },
  { name: 'Krakow, Poland', searchValue: 'Krakow, Poland' },
  { name: 'Prague, Czech Republic', searchValue: 'Prague, Czech Republic' },
  { name: 'Brno, Czech Republic', searchValue: 'Brno, Czech Republic' },
  { name: 'Budapest, Hungary', searchValue: 'Budapest, Hungary' },
  { name: 'Bucharest, Romania', searchValue: 'Bucharest, Romania' },
  { name: 'Athens, Greece', searchValue: 'Athens, Greece' },
  { name: 'Thessaloniki, Greece', searchValue: 'Thessaloniki, Greece' },
  { name: 'Lisbon, Portugal', searchValue: 'Lisbon, Portugal' },
  { name: 'Porto, Portugal', searchValue: 'Porto, Portugal' },
  { name: 'Vienna, Austria', searchValue: 'Vienna, Austria' },
  { name: 'Zurich, Switzerland', searchValue: 'Zurich, Switzerland' },
  { name: 'Geneva, Switzerland', searchValue: 'Geneva, Switzerland' },
  { name: 'Moscow, Russia', searchValue: 'Moscow, Russia' },
  { name: 'Saint Petersburg, Russia', searchValue: 'Saint Petersburg, Russia' },
  { name: 'Kiev, Ukraine', searchValue: 'Kiev, Ukraine' },
  { name: 'Minsk, Belarus', searchValue: 'Minsk, Belarus' },

  // Okyanusya
  { name: 'Perth, Australia', searchValue: 'Perth, WA, Australia' },
  { name: 'Brisbane, Australia', searchValue: 'Brisbane, QLD, Australia' },
  { name: 'Auckland, New Zealand', searchValue: 'Auckland, New Zealand' },
  { name: 'Wellington, New Zealand', searchValue: 'Wellington, New Zealand' },
];
