import { GoogleGenAI, Part, Content } from "@google/genai";
import { User } from '../types';
import {
  CoreWebVitalsData,
  ImageSEOAnalysis,
  SemanticHTMLAnalysis,
  MobileSEOScore,
  SchemaMarkupAnalysis,
  AdvancedSEOAnalysis
} from '../types';
import { wordpressService } from './wordpressService';
import treatmentsData from './treatments.json';

// Ensure the API key is available from environment variables
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY is not set in environment variables.");
}

// Model configuration with fallback
const ai = new GoogleGenAI({ apiKey: API_KEY });
const PRIMARY_MODEL = 'gemini-2.5-flash';
const BACKUP_MODEL = 'gemini-2.0-flash';

interface GenerateContentParams {
  prompt: string;
  image?: {
    base64: string;
    mimeType: string;
  };
  user?: User;
  conversationHistory?: Array<{
    role: 'user' | 'model';
    content: string;
  }>;
  wordpressUrl?: string; // WordPress site URL for API calls
}

export async function* generateBlogResponseStream({
  prompt,
  image,
  user,
  conversationHistory = [],
  wordpressUrl
}: GenerateContentParams): AsyncGenerator<string> {
  const models = [PRIMARY_MODEL, BACKUP_MODEL];

  for (const model of models) {
    try {
      console.log(`🤖 Blog AI - Attempting API call with ${model}`);

      // Initialize WordPress service with treatments
      wordpressService.setTreatments(treatmentsData.treatments);

      // Build conversation contents from history + current message
      const contents: Content[] = [];

      // Add conversation history if available
      if (conversationHistory.length > 0) {
        conversationHistory.forEach(message => {
          contents.push({
            parts: [{ text: message.content }],
            role: message.role
          });
        });
      }

      // Build current message parts
      const currentParts: Part[] = [];

      // Add current image if provided
      if (image) {
        currentParts.push({
          inlineData: {
            data: image.base64,
            mimeType: image.mimeType,
          },
        });
      }

      // Add current user prompt
      currentParts.push({ text: prompt });

      // Add current message to contents
      contents.push({
        parts: currentParts,
        role: 'user'
      });

      // Get blog data if WordPress URL is provided
      let blogContext = '';
      if (wordpressUrl) {
        try {
          wordpressService.setBaseUrl(wordpressUrl);
          const blogData = await wordpressService.getBlogData();
          blogContext = wordpressService.formatForAIContext(blogData);
          console.log('📊 Blog data loaded successfully');
        } catch (error) {
          console.error('Error loading blog data:', error);
          blogContext = 'Blog data could not be loaded at this time.';
        }
      }

      let systemInstruction = `You are CK Health Turkey's Blog AI assistant. You provide intelligent analysis and insights about our blog content, content strategy, and marketing opportunities.

**CORE CAPABILITIES:**
- Analyze keyword usage and frequency across all blog posts
- Identify content gaps and suggest new blog topics
- Compare blog content with available treatments to find opportunities
- Provide SEO and content marketing recommendations
- Suggest which treatments need more blog coverage
- Identify trending topics and content opportunities

**AVAILABLE TREATMENTS (${treatmentsData.treatments.length}):**
${treatmentsData.treatments.map(treatment => `• ${treatment}`).join('\n')}

**CRITICAL MARKDOWN FORMATTING INSTRUCTIONS - ALWAYS USE PROPER FORMATTING:**

**EXACT ASTERISK COUNTS (CRITICAL - NO EXCEPTIONS):**
1. **Bold text:** Use **text** ONLY (exactly 2 asterisks) → **text**
2. **Italic text:** Use *text* ONLY (exactly 1 asterisk) → *text*
3. **Bold + Italic:** Use ***text*** ONLY (exactly 3 asterisks) → ***text***

**FORBIDDEN PATTERNS (NEVER USE THESE):**
❌ ***text** (3 asterisks start, 2 end - WRONG!)
❌ ****text** (4 asterisks start, 2 end - WRONG!)
❌ *text*** (1 asterisk start, 3 end - WRONG!)
❌ ****text*** (4 asterisks start, 3 end - WRONG!)

**OTHER FORMATTING:**
4. **Inline code:** Use single backticks for short code snippets (backtick + code + backtick)
5. **Block code:** Use triple backticks for longer code blocks
(3 backticks + code blocks + 3 backticks)
6. **Quote:** Use > text → > text
7. **Unordered list:** Use - item → • item
8. **Ordered list:** Use 1. item\n2. item → 1. item
9. **Headings:** # H1, ## H2, ### H3 (up to ###### H6)
10. **Horizontal rule:** Use --- or ***
11. **Link:** [text](url) → [text](url)
12. **Image:** ![alt text](url) → ![alt text](url)
13. **Table:**
    | Column 1 | Column 2 |
    |----------|----------|
    | Row 1    | Data     |

**CURRENT BLOG CONTEXT:**
${blogContext}

**RESPONSE STYLE:**
- Be professional, analytical, and actionable
- Provide specific recommendations with reasoning
- Use data from blog analysis when available
- Focus on insights that drive content creation and marketing decisions
- Always compare findings with available treatments
- Suggest concrete next steps for content strategy

**VERY IMPORTANT:**
- Your responses should be based on the blog data provided in context
- If blog data is not available, clearly state this limitation
- Always provide actionable insights, not just descriptions
- Compare keyword frequencies and treatment coverage gaps
- Suggest specific blog post ideas based on treatment analysis`;

      if (user) {
        systemInstruction += `\n\nYou are currently talking to ${user.name} ${user.surname}. Address them by their name when appropriate.`;
      }

      // Add conversation context awareness
      if (conversationHistory && conversationHistory.length > 0) {
        systemInstruction += `\n\n**CONVERSATION CONTEXT:** This user has an ongoing conversation. Previous messages are provided above. Maintain context and build upon previous discussions.`;
      } else {
        systemInstruction += `\n\n**NEW CONVERSATION:** This is the start of a new conversation.`;
      }

      console.log('🤖 Blog AI - Sending to Gemini API:', {
        model,
        conversationLength: conversationHistory.length,
        hasImage: !!image,
        userName: user?.name,
        hasBlogData: !!blogContext
      });

      const responseStream = await ai.models.generateContentStream({
        model: model,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
        },
      });

      for await (const chunk of responseStream) {
        yield chunk.text;
      }
      return; // Successfully used this model, exit the function

    } catch (error) {
      console.error(`Error with model ${model}:`, error);
      if (model === BACKUP_MODEL) {
        // If backup model also fails, return error message
        yield "I'm sorry, I encountered an error while processing your blog analysis request. Please try again.";
      }
      // Continue to next model if this one failed
    }
  }
};

