import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey && typeof window === 'undefined') {
  console.warn('Warning: GOOGLE_GENAI_API_KEY is missing from environment variables.');
}

export const GEMINI_MODEL = 'googleai/gemini-2.0-flash';

export const ai = genkit({
  plugins: [googleAI({ apiKey })],
  model: GEMINI_MODEL,
});
