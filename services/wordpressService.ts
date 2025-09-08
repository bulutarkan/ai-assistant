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
  categories: number[];
  date: string;
  modified: string;
}

interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
}

interface BlogData {
  posts: WordPressPost[];
  categories: WordPressCategory[];
  keywords: string[];
  treatmentMatches: Array<{
    treatment: string;
    posts: WordPressPost[];
    frequency: number;
  }>;
}

class WordPressService {
  private baseUrl: string;
  private treatments: string[];

  constructor(baseUrl: string = '', treatments: string[] = []) {
    this.baseUrl = baseUrl;
    this.treatments = treatments;
  }

  /**
   * Update WordPress API base URL
   */
  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Set treatments list for analysis
   */
  setTreatments(treatments: string[]) {
    this.treatments = treatments;
  }

  /**
   * Fetch latest N blog posts from WordPress REST API
   */
  async fetchLatestPosts(limit: number = 10): Promise<WordPressPost[]> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        console.log(`📄 Fetching latest ${limit} WordPress posts...`);
        const response = await fetch(
          `${this.baseUrl}/wp-json/wp/v2/posts?per_page=${limit}&page=1&orderby=date&order=desc&_embed&_=${Date.now()}`
        );

        if (!response.ok) {
          throw new Error(`WordPress API error: ${response.status}`);
        }

        const posts = await response.json();
        console.log(`✅ Fetched ${posts.length} latest posts from WordPress`);