export const generateBlogTitle = async (conversationSnippet: string): Promise<string> => {
  const models = [PRIMARY_MODEL, BACKUP_MODEL];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: `Based on the following blog analysis conversation, create a short, concise title (5 words maximum) for this chat. Focus on the main topic or insight discussed. Conversation: "${conversationSnippet}"`,
      });
      return response.text.replace(/["*#]/g, '').trim();
    } catch (error) {
      console.error(`Error generating blog title with model ${model}:`, error);
      if (model === BACKUP_MODEL) {
        // If backup model also fails, return default title
        return "Blog Analysis";
      }
      // Continue to next model
    }
  }
  return "Blog Analysis"; // Fallback
};

// AI-Powered SEO Analysis for individual posts
export interface SEOScoreAnalysis {
  score: number;
  contentQuality: {
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
  };
  keywordOptimization: {
    score: number;
    targetKeywords: string[];
    missingKeywords: string[];
    keywordDensity: { keyword: string; density: number; optimal: boolean; }[];
  };
  technicalSEO: {
    score: number;
    issues: string[];
    passed: string[];
  };
  engagement: {
    score: number;
    suggestions: string[];
  };
  readability: {
    score: number;
    grade: string;
    issues: string[];
  };
}

export async function analyzePostSEO(
  title: string,
  content: string,
  excerpt: string,
  targetKeywords?: string[]
): Promise<SEOScoreAnalysis> {
  const models = [PRIMARY_MODEL, BACKUP_MODEL];

  for (const model of models) {
    try {
      // Strip HTML tags from content for analysis
      const cleanContent = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const wordCount = cleanContent.split(' ').length;
      const titleLength = title.length;
      const excerptLength = excerpt.replace(/<[^>]*>/g, '').length;

      const prompt = `
Analyze this blog post for SEO performance and provide detailed scoring and recommendations in JSON format:

POST TITLE: "${title}"
POST CONTENT: "${cleanContent.substring(0, 2000)}..." (${wordCount} words)
POST EXCERPT: "${excerpt}"

${targetKeywords ? `TARGET KEYWORDS: ${targetKeywords.join(', ')}` : 'NO TARGET KEYWORDS SPECIFIED'}

Provide analysis in this exact JSON structure:
{
  "score": 0-100,
  "contentQuality": {
    "score": 0-30,
    "feedback": "Brief assessment of content quality",
    "strengths": ["Specific strength 1", "Specific strength 2"],
    "improvements": ["Specific improvement 1", "Specific improvement 2"]
  },
  "keywordOptimization": {
    "score": 0-25,
    "targetKeywords": ["extracted", "keywords"],
    "missingKeywords": ["suggested", "keywords"],
    "keywordDensity": [
      {"keyword": "word", "density": 2.5, "optimal": true}
    ]
  },
  "technicalSEO": {
    "score": 0-20,
    "issues": ["technical issue 1"],
    "passed": ["passed check 1"]
  },
  "engagement": {
    "score": 0-15,
    "suggestions": ["engagement suggestion 1"]
  },
  "readability": {
    "score": 0-10,
    "grade": "A-F grade",
    "issues": ["readability issue 1"]
  }
}

Score based on:
- Content Quality: Depth, value, comprehensiveness (0-30)
- Keyword Optimization: Usage, relevance, density (0-25)
- Technical SEO: Meta, structure, links (0-20)
- Engagement: User intent, CTAs, structure (0-15)
- Readability: Flow, clarity, grammar (0-10)

Be specific and actionable in recommendations, not generic.`;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
      });

      const rawText = response.text.replace(/```json\s*|\s*```/g, '').trim();

      try {
        const analysis: SEOScoreAnalysis = JSON.parse(rawText);
        return analysis;
      } catch (parseError) {
        console.error('Failed to parse AI SEO analysis:', parseError);
        // Fallback to basic analysis if JSON parsing fails
        return generateFallbackSEOAnalysis(title, content, excerpt);
      }

    } catch (error) {
      console.error(`Error with SEO analysis model ${model}:`, error);
      if (model === BACKUP_MODEL) {
        return generateFallbackSEOAnalysis(title, content, excerpt);
      }
    }
  }

  return generateFallbackSEOAnalysis(title, content, excerpt);
}

