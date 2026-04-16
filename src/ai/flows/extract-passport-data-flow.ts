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

  const prompt = `You are an expert passport and ID document OCR system. Analyze this document image and extract the holder's full name.

## Step 1 — Identify the document type
Determine the country and document type (passport, ID card, residence permit, travel document).

## Step 2 — Read ALL name sources in the document
Read names from EVERY available source:
A) Visual Recognition Zone (VIZ) — the printed text fields on the document page
B) Machine Readable Zone (MRZ) — the 2 or 3 lines of uppercase characters at the bottom

## Step 3 — MRZ decoding rules
The MRZ is the most reliable source. Decode it as follows:
- The surname and given names are separated by "<<"
- Within given names, each "<" is a space between names
- Within surnames, each "<" is a space between name parts
- Example: "ESCOBAR<CALDERON<<JUAN<CARLOS<" → surname: "Escobar Calderon", firstName: "Juan Carlos"
- Example: "GARCIA<LOPEZ<<MARIA<JOSE<" → surname: "Garcia Lopez", firstName: "Maria Jose"
- Example: "KOWALSKI<<ANNA<MARIA<" → surname: "Kowalski", firstName: "Anna Maria"
- Example: "KUMAR<<RAJESH<" → surname: "Kumar", firstName: "Rajesh"
- Example: "SHARMA<<AMIT<KUMAR<" → surname: "Sharma", firstName: "Amit Kumar"
- Example: "VENKATA<SUBRAMANIAN<<SRINIVASA<RAGHAVAN<" → surname: "Venkata Subramanian", firstName: "Srinivasa Raghavan"

## Step 3b — Indian passport special rules
Indian passports often have a unique name structure:
- The "Surname" field may contain a single family name OR be empty
- The "Given Name(s)" field may contain: first name + father's name, or multiple given names
- In MRZ, the surname section comes before "<<" — it is always the family/last name
- The given names section (after "<<") contains ALL other names — include every one of them
- Do NOT move parts of the given name into the surname or vice versa — follow the MRZ structure exactly

## Step 4 — Cross-verify and return
- If both MRZ and VIZ are readable, prefer MRZ for accuracy but verify with VIZ
- If only VIZ is readable, use VIZ
- Return ALL given names (first + middle names) — never truncate compound names
- Return ALL surname parts — many cultures use compound surnames (Latin American, Indian, Spanish, Portuguese)
- Preserve diacritics and special characters from the VIZ (ñ, ü, ć, ź, ø, etc.) — the MRZ strips them, so restore from VIZ when possible
- Capitalize properly: first letter of each word uppercase, rest lowercase (e.g. "Juan Carlos", not "JUAN CARLOS")
- Valid characters: letters (including accented), spaces, hyphens, apostrophes
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