        return posts;

      } catch (error) {
        retryCount++;
        console.error(`❌ Error fetching latest posts (attempt ${retryCount}/${maxRetries}):`, error);

        if (retryCount >= maxRetries) {
          console.error(`💥 Max retries reached, returning empty array`);
          return [];
        }

        // Wait before retry (exponential backoff)
        const waitTime = Math.pow(2, retryCount) * 1000;
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    return []; // Fallback empty array
  }

  /**
   * Fetch all blog posts from WordPress REST API with pagination (Dashboard için)
   */
  async fetchAllPosts(): Promise<WordPressPost[]> {
    const allPosts: WordPressPost[] = [];
    let page = 1;
    let hasMorePages = true;
    const maxRetries = 3;

    while (hasMorePages) {
      let retryCount = 0;
      let success = false;

      while (!success && retryCount < maxRetries) {
        try {
          console.log(`📄 Fetching WordPress posts page ${page}...`);
          const response = await fetch(
            `${this.baseUrl}/wp-json/wp/v2/posts?per_page=15&page=${page}&orderby=date&order=desc&_embed&_=${Date.now()}`
          );

          if (!response.ok) {
            if (response.status === 400) {
              // 400 = Invalid request, probably no more pages
              console.log('📄 No more pages available');
              hasMorePages = false;
              success = true;
              break;
            }
            throw new Error(`WordPress API error: ${response.status}`);
          }

          const posts = await response.json();

          if (posts.length === 0) {
            console.log('📄 Empty page received, stopping pagination');
            hasMorePages = false;
            success = true;
            break;
          }

          allPosts.push(...posts);
          console.log(`✅ Page ${page}: ${posts.length} posts fetched (${allPosts.length} total)`);

          // Check if we got less than 15 posts (last page)
          if (posts.length < 15) {
            console.log('📄 Last page reached');
            hasMorePages = false;
          }

          page++;
          success = true;

          // Rate limiting - wait 200ms between requests
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          retryCount++;
          console.error(`❌ Error fetching page ${page} (attempt ${retryCount}/${maxRetries}):`, error);

          if (retryCount >= maxRetries) {
            console.error(`💥 Max retries reached for page ${page}, stopping pagination`);
            hasMorePages = false;
            break;
          }

          // Wait before retry (exponential backoff)
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      if (!success) {
        console.error(`💥 Failed to fetch page ${page} after ${maxRetries} retries`);
        hasMorePages = false;
      }
    }

    console.log(`🎉 Total posts fetched: ${allPosts.length}`);
    return allPosts;
  }

  /**
   * Fetch all categories from WordPress REST API
   */
  async fetchCategories(): Promise<WordPressCategory[]> {
    try {
      const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/categories?per_page=100`);
      if (!response.ok) {
        throw new Error(`WordPress API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching WordPress categories:', error);
      return [];
    }
  }

  /**
   * Extract keywords from posts content
   */
  extractKeywords(posts: WordPressPost[]): string[] {
    const keywords = new Set<string>();
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'an', 'a', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'];

    posts.forEach(post => {
      const content = this.stripHtmlTags(post.content.rendered).toLowerCase();
      const title = post.title.rendered.toLowerCase();

      // Extract words from title and content
      const text = `${title} ${content}`;
      const words = text.match(/\b\w+\b/g) || [];

      words.forEach(word => {
        if (word.length > 3 && !stopWords.includes(word)) {
          keywords.add(word);
        }
      });
    });

    return Array.from(keywords).sort();
  }

  /**
   * Strip HTML tags and entities from text content
   */
  public stripHtmlTags(html: string): string {
    let text = html;
    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, '');
    // Remove HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&/g, '&');
    text = text.replace(/</g, '<');
    text = text.replace(/>/g, '>');
    text = text.replace(/"/g, '"');
    text = text.replace(/&#\d+;/g, '');
    text = text.replace(/&[a-zA-Z]+;/g, '');
    // Normalize whitespace
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Analyze treatment matches in blog posts - IMPROVED LOGIC
   */
  analyzeTreatmentMatches(posts: WordPressPost[]): Array<{treatment: string, posts: WordPressPost[], frequency: number}> {
    return this.treatments.map(treatment => {
      // Create more specific keywords for matching
      const baseTreatment = treatment.replace(' in Turkey', '');
      const treatmentKeywords = [
        baseTreatment.toLowerCase(),
        baseTreatment.toLowerCase().split(' ').join(' '), // exact match
        baseTreatment.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, ' ') // remove special chars
      ];

      const matchingPosts = posts.filter(post => {
        const title = this.stripHtmlTags(post.title.rendered).toLowerCase();
        const content = this.stripHtmlTags(post.content.rendered).toLowerCase();

        // Check if title contains specific treatment keywords (not just "turkey")
        const titleHasSpecificKeyword = treatmentKeywords.some(keyword => {
          const words = keyword.split(' ');
          // Require at least 2 words from treatment to match OR single important word
          if (words.length >= 2) {
            return words.every(word => word.length > 2 && title.includes(word));
          } else {
            return keyword.length > 3 && title.includes(keyword);
          }
        });

        // Check content as well but with stricter requirements
        const contentHasSpecificKeyword = treatmentKeywords.some(keyword => {
          const words = keyword.split(' ');
          if (words.length >= 2) {
            // For multi-word treatments, require multiple words to be present
            return words.filter(word => word.length > 2 && content.includes(word)).length >= Math.min(2, words.length);
          } else {
            // For single-word treatments
            return keyword.length > 3 && content.includes(keyword);
          }
        });

        // Additional check: exclude posts that only contain "turkey" without specific treatment
        const hasTurkeyWord = title.includes('turkey') || content.includes('turkey');
        const hasSpecificTreatmentIndicator = titleHasSpecificKeyword || (contentHasSpecificKeyword && treatment !== 'Weight Loss Surgery in Turkey');

        return hasSpecificTreatmentIndicator && hasTurkeyWord;
      });

      return {
        treatment,
        posts: matchingPosts,
        frequency: matchingPosts.length
      };
    }).sort((a, b) => b.frequency - a.frequency); // Sort by frequency descending
  }

  /**
   * Get comprehensive blog data for AI analysis
   */
  async getBlogData(): Promise<BlogData> {
    const [posts, categories] = await Promise.all([
      this.fetchAllPosts(),
      this.fetchCategories()
    ]);

    const keywords = this.extractKeywords(posts);
    const treatmentMatches = this.analyzeTreatmentMatches(posts);

    return {
      posts,
      categories,
      keywords,
      treatmentMatches
    };
  }

  /**
   * Format blog data for AI context
   */
  formatForAIContext(blogData: BlogData): string {
    let context = `CK HEALTH TURKEY BLOG ANALYSIS DATA\n\n`;

    context += `TOTAL POSTS: ${blogData.posts.length}\n`;
    context += `TOTAL KEYWORDS FOUND: ${blogData.keywords.length}\n\n`;

    // Top keywords by frequency
    const keywordFreq: { [key: string]: number } = {};
    blogData.keywords.forEach(keyword => {
      keywordFreq[keyword] = 0;
    });

    blogData.posts.forEach(post => {
      const content = `${post.title.rendered} ${post.content.rendered}`.toLowerCase();
      blogData.keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = content.match(regex);
        if (matches) {
          keywordFreq[keyword] += matches.length;
        }
      });
    });

    const sortedKeywords = Object.entries(keywordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50);

    context += `TOP 50 KEYWORDS:\n`;
    sortedKeywords.forEach(([keyword, freq], index) => {
      context += `${index + 1}. ${keyword}: ${freq} times\n`;
    });

    // Treatment analysis
    context += `\nTREATMENT ANALYSIS:\n`;
    blogData.treatmentMatches.forEach((match, index) => {
      context += `${index + 1}. ${match.treatment}: ${match.frequency} posts\n`;
    });

    // Posts by category
    context += `\nPOSTS BY CATEGORY:\n`;
    const categoryCount: { [key: string]: number } = {};
    blogData.posts.forEach(post => {
      post.categories.forEach(catId => {
        const category = blogData.categories.find(c => c.id === catId);
        if (category) {
          categoryCount[category.name] = (categoryCount[category.name] || 0) + 1;
        }
      });
    });

    Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        context += `${category}: ${count} posts\n`;
      });

    return context;
  }
}

export const wordpressService = new WordPressService();
export type { WordPressPost, WordPressCategory, BlogData };