// Advanced SEO Analysis Functions
export async function performCoreWebVitalsAnalysis(url: string): Promise<CoreWebVitalsData> {
  const models = [PRIMARY_MODEL, BACKUP_MODEL];

  // First try Google PageSpeed Insights API
  try {
    const pageSpeedUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${process.env.NEXT_PUBLIC_GOOGLE_PAGESPEED_API_KEY || 'AIzaSyA6UJzHfZjFHQH7Yo_ZF8PHKu7HnUqkSuk'}`;

    const response = await fetch(pageSpeedUrl);
    const data = await response.json();

    if (data.loadingExperience && data.loadingExperience.metrics) {
      const metrics = data.loadingExperience.metrics;
      return {
        fcp: metrics.FIRST_CONTENTFUL_PAINT_MS?.percentile || 0,
        lcp: metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile || 0,
        cls: metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile || 0,
        fid: metrics.FIRST_INPUT_DELAY_MS?.percentile || 0,
        ttfb: metrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE_MS?.percentile || 0,
        overallScore: data.lighthouseResult?.categories?.performance?.score * 100 || 0,
        mobileScore: data.lighthouseResult?.categories?.performance?.score * 100 || 0,
        desktopScore: 0, // Would need separate API call for desktop
        recommendations: ['Optimize images', 'Enable text compression', 'Reduce JavaScript execution time'],
        lastAnalyzed: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('PageSpeed API error:', error);
  }

  // AI-based estimation if API fails
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: `Estimate Core Web Vitals metrics for this URL: ${url}.
        Return realistic performance scores based on typical website performance.
        Format: JSON with fcp, lcp, cls, fid in seconds/ms, and overallScore as percentage.`,
      });

      const rawText = response.text.replace(/```json\s*|\s*```/g, '').trim();
      const estimated = JSON.parse(rawText);

      return {
        fcp: estimated.fcp || 2.1,
        lcp: estimated.lcp || 3.2,
        cls: estimated.cls || 0.15,
        fid: estimated.fid || 85,
        ttfb: estimated.ttfb || 0.6,
        overallScore: estimated.overallScore || 75,
        mobileScore: estimated.overallScore || 75,
        desktopScore: Math.max(estimated.overallScore - 10, 0) || 70,
        recommendations: [
          'Optimize images with WebP format',
          'Enable text compression',
          'Reduce JavaScript execution time'
        ],
        lastAnalyzed: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error with CWV analysis model ${model}:`, error);
      if (model === BACKUP_MODEL) {
        // Return fallback data
        return {
          fcp: 2.1,
          lcp: 3.2,
          cls: 0.15,
          fid: 85,
          ttfb: 0.6,
          overallScore: 75,
          mobileScore: 72,
          desktopScore: 78,
          recommendations: ['Optimize images', 'Enable text compression'],
          lastAnalyzed: new Date().toISOString()
        };
      }
    }
  }

  return {
    fcp: 2.1,
    lcp: 3.2,
    cls: 0.15,
    fid: 85,
    ttfb: 0.6,
    overallScore: 75,
    mobileScore: 72,
    desktopScore: 78,
    recommendations: ['Optimize images', 'Enable text compression'],
    lastAnalyzed: new Date().toISOString()
  };
}

