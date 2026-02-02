import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const apiKey = process.env.GOOGLE_GENAI_API_KEY;

if (!apiKey && typeof window === 'undefined') {
  console.warn('Warning: GOOGLE_GENAI_API_KEY is missing from environment variables.');
}

export const ai = genkit({
  plugins: [googleAI({ apiKey })],
  model: 'googleai/gemini-2.5-flash',
});
