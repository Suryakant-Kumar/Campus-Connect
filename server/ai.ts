import { GoogleGenAI, Type } from '@google/genai';

export interface IssueAnalysisResult {
  clarityScore: number; // 1-10
  improvedTitle: string;
  suggestedCategory: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  urgencyReason: string;
  isFlagged: boolean;
  flagReason: string | null;
  actionableSummary: string;
  tags: string[];
  aiProvider: 'gemini' | 'keyword_fallback';
}

const EMERGENCY_KEYWORDS = [
  'fire',
  'smoke',
  'spark',
  'electric shock',
  'electrocution',
  'gas leak',
  'burst pipe',
  'ceiling collapse',
  'flood',
  'sewage leak',
  'danger',
  'life hazard',
  'short circuit',
];

const HIGH_PRIORITY_KEYWORDS = [
  'water cut',
  'blackout',
  'no power',
  'broken lock',
  'theft',
  'urgent',
  'elevator stuck',
  'broken stairs',
  'water overflow',
];

const SPAM_KEYWORDS = ['buy crypto', 'free money', 'dating', 'viagra', 'test test test', 'asdfghjk', 'spam'];

/**
 * Robust fallback analyzer when Gemini API is unavailable or encounters an error.
 */
export function keywordAnalyzeIssue(title: string, description: string, userCategory: string): IssueAnalysisResult {
  const text = `${title} ${description}`.toLowerCase();

  // 1. Spam / Abusive check
  let isFlagged = false;
  let flagReason: string | null = null;

  for (const spam of SPAM_KEYWORDS) {
    if (text.includes(spam)) {
      isFlagged = true;
      flagReason = `Flagged for suspicious or repetitive pattern matching keyword: "${spam}"`;
      break;
    }
  }

  if (text.trim().length < 10) {
    isFlagged = true;
    flagReason = 'Description too brief or lacking intelligible context.';
  }

  // 2. Urgency check
  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  let urgencyReason = 'Standard campus service level request.';

  if (EMERGENCY_KEYWORDS.some((kw) => text.includes(kw))) {
    urgency = 'critical';
    urgencyReason = 'Detected immediate hazard or emergency safety risk.';
  } else if (HIGH_PRIORITY_KEYWORDS.some((kw) => text.includes(kw))) {
    urgency = 'high';
    urgencyReason = 'High impact issue affecting fundamental amenities or security.';
  } else if (text.includes('routine') || text.includes('aesthetic') || text.includes('minor') || text.includes('dust')) {
    urgency = 'low';
    urgencyReason = 'Minor or scheduled cosmetic maintenance.';
  }

  // 3. Category inference
  let suggestedCategory = userCategory || 'General Maintenance';
  if (text.includes('light') || text.includes('wire') || text.includes('fan') || text.includes('power') || text.includes('switch') || text.includes('circuit')) {
    suggestedCategory = 'Electricity';
  } else if (text.includes('pipe') || text.includes('tap') || text.includes('leak') || text.includes('drain') || text.includes('water') || text.includes('flush')) {
    suggestedCategory = 'Plumbing';
  } else if (text.includes('wifi') || text.includes('router') || text.includes('internet') || text.includes('lan') || text.includes('network')) {
    suggestedCategory = 'Internet/Wi-Fi';
  } else if (text.includes('garbage') || text.includes('dirty') || text.includes('clean') || text.includes('trash') || text.includes('smell') || text.includes('pest')) {
    suggestedCategory = 'Cleanliness';
  } else if (text.includes('lock') || text.includes('guard') || text.includes('cctv') || text.includes('gate') || text.includes('intruder')) {
    suggestedCategory = 'Security';
  }

  // 4. Tags
  const tags: string[] = [suggestedCategory.toLowerCase()];
  if (urgency === 'critical' || urgency === 'high') tags.push('high-priority');

  return {
    clarityScore: text.length > 50 ? 8 : 6,
    improvedTitle: title.trim().charAt(0).toUpperCase() + title.trim().slice(1),
    suggestedCategory,
    urgency,
    urgencyReason,
    isFlagged,
    flagReason,
    actionableSummary: `Inspect reported issue at specified location. Verify ${suggestedCategory} status and take appropriate measures.`,
    tags,
    aiProvider: 'keyword_fallback',
  };
}

/**
 * Main AI check function using Gemini server-side SDK, with graceful fallback.
 */
export async function analyzeIssueWithGemini(
  title: string,
  description: string,
  category: string,
  location: string
): Promise<IssueAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    return keywordAnalyzeIssue(title, description, category);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `You are the CampusConnect AI Assistant responsible for validating, triaging, and categorizing campus maintenance and facility issues.

Evaluate this reported campus issue:
- Title: "${title}"
- Description: "${description}"
- User Chosen Category: "${category}"
- Reported Location: "${location}"

Analyze the report thoroughly:
1. clarityScore: 1-10 assessing completeness, location accuracy, and description precision.
2. improvedTitle: A crisp, professional 4-10 word summary title.
3. suggestedCategory: One of: Electricity, Plumbing, Cleanliness, Internet/Wi-Fi, Security, Furniture/Carpentry, HVAC/AC, Noise, Structural, or General Maintenance.
4. urgency: 'low', 'medium', 'high', or 'critical' (critical = physical danger, electric shock, burst pipe, active fire, security threat).
5. urgencyReason: 1 sentence justification.
6. isFlagged: true if offensive, harassment, scam, gibberish, or joke submission.
7. flagReason: explanation if flagged, or null if legitimate.
8. actionableSummary: 1-2 sentence instructions for the assigned maintenance worker.
9. tags: 2-5 relevant keyword tags.`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API request timed out')), 2500)
    );

    const generatePromise = ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clarityScore: { type: Type.INTEGER, description: 'Score between 1 and 10' },
            improvedTitle: { type: Type.STRING },
            suggestedCategory: { type: Type.STRING },
            urgency: {
              type: Type.STRING,
              enum: ['low', 'medium', 'high', 'critical'],
            },
            urgencyReason: { type: Type.STRING },
            isFlagged: { type: Type.BOOLEAN },
            flagReason: { type: Type.STRING, nullable: true },
            actionableSummary: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'clarityScore',
            'improvedTitle',
            'suggestedCategory',
            'urgency',
            'urgencyReason',
            'isFlagged',
            'actionableSummary',
            'tags',
          ],
        },
      },
    });

    const response = (await Promise.race([generatePromise, timeoutPromise])) as any;

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty response from Gemini API');
    }

    const parsed = JSON.parse(responseText.trim());

    return {
      clarityScore: Math.max(1, Math.min(10, Number(parsed.clarityScore) || 7)),
      improvedTitle: parsed.improvedTitle || title,
      suggestedCategory: parsed.suggestedCategory || category,
      urgency: ['low', 'medium', 'high', 'critical'].includes(parsed.urgency) ? parsed.urgency : 'medium',
      urgencyReason: parsed.urgencyReason || 'Assessed by Campus AI model.',
      isFlagged: Boolean(parsed.isFlagged),
      flagReason: parsed.isFlagged ? parsed.flagReason || 'Flagged by AI safety guidelines.' : null,
      actionableSummary: parsed.actionableSummary || 'Inspect issue and report findings.',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [category],
      aiProvider: 'gemini',
    };
  } catch (error) {
    console.warn('Gemini API call failed or encountered error, falling back to keyword check:', error);
    return keywordAnalyzeIssue(title, description, category);
  }
}