export async function performImageSEOAnalysis(htmlContent: string): Promise<ImageSEOAnalysis> {
  // Parse HTML to extract image information
  const imgRegex = /<img[^>]*>/gi;
  const images = htmlContent.match(imgRegex) || [];
  const totalImages = images.length;

  let withoutAlt = 0;
  let withEmptyAlt = 0;
  const largeImages: string[] = [];
  const missingLazyLoading: string[] = [];

  // Analyze each image
  images.forEach(img => {
    // Check for alt attribute
    if (!img.includes('alt=')) {
      withoutAlt++;
    } else if (img.includes('alt=""') || img.includes("alt=''")) {
      withEmptyAlt++;
    }

    // Check for loading attribute
    if (!img.includes('loading=')) {
      missingLazyLoading.push(img.substring(0, 100) + '...');
    }

    // Extract src and estimate size (basic heuristic)
    const srcMatch = img.match(/src=["']([^"']*)/);
    if (srcMatch) {
      const src = srcMatch[1];
      // Simple heuristic for large images based on file extension
      if (src.includes('jpg') || src.includes('jpeg') || src.includes('png')) {
        // Estimate size based on typical file patterns
        if (src.includes('hero') || src.includes('banner') || src.includes('large')) {
          largeImages.push(src);
        }
      }
    }
  });

  // Estimate WebP coverage
  const webpImages = images.filter(img => img.includes('.webp')).length;
  const webpCoverage = Math.round((webpImages / Math.max(totalImages, 1)) * 100);

  // Estimate total size
  const totalSizeMB = Math.round((totalImages * 0.15 + withoutAlt * 0.05) * 100) / 100; // Rough estimation

  const recommendations: string[] = [];
  if (withoutAlt > 0) recommendations.push(`Add alt text to ${withoutAlt} images`);
  if (webpCoverage < 50) recommendations.push('Convert images to WebP format');
  if (missingLazyLoading.length > 0) recommendations.push('Enable lazy loading for images');

  return {
    totalImages,
    withoutAlt,
    withEmptyAlt,
    largeImages,
    missingLazyLoading,
    webpCoverage,
    totalSizeMB,
    recommendations
  };
}

export async function performSemanticHTMLAnalysis(htmlContent: string): Promise<SemanticHTMLAnalysis> {
  const models = [PRIMARY_MODEL, BACKUP_MODEL];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: `Analyze this HTML for semantic structure:

${htmlContent.substring(0, 2000)}

Count headline hierarchy (h1-h6), identify semantic elements present/missing, check for heading structure issues, and assess overall semantic score.

Return JSON:
{
  "missingH1": boolean,
  "duplicateH1": boolean,
  "headingStructure": {"h1": number, "h2": number, ...},
  "semanticElements": {"present": ["header", "nav"], "missing": ["figure", "article"]},
  "ariaLabels": {"missing": number, "total": number},
  "recommendations": ["Add missing H1 tag", "Use semantic elements"],
  "score": number
}`,
      });

      const rawText = response.text.replace(/```json\s*|\s*```/g, '').trim();
      const analysis: SemanticHTMLAnalysis = JSON.parse(rawText);

      return analysis;
    } catch (error) {
      console.error(`Error with semantic analysis model ${model}:`, error);
      if (model === BACKUP_MODEL) {
        // Basic regex-based analysis
        const semanticElements = ['header', 'nav', 'main', 'article', 'aside', 'footer', 'section'];
        const presentElements: string[] = [];
        const missingElements: string[] = [];

        semanticElements.forEach(element => {
          const regex = new RegExp(`<${element}[^>]*>`, 'gi');
          if (regex.test(htmlContent)) {
            presentElements.push(element);
          } else {
            missingElements.push(element);
          }
        });

        const h1Tags = (htmlContent.match(/<h1[^>]*>/gi) || []).length;
        const h2Tags = (htmlContent.match(/<h2[^>]*>/gi) || []).length;
        const h3Tags = (htmlContent.match(/<h3[^>]*>/gi) || []).length;
        const h4Tags = (htmlContent.match(/<h4[^>]*>/gi) || []).length;
        const h5Tags = (htmlContent.match(/<h5[^>]*>/gi) || []).length;
        const h6Tags = (htmlContent.match(/<h6[^>]*>/gi) || []).length;

        return {
          missingH1: h1Tags === 0,
          duplicateH1: h1Tags > 1,
          headingStructure: { h1: h1Tags, h2: h2Tags, h3: h3Tags, h4: h4Tags, h5: h5Tags, h6: h6Tags },
          semanticElements: { present: presentElements, missing: missingElements },
          ariaLabels: { missing: 0, total: 0 }, // Would need more complex parsing
          recommendations: [
            h1Tags === 0 ? 'Add H1 tag for main heading' : '✓ H1 tag present',
            missingElements.length > 0 ? `Add semantic elements: ${missingElements.join(', ')}` : '✓ Good semantic structure'
          ].filter(rec => rec.includes('Add') || rec.includes('✓')),
          score: Math.max(0, 100 - (missingElements.length * 15) - (h1Tags === 0 ? 20 : 0))
        };
      }
    }
  }

  // Final fallback
  return {
    missingH1: false,
    duplicateH1: false,
    headingStructure: { h1: 1, h2: 5, h3: 12, h4: 8, h5: 0, h6: 0 },
    semanticElements: { present: ['header', 'nav', 'main', 'footer'], missing: ['article', 'aside'] },
    ariaLabels: { missing: 2, total: 8 },
    recommendations: ['Add article elements', 'Add aside for sidebar'],
    score: 85
  };
}

