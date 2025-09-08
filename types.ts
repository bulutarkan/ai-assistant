export interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  avatar?: string; // base64 string
}

export enum MessageSender {
  USER = 'user',
  AI = 'ai',
}

export interface Message {
  id: string;
  sender: MessageSender;
  text: string;
  image?: string; // base64 string for images sent by user (for immediate preview)
  file?: {
    name: string;
    type: string;
    size: number;
    path?: string; // Supabase Storage path for file reference
  };
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface BlogAIConversation {
  id: string;
  title: string;
  messages: Message[];
  wordpressUrl?: string;
  createdAt: number;
}

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  base64: string;
  expiresAt: number; // timestamp
}

export interface ProjectTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number; // timestamp
  updatedAt?: number; // timestamp - for tracking when task was completed
}

// Advanced SEO Analysis Interfaces
export interface CoreWebVitalsData {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay
  ttfb: number; // Time to First Byte
  overallScore: number; // Lighthouse performance score
  mobileScore: number;
  desktopScore: number;
  recommendations: string[];
  lastAnalyzed: string;
}

export interface ImageSEOAnalysis {
  totalImages: number;
  withoutAlt: number;
  withEmptyAlt: number;
  largeImages: string[]; // URLs of images > 500KB
  missingLazyLoading: string[];
  webpCoverage: number; // Percentage of images in WebP format
  totalSizeMB: number;
  recommendations: string[];
}

export interface SemanticHTMLAnalysis {
  missingH1: boolean;
  duplicateH1: boolean;
  headingStructure: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
  };
  semanticElements: {
    present: string[];
    missing: string[];
  };
  ariaLabels: {
    missing: number;
    total: number;
  };
  recommendations: string[];
  score: number;
}

export interface MobileSEOScore {
  viewportConfigured: boolean;
  touchTargetsProper: boolean;
  fontSizeAdequate: boolean;
  mobileFriendly: boolean;
  recommendations: string[];
  score: number;
}

export interface SchemaMarkupAnalysis {
  schemasFound: string[];
  jsonLdPresent: boolean;
  microdataPresent: boolean;
  schemaTypes: string[];
  structuredDataValid: boolean;
  recommendations: string[];
  score: number;
}

export interface AdvancedSEOAnalysis {
  url: string;
  coreWebVitals: CoreWebVitalsData;
  imageAnalysis: ImageSEOAnalysis;
  semanticAnalysis: SemanticHTMLAnalysis;
  mobileOptimization: MobileSEOScore;
  schemaMarkup: SchemaMarkupAnalysis;
  overallScore: number;
  lastAnalyzed: string;
  analysisTimeMs: number;
}

// Blog Schedule Interfaces
export interface BlogScheduleItem {
  id: string;
  user_id: string;
  keyword: string;
  assigned_date: string;
  status: 'scheduled' | 'published' | 'draft';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleDragItem {
  id: string;
  type: 'keyword';
  keyword: string;
  recordId?: string;
  isScheduled?: boolean;
}
