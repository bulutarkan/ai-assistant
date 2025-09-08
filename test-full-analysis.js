import { GoogleGenAI } from '@google/genai';

const API_KEY = 'AIzaSyDBAwkFgkaYNMeXwUCgJTk5TXAzcZEz3OM';
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Simulate WordPress service logic
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
      console.log('📄 Empty page received, stopping pagination');
      hasMorePages = false;
      break;
    }

    allPosts.push(...posts);
    console.log(`✅ Page ${page}: ${posts.length} posts fetched (${allPosts.length} total)`);

    // Check if we got less than 50 posts (last page)
    if (posts.length < 50) {
      console.log('📄 Last page reached');
      hasMorePages = false;
    }

    page++;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`🎉 Total posts fetched: ${allPosts.length}`);
  return allPosts;
}

// Simulate treatment analysis
function analyzeTreatmentMatches(posts) {
  const treatments = [
    'Dental Care in Turkey',
    'Hair Transplant in Turkey',
    'Rhinoplasty in Turkey',
    'Hollywood Smile in Turkey',
    'Root Canal in Turkey'
  ];

  return treatments.map(treatment => {
    const treatmentLower = treatment.toLowerCase();
    const matchingPosts = posts.filter(post => {
      const title = post.title.rendered.toLowerCase();
      const content = post.content.rendered.toLowerCase();

      // More flexible matching
      const titleMatch = title.includes(treatmentLower) ||
                        treatmentLower.split(' in Turkey')[0].split(' ').some(word =>
                          title.includes(word)
                        );

      const contentMatch = content.includes(treatmentLower) ||
                          treatmentLower.split(' in Turkey')[0].split(' ').some(word =>
                            content.includes(word)
                          );

      return titleMatch || contentMatch;
    });

    return {
      treatment,
      posts: matchingPosts,
      frequency: matchingPosts.length
    };
  }).sort((a, b) => b.frequency - a.frequency);
}

async function testFullAnalysis() {
  console.log('🔬 Testing full keyword analysis with live data...');

  // Fetch all posts
  const posts = await fetchAllPosts();

  // Analyze treatments
  console.log('\n🩺 Treatment Analysis:');
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
    console.log('\n🤖 Testing AI keyword generation...');

    const ukPrompt = `
Generate keyword opportunities for UK market:

TREATMENTS: ${treatmentGaps.map(g => g.treatment).join(', ')}

Format as JSON array:
[
  {
    "keyword": "keyword here",
    "estimated_search_volume": "Low|Medium|High",
    "search_intent": "Commercial|Informational|Transactional|Navigational",
    "opportunity_score": 5,
    "current_competition": "Low|Medium|High",
    "suggested_content_angle": "Brief description"
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: ukPrompt,
    });

    const parsed = JSON.parse(response.text.replace(/```json\s*|\s*```/g, '').trim());
    console.log(`\n✅ Generated ${parsed.length} keywords:`);
    parsed.slice(0, 5).forEach((kw, i) => console.log(`${i+1}. ${kw.keyword} (${kw.estimated_search_volume}) - ${kw.search_intent}`));

    console.log(`\n🎉 SUCCESS: Real analysis with ${posts.length} posts produced ${parsed.length} keywords!`);
  }
}

testFullAnalysis();