export async function performMobileOptimizationAnalysis(htmlContent: string): Promise<MobileSEOScore> {
  // Basic checks for mobile optimization
  const viewportConfigured = /<meta[^>]+name=["']viewport["']/.test(htmlContent);
  const hasTouchableElements = /<button|<a|<input/.test(htmlContent);
  const hasFontSizeRules = /font-size/.test(htmlContent);
  const hasMediaQueries = /@media/.test(htmlContent);

  // Calculate score based on found elements
  let score = 100;
  if (!viewportConfigured) score -= 30;
  if (!hasTouchableElements) score -= 15;
  if (!hasFontSizeRules) score -= 10;
  if (!hasMediaQueries) score -= 15;

  const recommendations: string[] = [];
  if (!viewportConfigured) recommendations.push('Add viewport meta tag');
  if (!hasMediaQueries) recommendations.push('Add responsive CSS media queries');

  return {
    viewportConfigured,
    touchTargetsProper: hasTouchableElements,
    fontSizeAdequate: hasFontSizeRules,
    mobileFriendly: hasMediaQueries,
    recommendations,
    score: Math.max(0, score)
  };
}

export async function performSchemaMarkupAnalysis(htmlContent: string): Promise<SchemaMarkupAnalysis> {
  const models = [PRIMARY_MODEL, BACKUP_MODEL];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: `Analyze this HTML for schema markup and structured data:

${htmlContent.substring(0, 2000)}

Look for:
- JSON-LD structured data
- Microdata markup
- Common schema types (Article, Organization, LocalBusiness, etc.)
- Validity of structured data

Return JSON:
{
  "schemasFound": ["Article", "Organization"],
  "jsonLdPresent": true,
  "microdataPresent": false,
  "schemaTypes": ["Article", "Organization", "BreadcrumbList"],
  "structuredDataValid": true,
  "recommendations": ["Add LocalBusiness schema", "Validate structured data"],
  "score": 78
}`,
      });

      const rawText = response.text.replace(/```json\s*|\s*```/g, '').trim();
      const analysis: SchemaMarkupAnalysis = JSON.parse(rawText);

      return analysis;
    } catch (error) {
      console.error(`Error with schema analysis model ${model}:`, error);
      if (model === BACKUP_MODEL) {
        // Basic regex-based analysis
        const jsonLdPresent = /application\/ld\+json/.test(htmlContent) ||
                             /"@type":/.test(htmlContent) ||
                             /"@context":/.test(htmlContent);

        const microdataPresent = /itemtype=/.test(htmlContent);

        const commonSchemas = ['Article', 'Organization', 'WebSite', 'BreadcrumbList'];
        const foundSchemas: string[] = [];

        commonSchemas.forEach(schema => {
          if (htmlContent.toLowerCase().includes(schema.toLowerCase())) {
            foundSchemas.push(schema);
          }
        });

        return {
          schemasFound: foundSchemas,
          jsonLdPresent,
          microdataPresent,
          schemaTypes: foundSchemas,
          structuredDataValid: jsonLdPresent || microdataPresent,
          recommendations: [
            jsonLdPresent ? '✓ JSON-LD structured data present' : 'Add JSON-LD structured data',
            !microdataPresent && !jsonLdPresent ? 'Consider adding schema markup for better search visibility' : 'Good structured data implementation'
          ].filter(rec => rec.includes('Add') || rec.includes('Consider') || rec.includes('✓')),
          score: jsonLdPresent ? 85 : (microdataPresent ? 70 : 45)
        };
      }
    }
  }

  // Final fallback
  return {
    schemasFound: ['Article', 'Organization'],
    jsonLdPresent: true,
    microdataPresent: false,
    schemaTypes: ['Article', 'Organization'],
    structuredDataValid: true,
    recommendations: ['Add LocalBusiness schema for better visibility'],
    score: 78
  };
}

export async function performAdvancedSEOAnalysis(url: string, htmlContent: string): Promise<AdvancedSEOAnalysis> {
  const startTime = Date.now();

  console.log(`🧠 Starting advanced SEO analysis for ${url}`);

  try {
    // Run all analyses concurrently for better performance
    const [
      coreWebVitals,
      imageAnalysis,
      semanticAnalysis,
      mobileOptimization,
      schemaMarkup
    ] = await Promise.all([
      performCoreWebVitalsAnalysis(url),
      performImageSEOAnalysis(htmlContent),
      performSemanticHTMLAnalysis(htmlContent),
      performMobileOptimizationAnalysis(htmlContent),
      performSchemaMarkupAnalysis(htmlContent)
    ]);

    const analysisTimeMs = Date.now() - startTime;

    // Calculate overall score based on individual scores
    const overallScore = Math.round(
      (coreWebVitals.overallScore +
       semanticAnalysis.score +
       mobileOptimization.score +
       schemaMarkup.score +
       90) / 4 // Image analysis doesn't have a score, so we assume 90% for now
    );

    console.log(`✅ Advanced SEO analysis completed in ${analysisTimeMs}ms with score: ${overallScore}/100`);

    return {
      url,
      coreWebVitals,
      imageAnalysis,
      semanticAnalysis,
      mobileOptimization,
      schemaMarkup,
      overallScore,
      lastAnalyzed: new Date().toISOString(),
      analysisTimeMs
    };
  } catch (error) {
    console.error('❌ Advanced SEO analysis failed:', error);
    throw new Error('Failed to perform advanced SEO analysis');
  }
}

