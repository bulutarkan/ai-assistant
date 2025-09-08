import { GoogleGenAI } from '@google/genai';

const API_KEY = 'AIzaSyDBAwkFgkaYNMeXwUCgJTk5TXAzcZEz3OM';
const ai = new GoogleGenAI({ apiKey: API_KEY });

async function testWordPressConnection() {
  const baseUrl = 'https://ckhealthturkey.com';

  try {
    console.log(`🌐 Testing WordPress API connection: ${baseUrl}`);

    // Test basic connection
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/posts?per_page=5&page=1&_embed`);
    console.log(`📡 WordPress API Status: ${response.status}`);

    if (!response.ok) {
      console.log(`❌ WordPress API connection failed: ${response.status}`);
      return;
    }

    const posts = await response.json();
    console.log(`📊 Found ${posts.length} posts on WordPress`);

    // Show sample post
    if (posts.length > 0) {
      console.log('\n📝 Sample Post:');
      console.log(`Title: ${posts[0].title.rendered}`);
      console.log(`Content length: ${posts[0].content.rendered.replace(/<[^>]*>/g, '').length} characters`);
    }

    // Check treatment matching logic
    console.log('\n🩺 Treatment Analysis Test:');

    const treatments = [
      'Dental Care in Turkey',
      'Hair Transplant in Turkey',
      'Rhinoplasty in Turkey'
    ];

    let totalMatches = 0;
    treatments.forEach(treatment => {
      const treatmentLower = treatment.toLowerCase();
      const matches = posts.filter(post => {
        const title = post.title.rendered.toLowerCase();
        const content = post.content.rendered.toLowerCase();

        const titleMatch = title.includes(treatmentLower);
        const contentMatch = content.includes(treatmentLower);

        return titleMatch || contentMatch;
      });

      console.log(`${treatment}: ${matches.length} matches`);
      totalMatches += matches.length;
    });

    console.log(`\n🎯 Total treatment matches: ${totalMatches}`);

    // Test keyword analysis with this data
    console.log('\n🤖 Testing keyword analysis function...');

    // Calculate treatment gaps (simplified version)
    const treatmentGaps = [];
    treatments.forEach(treatment => {
      const treatmentLower = treatment.toLowerCase();
      const matches = posts.filter(post => {
        const title = post.title.rendered.toLowerCase();
        const content = post.content.rendered.toLowerCase();
        return title.includes(treatmentLower) || content.includes(treatmentLower);
      });

      if (matches.length < 2) { // Less than 2 posts = gap
        treatmentGaps.push({
          treatment: treatment.replace(' in Turkey', ''),
          current_post_count: matches.length
        });
      }
    });

    console.log(`📈 Treatment gaps found: ${treatmentGaps.length}`);
    treatmentGaps.forEach(gap => {
      console.log(`  - ${gap.treatment}: ${gap.current_post_count} posts`);
    });

    // Test AI keyword generation with real data
    if (treatmentGaps.length > 0) {
      console.log('\n🎯 Calling AI for keyword generation...');

      const ukPrompt = `
Generate 8-10 UK-relevant keywords for each treatment gap:

TREATMENTS: ${treatmentGaps.map(g => g.treatment).join(', ')}

Format as JSON array:
[
  {
    "keyword": "keyword here",
    "estimated_search_volume": "Low/Medium/High",
    "search_intent": "Commercial/Informational/Transactional/Navigational",
    "opportunity_score": 5,
    "current_competition": "Low/Medium/High",
    "suggested_content_angle": "Brief description"
  }
]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: ukPrompt,
      });

      const parsed = JSON.parse(response.text.replace(/```json\s*|\s*```/g, '').trim());

      console.log(`✅ Generated ${parsed.length} keywords from AI`);
      console.log('\n🎯 Sample AI keywords:');
      parsed.slice(0, 3).forEach((kw, i) => {
        console.log(`${i+1}. ${kw.keyword} (${kw.estimated_search_volume}) - ${kw.search_intent}`);
      });

    }

  } catch (error) {
    console.log('❌ WordPress connection test failed:');
    console.log(error.message);
  }
}

testWordPressConnection();
