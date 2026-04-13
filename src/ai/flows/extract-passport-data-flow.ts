'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export type ExtractPassportDataInput = {
  photoDataUri: string;
};

export type ExtractPassportDataOutput = {
  firstName: string;
  lastName: string;
};

function extractBase64AndMime(dataUrl: string): { base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: 'image/jpeg', base64: dataUrl };
}

export async function extractPassportData(input: ExtractPassportDataInput): Promise<ExtractPassportDataOutput> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Brak klucza GOOGLE_GENAI_API_KEY w konfiguracji.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const { base64, mimeType } = extractBase64AndMime(input.photoDataUri);

  const prompt = `You are a passport OCR specialist. Look at this document image carefully.

Extract ONLY:
1. The person's last name / surname (in Polish: Nazwisko)
2. The person's first name / given name (in Polish: Imię/Imiona — use only the first given name if multiple)

Rules:
- If this is a Polish passport or ID, look for fields labeled "Nazwisko" and "Imię" or "Imiona"
- If this is a foreign passport, look for fields labeled "Surname" and "Given names"
- You can also read the MRZ (machine-readable zone) at the bottom — it contains the name in uppercase with < separators
- Return ONLY valid name characters — letters, spaces, hyphens
- Capitalize properly (first letter uppercase, rest lowercase)
- If you cannot read the name clearly, return empty strings

Respond with ONLY valid JSON, no markdown, no explanation:
{"firstName": "...", "lastName": "..."}`;

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
        data: base64,
      },
    },
  ]);

  const text = result.response.text().trim();

  // Strip markdown code blocks if present
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: { firstName?: string; lastName?: string };
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Nie udało się odczytać danych z dokumentu. Upewnij się, że zdjęcie jest wyraźne i dobrze oświetlone.');
  }

  const firstName = (parsed.firstName || '').trim();
  const lastName = (parsed.lastName || '').trim();

  if (!firstName && !lastName) {
    throw new Error('Nie udało się rozpoznać imienia i nazwiska. Upewnij się, że zdjęcie jest ostre i strona z danymi jest widoczna.');
  }

  return { firstName, lastName };
}