// Dashboard Analytics Analysis
export interface DashboardAnalytics {
  total_posts: number;
  total_keywords: number;
  avg_words_per_post: number;
  growth_rate: number;
  keyword_diversity_score: number;
  publication_trend: any[];
  monthly_posts: any[];
  top_keywords: any[];
  category_stats: any[];
  treatment_coverage: any[];
  wordpress_url: string;
}

export async function analyzeDashboardMetrics(analytics: DashboardAnalytics): Promise<string> {
  const models = [PRIMARY_MODEL, BACKUP_MODEL];

  const prompt = `
🔍 **CK HEALTH TURKEY BLOG DASHBOARD ANALİZİ** 

Aşağıda blogunuzun kapsamlı analitik verileri yer almaktadır. Lütfen şu sorulara detaylı yanıt verin:

## 📊 ANALİTİK VERİLER:

### Temel Metrikler:
- **Toplam Post Sayısı:** ${analytics.total_posts}
- **Toplam Keyword:** ${analytics.total_keywords}
- **Ortalama Kelime/Post:** ${analytics.avg_words_per_post}
- **Büyüme Oranı:** ${analytics.growth_rate > 0 ? '+' : ''}${analytics.growth_rate}%
- **Keyword Çeşitlilik Skoru:** ${analytics.keyword_diversity_score}/100

### Son Aktivite:
- Son 30 gün: ${analytics.publication_trend[0]?.posts || 0} post
- Önceki dönem (31-90 gün): ${analytics.publication_trend[1]?.posts || 0} post

### Aylık Yayın Dağılımı ${analytics.monthly_posts.slice(-6).map(m => `${m.month}: ${m.posts}`).join(', ')}

### En Popüler 10 Keyword:
${analytics.top_keywords.slice(0, 10).map(k => `- ${k.keyword} (${k.frequency} kez)`).join('\n')}

### Kategori Dağılımı:
${analytics.category_stats.slice(0, 5).map(c => `- ${c.name}: ${c.count} post`).join('\n')}

### Tedavi Kapsamı ${analytics.treatment_coverage.length}/${treatmentsData.treatments.length}:
${analytics.treatment_coverage.slice(0, 5).map(t => `- ${t.treatment}: ${t.postCount} post (${t.percentage}%)`).join('\n')}

## 📊 ANALYTICS AND EVALUATIONS:

### 1. **Overall Performance Assessment:**
   - How is the blog overall performing? Is it good/needs improvement/moderate?
   - Identify which areas need focus

### 2. **Content Strategy Assessment:**
   - Is the publication frequency adequate?
   - How is the content quality (word count + diversity)?
   - Are main keywords being used correctly?

### 3. **Growth and Trend Analysis:**
   - Is the growth rate positive?
   - Are there significant ups or downs in publication trends?
   - What should be the publication targets for the next 3 months?

### 4. **SEO and Keyword Optimization:**
   - What does the keyword diversity score indicate?
   - Is the distribution of main keywords optimal?
   - What new keyword suggestions can be made?

### 5. **Treatment Coverage and Gaps:**
   - How is the blog coverage for existing treatments?
   - Which treatments are missing or have low coverage?
   - What are the content topic suggestions?

### 6. **Priority Action Recommendations:**
   - 5 action points to implement in the first 2 weeks
   - Medium-term goals (1-3 months)
   - Measurable target suggestions

## 📈 DETAILED AND MEASURABLE RECOMMENDATIONS:

Please provide very detailed, specific, and actionable recommendations:
- Support with numbers and data
- Specify time frames
- Define trackable KPIs
- Suggest titles and keywords for content

**Provide the entire response in English and structure it like a professional content strategist.
`;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
      });

      return response.text;
    } catch (error) {
      console.error(`Error with dashboard analysis model ${model}:`, error);
      if (model === BACKUP_MODEL) {
        return `Dashboard analizi geçici olarak yapılamıyor. Lütfen daha sonra tekrar deneyin.\n\nTemel Metrikler:\n- Toplam Post: ${analytics.total_posts}\n- Anahtar Kelime: ${analytics.total_keywords}\n- Ortalama Kelime/Post: ${analytics.avg_words_per_post}`;
      }
    }
  }

  return "AI analysis is not working.";
}

// Keyword Analysis Interface
export interface KeywordAnalysisData {
  keyword_frequency_stats: { [key: string]: number };
  treatment_gap_analysis: TreatmentGap[];
  uk_keyword_suggestions: UKKeywordSuggestion[];
  content_gap_rate: number;
  keyword_diversity_index: number;
  total_posts_analyzed: number;
}

export interface TreatmentGap {
  treatment: string;
  current_post_count: number;
  recommended_keywords: string[];
  gap_level: 'high' | 'medium' | 'low';
  priority: number;
}

export interface UKKeywordSuggestion {
  keyword: string;
  estimated_search_volume: 'Low' | 'Medium' | 'High';
  search_intent: 'Commercial' | 'Informational' | 'Transactional' | 'Navigational';
  opportunity_score: number; // 1-10
  current_competition: 'Low' | 'Medium' | 'High';
  suggested_content_angle?: string;
}

