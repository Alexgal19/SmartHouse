'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export type ExtractPassportDataInput = {
  photoDataUri: string;
};

export type ExtractPassportDataOutput = {
  firstName: string;
  lastName: string;
  nationality: string;
  passportNumber: string;
};

function extractBase64AndMime(dataUrl: string): { base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: 'image/jpeg', base64: dataUrl };
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('429') || 
           msg.includes('too many requests') || 
           msg.includes('resource_exhausted') || 
           msg.includes('quota exceeded');
  }
  return false;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 2000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === maxAttempts) break;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[AI OCR] Próba ${attempt} nieudana (rate limit). Ponawiam za ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  if (isRateLimitError(lastError)) {
    throw new Error('Przekroczono limit zapytań do AI (429). Poczekaj minutę i spróbuj ponownie lub sprawdź limity w Google AI Studio.');
  }
  throw lastError;
}

export async function extractPassportData(input: ExtractPassportDataInput): Promise<ExtractPassportDataOutput> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Brak klucza GOOGLE_GENAI_API_KEY w konfiguracji.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Switching to gemini-2.5-flash as gemini-2.0-flash is hitting legacy quota limits (429)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const { base64, mimeType } = extractBase64AndMime(input.photoDataUri);

  const prompt = `You are an expert passport and ID document OCR system. Analyze this document image and extract the holder's full name.

## Step 1 — Identify the document type
Determine the country and document type (passport, ID card, residence permit, travel document).

## Step 2 — Read ALL name sources in the document
Read names from EVERY available source:
A) Visual Recognition Zone (VIZ) — the printed text fields on the document page
B) Machine Readable Zone (MRZ) — the 2 or 3 lines of uppercase characters at the bottom

## Step 3 — MRZ decoding rules (THE GOLD STANDARD)
The MRZ is the most reliable source for the structure of the name. Decode it exactly:
- The surname and given names are separated by "<<"
- Within given names, each single "<" is a space between names. CAPTURE ALL OF THEM.
- Within surnames, each single "<" is a space between name parts. CAPTURE ALL OF THEM.
- CRITICAL: Never truncate names. If there are 3 given names, return all 3.
- Examples:
  - "ESCOBAR<CALDERON<<JUAN<CARLOS<" → lastName: "Escobar Calderon", firstName: "Juan Carlos"
  - "GARCIA<LOPEZ<<MARIA<JOSE<ANGELICA<" → lastName: "Garcia Lopez", firstName: "Maria Jose Angelica"
  - "KUMAR<<ABHISHEK<SINGH<" → lastName: "Kumar", firstName: "Abhishek Singh"
  - "DOS<SANTOS<FERREIRA<<ANA<PAULA<" → lastName: "Dos Santos Ferreira", firstName: "Ana Paula"
  - "SINGH<<BALWINDER<" → lastName: "Singh", firstName: "Balwinder"
  - "VENKATA<SUBRAMANIAN<<SRINIVASA<RAGHAVAN<" → lastName: "Venkata Subramanian", firstName: "Srinivasa Raghavan"

## Step 3b — Special Handling for Complex Names
- **Latin American (e.g. Colombia, Mexico)**: Use BOTH surnames (Paternal and Maternal) as provided in MRZ or VIZ.
- **Indian**: If the "Surname" field is empty in VIZ, but MRZ has a name before "<<", use that as lastName. If MRZ has nothing before "<<", all names go into firstName.
- **Middle names**: ALWAYS include them in the "firstName" field. Do not ignore them.
- **Titles/Suffixes**: Ignore titles like "DR.", "MR.", "MRS.", but capture all legal names.

## Step 4 — Extract the nationality (country name)
- From MRZ line 1, positions 11–13 (3-letter ISO country code)
- Also cross-check VIZ "Nationality" / "Citizenship" field
- Return the country name IN POLISH. Common mappings:
  - UKR → "Ukraina", POL → "Polska", BLR → "Białoruś", IND → "Indie", COL → "Kolumbia"
  - MDA → "Mołdawia", GEO → "Gruzja", RUS → "Rosja", UZB → "Uzbekistan", KAZ → "Kazachstan"
  - VNM → "Wietnam", NPL → "Nepal", BGD → "Bangladesz", PAK → "Pakistan", PHL → "Filipiny"
  - ECU → "Ekwador", PER → "Peru", BRA → "Brazylia", VEN → "Wenezuela", ROU → "Rumunia"

## Step 5 — Extract the passport/document number
- From MRZ line 2, positions 1–9. Strip "<" fillers.
- Return the alphanumeric value, uppercase.

## Step 6 — Verification & Formatting
- Prefer MRZ for structure, VIZ for correct spelling/diacritics (ñ, ü, etc.).
- Capitalize properly (e.g. "Juan Carlos", "Escobar Calderon").
- **Constraint**: "firstName" must contain all given and middle names. "lastName" must contain all surname parts.

Respond with ONLY valid JSON:
{"firstName": "...", "lastName": "...", "nationality": "...", "passportNumber": "..."}`;

  const result = await withRetry(() =>
    model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
          data: base64,
        },
      },
    ])
  );

  const text = result.response.text().trim();

  // Strip markdown code blocks if present
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: { firstName?: string; lastName?: string; nationality?: string; passportNumber?: string };
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Nie udało się odczytać danych z dokumentu. Upewnij się, że zdjęcie jest wyraźne i dobrze oświetlone.');
  }

  const firstName = (parsed.firstName || '').trim();
  const lastName = (parsed.lastName || '').trim();
  const nationality = (parsed.nationality || '').trim();
  const passportNumber = (parsed.passportNumber || '').trim().replace(/[<\s]/g, '').toUpperCase();

  if (!firstName && !lastName) {
    throw new Error('Nie udało się rozpoznać imienia i nazwiska. Upewnij się, że zdjęcie jest ostre i strona z danymi jest widoczna.');
  }

  return { firstName, lastName, nationality, passportNumber };
}
