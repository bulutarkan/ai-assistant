import { GoogleGenAI } from '@google/genai';

const API_KEY = 'AIzaSyDBAwkFgkaYNMeXwUCgJTk5TXAzcZEz3OM';
const ai = new GoogleGenAI({ apiKey: API_KEY });

async function testUKKeywordGeneration() {
  console.log('🧪 Testing UK Keyword Generation...');

  const treatmentGaps = [
    { treatment: 'Dental Care' },
    { treatment: 'Hair Transplant' },
    { treatment: 'Rhinoplasty' }
  ];

  const ukPrompt = `
Analyze these medical tourism treatments and suggest keyword opportunities specifically for the UK market:

TREATMENTS WITHOUT ADEQUATE CONTENT: ${treatmentGaps.map(t => t.treatment).join(', ')}

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

  try {
    console.log('🤖 Calling Gemini API...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: ukPrompt,
    });

    console.log('✅ AI Response received');
    const rawText = response.text.replace(/```json\s*|\s*```/g, '').trim();
    console.log(`📄 Raw response length: ${rawText.length} characters`);
    console.log('📄 First 500 characters:');
    console.log(rawText.substring(0, 500) + '...');

    // Try to parse
    try {
      const parsed = JSON.parse(rawText);
      console.log(`📊 Parsed successfully: ${parsed.length} keywords`);

      // Show first 5 keywords
      console.log('\n🎯 Sample Keywords:');
      parsed.slice(0, 5).forEach((kw, i) => {
        console.log(`${i+1}. ${kw.keyword} (${kw.estimated_search_volume}) - ${kw.search_intent}`);
      });

      console.log(`\n🎉 Total keywords generated: ${parsed.length}`);
      console.log('✅ AI keyword generation is WORKING!');

    } catch (parseError) {
      console.log('❌ JSON Parse Error:');
      console.log(parseError.message);
      console.log('🛠️ Full response was:', rawText);
    }

  } catch (error) {
    console.log('❌ API Error:');
    console.log(error.message);
  }
}

testUKKeywordGeneration();