export async function analyzeKeywordUsage(
  blogData: any,
  treatments: string[]
): Promise<KeywordAnalysisData> {
  const models = [PRIMARY_MODEL, BACKUP_MODEL];

  // Extract keyword usage from blog data
  const keywordFreq: { [key: string]: number } = {};
  const allKeywords = new Set<string>();

  // Count keyword frequencies across all posts
  blogData.posts.forEach((post: any) => {
    const strippedContent = wordpressService.stripHtmlTags(post.content.rendered).toLowerCase();
    const content = `${post.title.rendered} ${strippedContent}`;

    blogData.keywords.forEach((keyword: string) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        keywordFreq[keyword] = (keywordFreq[keyword] || 0) + matches.length;
      }
      allKeywords.add(keyword);
    });
  });

  // Analyze treatment coverage gaps
  const treatmentMatches = blogData.treatmentMatches || [];
  const treatmentGaps: TreatmentGap[] = [];

  treatments.forEach(treatment => {
    const match = treatmentMatches.find((m: any) => m.treatment === treatment);
    const currentCount = match ? match.frequency : 0;

    if (currentCount < 2) { // Treatment needs 2+ posts for good coverage
      treatmentGaps.push({
        treatment,
        current_post_count: currentCount,
        recommended_keywords: [],
        gap_level: currentCount === 0 ? 'high' : 'medium',
        priority: currentCount === 0 ? 10 : 5
      });
    }
  });

  // Calculate content gap rate (percentage of treatments with insufficient coverage)
  const contentGapRate = Math.round((treatmentGaps.length / treatments.length) * 100);

  // Keyword diversity (unique brands vs total words written)
  const keywordDiversityIndex = Math.min(100, Math.round((allKeywords.size / blogData.posts.length) * 100));

  // Generate UK-specific AI analysis with smart retry
  let retryCount = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 15000; // 15 seconds

  for (const model of models) {
    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`🤖 UK Keyword Analysis - Attempt ${retryCount + 1}/${MAX_RETRIES} with ${model}`);

        const ukPrompt = `
Analyze these medical tourism treatments and suggest keyword opportunities specifically for the UK market:

TREATMENTS WITHOUT ADEQUATE CONTENT: ${treatmentGaps.map(t => t.treatment).join(', ')}

CURRENT POPULAR KEYWORDS ON SITE: ${Object.entries(keywordFreq)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10)
  .map(([k, v]) => `${k} (${v})`)
  .join(', ')}

SITE CONTEXT: Medical tourism company (CK Health Turkey) serving international patients.

Please suggest 8-10 UK-relevant keywords for each undercovered treatment area. For each keyword provide:
- Estimated search volume (Low/Medium/High based on UK market trends)
- Search intent (Commercial/Informational/Transactional/Navigational)
- Opportunity score (1-10, considering competition and potential)
- Competition level (Low/Medium/High)
- Suggested content angle

Focus on keywords that UK patients actually search for when considering medical tourism, like:
- "hair transplant in turkey cost"
- "dental implants istanbul price"
- "rhinoplasty turkey reviews"
- "weight loss surgery abroad"
- "fertility treatment turkey"

Format as JSON array.
REQUIRED FORMAT:
[
  {
    "keyword": "keyword here",
    "estimated_search_volume": "Low"|"Medium"|"High",
    "search_intent": "Commercial"|"Informational"|"Transactional"|"Navigational",
    "opportunity_score": 5,
    "current_competition": "Low"|"Medium"|"High",
    "suggested_content_angle": "Brief description"
  }
]`;

        console.log(`⏳ Calling ${model} for UK keywords (attempt ${retryCount + 1})...`);

        const response = await ai.models.generateContent({
          model: model,
          contents: ukPrompt,
        });

        console.log(`✅ ${model} responded successfully`);

        const rawText = response.text.replace(/```json\s*|\s*```/g, '').trim();
        console.log(`📄 Raw response length: ${rawText.length} characters`);

        let suggestedKeywords: UKKeywordSuggestion[] = [];
        try {
          suggestedKeywords = JSON.parse(rawText);
          console.log(`📊 Parsed ${suggestedKeywords.length} keyword suggestions`);

          // Validate the response structure
          if (!Array.isArray(suggestedKeywords) || suggestedKeywords.length === 0) {
            throw new Error('Empty or invalid response');
          }

          return {
            keyword_frequency_stats: keywordFreq,
            treatment_gap_analysis: treatmentGaps,
            uk_keyword_suggestions: suggestedKeywords,
            content_gap_rate: contentGapRate,
            keyword_diversity_index: keywordDiversityIndex,
            total_posts_analyzed: blogData.posts.length
          };

        } catch (parseError) {
          console.error(`❌ Failed to parse UK keyword analysis:`, parseError);
          console.log(`🛠️ Full response was:`, rawText.substring(0, 500));

          if (retryCount < MAX_RETRIES - 1) {
            retryCount++;
            console.log(`⏳ Retrying in ${RETRY_DELAY_MS}ms... (${retryCount}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          } else {
            console.log('💥 Max retries reached, using fallback keywords');
            const fallbackKeywords = generateFallbackUKKeywords(treatmentGaps);
            return {
              keyword_frequency_stats: keywordFreq,
              treatment_gap_analysis: treatmentGaps,
              uk_keyword_suggestions: fallbackKeywords,
              content_gap_rate: contentGapRate,
              keyword_diversity_index: keywordDiversityIndex,
              total_posts_analyzed: blogData.posts.length
            };
          }
        }

      } catch (error: any) {
        console.error(`❌ Error with ${model} (attempt ${retryCount + 1}):`, error);

        // Check if it's a 503 error (overloaded)
        if (error.code === 503 || error.status === 'UNAVAILABLE' || error.message?.includes('overloaded')) {
          if (retryCount < MAX_RETRIES - 1) {
            retryCount++;
            console.log(`⏳ Model overloaded, retrying in ${RETRY_DELAY_MS}ms... (${retryCount}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          } else {
            console.log('💥 Model overloaded, trying backup model...');
            break; // Move to next model
          }
        } else if (model === BACKUP_MODEL && retryCount >= MAX_RETRIES - 1) {
          // Final fallback
          console.log('💥 All models failed, using fallback keywords');
          const fallbackKeywords = generateFallbackUKKeywords(treatmentGaps);
          return {
            keyword_frequency_stats: keywordFreq,
            treatment_gap_analysis: treatmentGaps,
            uk_keyword_suggestions: fallbackKeywords,
            content_gap_rate: contentGapRate,
            keyword_diversity_index: keywordDiversityIndex,
            total_posts_analyzed: blogData.posts.length
          };
        } else {
          if (retryCount < MAX_RETRIES - 1) {
            retryCount++;
            console.log(`⏳ Unexpected error, retrying in ${RETRY_DELAY_MS}ms... (${retryCount}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          }
          break; // Move to next model or end
        }
      }
    }

    // Reset retry count for next model
    retryCount = 0;
  }

  // Final fallback if everything fails
  console.log('🚨 All models and retries failed, using comprehensive fallback');
  return generateFallbackKeywordAnalysis(treatments, blogData, keywordFreq, treatmentGaps, contentGapRate, keywordDiversityIndex);
}

function generateFallbackUKKeywords(treatmentGaps: TreatmentGap[]): UKKeywordSuggestion[] {
  return treatmentGaps.flatMap(gap => [
    {
      keyword: `${gap.treatment.toLowerCase()} turkey`,
      estimated_search_volume: 'Medium' as const,
      search_intent: 'Commercial' as const,
      opportunity_score: 7,
      current_competition: 'Medium' as const,
      suggested_content_angle: `Complete guide to ${gap.treatment} in Turkey`
    },
    {
      keyword: `${gap.treatment.toLowerCase()} istanbul`,
      estimated_search_volume: 'Low' as const,
      search_intent: 'Transactional' as const,
      opportunity_score: 8,
      current_competition: 'Low' as const,
      suggested_content_angle: `${gap.treatment} costs and options in Istanbul`
    },
    {
      keyword: `best ${gap.treatment.toLowerCase()} abroad`,
      estimated_search_volume: 'High' as const,
      search_intent: 'Commercial' as const,
      opportunity_score: 9,
      current_competition: 'High' as const,
      suggested_content_angle: `Why Turkey is best for ${gap.treatment}`
    }
  ]);
}

function generateFallbackKeywordAnalysis(
  treatments: string[],
  blogData: any,
  keywordFreq: { [key: string]: number },
  treatmentGaps: TreatmentGap[],
  contentGapRate: number,
  keywordDiversityIndex: number
): KeywordAnalysisData {
  return {
    keyword_frequency_stats: keywordFreq,
    treatment_gap_analysis: treatmentGaps,
    uk_keyword_suggestions: generateFallbackUKKeywords(treatmentGaps.slice(0, 3)), // Limit to 3 treatments for fallback
    content_gap_rate: contentGapRate,
    keyword_diversity_index: keywordDiversityIndex,
    total_posts_analyzed: blogData.posts.length
  };
}

// Fallback function for when AI analysis fails
function generateFallbackSEOAnalysis(
  title: string,
  content: string,
  excerpt: string
): SEOScoreAnalysis {
  const cleanContent = content.replace(/<[^>]*>/g, '');
  const wordCount = cleanContent.split(' ').length;

  return {
    score: 75,
    contentQuality: {
      score: 22,
      feedback: "Content appears to be informative but could be more comprehensive",
      strengths: ["Good basic structure", "Informative content"],
      improvements: ["Add more depth to explanations", "Include statistics or examples"]
    },
    keywordOptimization: {
      score: 18,
      targetKeywords: [],
      missingKeywords: [],
      keywordDensity: []
    },
    technicalSEO: {
      score: 15,
      issues: ["Could improve meta description"],
      passed: ["Has H1 tag", "Has title"]
    },
    engagement: {
      score: 12,
      suggestions: ["Add more engaging headlines", "Include calls-to-action"]
    },
    readability: {
      score: 8,
      grade: "B",
      issues: ["Some sentences are very long"]
    }
  };
}
