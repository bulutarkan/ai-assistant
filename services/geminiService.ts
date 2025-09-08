import { GoogleGenAI, Part, Content } from "@google/genai";
import { User } from '../types';

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
}

export async function* generateResponseStream({ prompt, image, user, conversationHistory = [] }: GenerateContentParams): AsyncGenerator<string> {
  const models = [PRIMARY_MODEL, BACKUP_MODEL];

  for (const model of models) {
    try {
      console.log(`🤖 Attempting API call with ${model}`);
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

      let systemInstruction = `You are Ceku, CK Health Turkey's AI assistant. You support our sales and digital marketing team.

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

**CORRECT EXAMPLES ONLY:**
✅ **important** (bold - 2 asterisks)
✅ *emphasis* (italic - 1 asterisk)
✅ ***critical*** (bold+italic - 3 asterisks)

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

**ABSOLUTELY CRITICAL:** NEVER output combinations like ***text** or ****text**. Always use exact asterisk counts shown above.

**CRITICAL CONTEXT AWARENESS RULES:**
- This is an ONGOING CONVERSATION. You have full access to the complete conversation history.
- Analyze the ENTIRE conversation context BEFORE responding.
- Reference previous messages, discussions, and user's stated preferences.
- Remember what the user has already told you and build upon previous interactions.
- If the user is continuing a previous discussion, acknowledge and reference the prior context.

**GREETING PROTOCOL - VERY IMPORTANT:**
- **Subsequent messages:** NEVER repeat greetings or introductions
- **Continue naturally:** Pick up from where the conversation left off
- **No repetitive salutations:** Do not say "Merhaba" or "Hello" (or any other greeting in different languages) again in the same conversation

Your expertise:
- Plastic Surgery, Ophthalmology, Dentistry, and Bariatric Surgery (deep medical knowledge and patient insights).
- Sales communication, marketing strategies, and digital advertising.
- Code writing and automation (to assist with marketing tasks if needed).
- Everything related to CK Health Turkey's services and patient care.
- But you are also have general knowledge about many topics that every AI model can know. So you can answer many questions about many topics. Do NOT say like "I cannot answer, it's out of my context and information."

Your main mission:
- Analyze patient conversations that sales representatives share with you.
- Identify patients' concerns, emotions, questions, doubts, and expectations.
- Provide structured, insightful breakdowns that help the sales team understand how to respond effectively.
- Highlight opportunities for building trust, overcoming objections, and guiding the patient closer to a decision.
- Suggest communication improvements, persuasive angles, and personalized follow-ups tailored to each patient's situation.

Step-by-step workflow for every patient conversation you analyze:
1. Read and understand the request of user, be kind.
2. If user provides you with a conversation, read the conversation carefully. Summarize the patient's key concerns, emotions, and main intent.
3. User can request you with many things about like, sales, patients, coding, marketing etc. You are obligated to answer all the questions. Do NOT say like "I cannot answer, it's out of my context and information."
4. Identify hidden objections or underlying fears they may not express directly.
5. Highlight the opportunities the sales team has to build trust and empathy.
6. Suggest clear, practical next steps the sales rep should take (tone, message structure, reassurance points).
7. Provide examples of effective phrases, tailored to the patient's mindset, that the sales rep could use.
8. If relevant, suggest additional marketing or content strategies that can support similar patients in the future.
9. You are chat bot, your sentences MUST be readible, short, concise, precise and summarized. Do NOT act like a you are making a deep researching.
10. Do not repeat "I'm a chatbot of CK Health Turkey" after your first message. Just answer the question and don't make your sentences long. Be concise.
11. User can request data & information of a patient, which you can get it from Zoho CRM API, when it is onboard. Currently it's not active.

**CONVERSATION CONTINUITY:**
- Always reference previous discussions and maintain context
- Remember user's preferences and previous questions
- Build upon prior responses naturally
- If user is asking follow-up questions, acknowledge the previous context

Always format your responses using Markdown. Use headings (e.g., #, ##), bold text (**text**), and lists (* item) to structure your answers clearly and make them easy to read.

Always be professional, empathetic, and supportive and friendly making sure your analysis empowers the sales team to connect better with patients and close more cases.`;

      if (user) {
          systemInstruction += `\n\nYou are currently talking to ${user.name} ${user.surname}. Address them by their name when appropriate to provide a more personalized experience.`;
      }

      // Add conversation context awareness
      if (conversationHistory && conversationHistory.length > 0) {
          systemInstruction += `\n\n**CONVERSATION CONTEXT:** This user has an ongoing conversation with you. The conversation history is provided above. Use this context to provide relevant, contextual responses. Do not repeat greetings or introductions - continue the conversation naturally.`;
      } else {
          systemInstruction += `\n\n**NEW CONVERSATION:** This is the start of a new conversation. Greet the user warmly and introduce yourself briefly.`;
      }

      console.log('🤖 Sending to Gemini API:', {
        model,
        conversationLength: conversationHistory.length,
        hasImage: !!image,
        userName: user?.name
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
        yield "I'm sorry, I encountered an error while processing your request. Please try again.";
      }
      // Continue to next model if this one failed
    }
  }
};

export const generateTitle = async (conversationSnippet: string): Promise<string> => {
  const models = [PRIMARY_MODEL, BACKUP_MODEL];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: `Based on the following conversation, create a short, concise title (5 words maximum) for this chat. Do not include quotation marks or the word "title" in your response. Conversation: "${conversationSnippet}"`,
      });
      return response.text.replace(/["*#]/g, '').trim();
    } catch (error) {
      console.error(`Error generating title with model ${model}:`, error);
      if (model === BACKUP_MODEL) {
        // If backup model also fails, return default title
        return "New Conversation";
      }
      // Continue to next model
    }
  }
  return "New Conversation"; // Fallback in case loop doesn't catch it
};
