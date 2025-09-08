import { GoogleGenAI } from '@google/genai';

const API_KEY = 'AIzaSyDBAwkFgkaYNMeXwUCgJTk5TXAzcZEz3OM';
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Simulate improved WordPress service logic
async function fetchAllPosts() {
  const baseUrl = 'https://ckhealthturkey.com';
  const allPosts = [];
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    console.log(`📄 Fetching WordPress posts page ${page}...`);

    const response = await fetch(`${baseUrl}/wp-json/wp/v2/posts?per_page=50&page=${page}&orderby=date&order=desc&_embed`);
    const posts = await response.json();

    if (posts.length === 0) {
      hasMorePages = false;
      break;
    }

    allPosts.push(...posts);
    console.log(`✅ Page ${page}: ${posts.length} posts fetched (${allPosts.length} total)`);

    if (posts.length < 50) {
      hasMorePages = false;
    }

    page++;
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`🎉 Total posts fetched: ${allPosts.length}`);
  return allPosts;
}

// Improved treatment analysis with better keyword specificity
function analyzeTreatmentMatches(posts) {
  const treatments = [
    'Dental Care in Turkey',
    'Hair Transplant in Turkey',
    'Rhinoplasty in Turkey',
    'Hollywood Smile in Turkey',
    'Root Canal in Turkey',
    'Weight Loss Surgery in Turkey',
    'Gynecomastia Surgery in Turkey'
  ];

  return treatments.map(treatment => {
    // Create more specific keywords for matching
    const baseTreatment = treatment.replace(' in Turkey', '');

    // More specific keywords - avoid common words
    let treatmentKeywords = [];
    if (baseTreatment === 'Dental Care') {
      treatmentKeywords = ['dental treatment', 'dental procedure', 'teeth care'];
    } else if (baseTreatment === 'Hair Transplant') {
      treatmentKeywords = ['hair transplant', 'hair restoration', 'follicular unit'];
    } else if (baseTreatment === 'Rhinoplasty') {
      treatmentKeywords = ['nose surgery', 'nose job', 'rhinoplasty', 'nasal surgery'];
    } else if (baseTreatment === 'Hollywood Smile') {
      treatmentKeywords = ['hollywood smile', 'celebrity smile', 'perfect smile'];
    } else if (baseTreatment === 'Root Canal') {
      treatmentKeywords = ['root canal', 'endodontic treatment'];
    } else if (baseTreatment === 'Weight Loss Surgery') {
      treatmentKeywords = ['bariatric surgery', 'weight loss operation', 'obesity surgery'];
    } else if (baseTreatment === 'Gynecomastia Surgery') {
      treatmentKeywords = ['gynecomastia', 'male breast reduction', 'moobs surgery'];
    } else {
      // Generic fallback for other treatments
      treatmentKeywords = [baseTreatment.toLowerCase().split(' ')[0]]; // Just first word
    }

    const matchingPosts = posts.filter(post => {
      const title = post.title.rendered.toLowerCase().replace(/[^\w\s]/g, ' ');
      const content = post.content.rendered.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\w\s]/g, ' ');

      // Check if title contains ANY of the specific treatment keywords
      const titleMatch = treatmentKeywords.some(keyword =>
        keyword.split(' ').every(word =>
          title.includes(word) && word.length > 2
        )
      );

      // Check if content contains specific keywords (more lenient)
      const contentMatch = treatmentKeywords.some(keyword =>
        keyword.split(' ').filter(word => word.length > 2).every(word =>
          content.includes(word)
        )
      );

      // Must contain "turkey" somewhere AND specific treatment keyword
      const hasTurkeyRelated = title.includes('turkey') || content.includes('turkey') ||
                              title.includes('turkiye') || content.includes('turkiye') ||
                              title.includes('medical') || content.includes('medical');

      return (titleMatch || contentMatch) && hasTurkeyRelated;
    });

    return {
      treatment,
      posts: matchingPosts,
      frequency: matchingPosts.length
    };
  }).sort((a, b) => b.frequency - a.frequency);
}

async function testFixedAnalysis() {
  console.log('🔧 Testing FIXED keyword analysis...');

  // Fetch all posts
  const posts = await fetchAllPosts();

  // Analyze treatments with improved logic
  console.log('\n🩺 Treatment Analysis (IMPROVED):');
  const treatmentMatches = analyzeTreatmentMatches(posts);

  treatmentMatches.forEach(match => {
    console.log(`${match.treatment}: ${match.frequency} matches`);
  });

  // Calculate gaps
  console.log('\n📈 Treatment Gaps:');
  const treatmentGaps = treatmentMatches.filter(match => match.frequency < 2).map(match => ({
    treatment: match.treatment.replace(' in Turkey', ''),
    current_post_count: match.frequency
  }));

  console.log(`Found ${treatmentGaps.length} gaps:`);
  treatmentGaps.forEach(gap => {
    console.log(`  - ${gap.treatment}: ${gap.current_post_count} posts`);
  });

  // Test AI keyword generation
  if (treatmentGaps.length > 0) {
    console.log('\n🤖 Testing AI keyword generation with real gaps...');

    const ukPrompt = `
UK market keyword suggestions needed for these treatments with insufficient coverage:

TREATMENTS NEEDING KEYWORDS: ${treatmentGaps.map(g => g.treatment).join(', ')}

Please generate 12-15 UK-relevant keyword suggestions TOTAL. For each keyword provide:
- Estimated UK search volume (Low/Medium/High)
- Search intent (Commercial/Informational/Transactional/Navigational)
- Opportunity score (1-10)
- Competition level (Low/Medium/High)
- Suggested content angle

Focus on authentic UK search terms like:
- "hair transplant turkey cost"
- "dental treatment istanbul"
- "nose job turkey reviews"
- "weight loss surgery abroad"

JSON format:
[
  {
    "keyword": "keyword here",
    "estimated_search_volume": "Low",
    "search_intent": "Commercial",
    "opportunity_score": 7,
    "current_competition": "Medium",
    "suggested_content_angle": "Guide for UK patients"
  }
]`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: ukPrompt,
      });

      const parsed = JSON.parse(response.text.replace(/```json\s*|\s*```/g, '').trim());
      console.log(`\n🎉 SUCCESS! Generated ${parsed.length} DYNAMIC keywords:`);
      parsed.slice(0, 10).forEach((kw, i) => {
        console.log(`${i+1}. ${kw.keyword} (${kw.estimated_search_volume}) - ${kw.search_intent}`);
      });

      console.log(`\n💫 Keyword generation is now WORKING with ${posts.length} posts and ${treatmentGaps.length} gaps!`);
    } catch (error) {
      console.log(`❌ AI parsing error, falling back to simple keywords...`);

      // Fallback simple keywords
      const fallbackKeywords = treatmentGaps.flatMap(gap => [
        {
          keyword: `${gap.treatment.toLowerCase().split(' ')[0]} turkey`,
          estimated_search_volume: 'Medium',
          search_intent: 'Commercial',
          opportunity_score: 6,
          current_competition: 'Medium',
          suggested_content_angle: `Guide to ${gap.treatment} in Turkey`
        }
      ]);

      console.log(`✅ Generated ${fallbackKeywords.length} fallback keywords (better than 9!):`);
      fallbackKeywords.forEach((kw, i) => {
        console.log(`${i+1}. ${kw.keyword}`);
      });
    }
  } else {
    console.log('✨ GOOD NEWS: All treatments have adequate coverage! No gaps found.');
  }
}

testFixedAnalysis();
