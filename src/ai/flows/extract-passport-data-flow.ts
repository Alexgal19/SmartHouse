'use server';

import vision from '@google-cloud/vision';

export type ExtractPassportDataInput = {
  photoDataUri: string;
};

export type ExtractPassportDataOutput = {
  firstName: string;
  lastName: string;
};

// --- Helper heuristics ---

// 1. Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
}

// 2. Geometry Bounding Box helpers
type Vertex = { x?: number | null; y?: number | null };
type BoundingPoly = { vertices?: Vertex[] | null };

function getCenterY(poly?: BoundingPoly | null): number {
  if (!poly || !poly.vertices || poly.vertices.length !== 4) return -1;
  const ys = poly.vertices.map(v => v.y || 0);
  return (Math.min(...ys) + Math.max(...ys)) / 2;
}

function getMinY(poly?: BoundingPoly | null): number {
  if (!poly || !poly.vertices || poly.vertices.length !== 4) return -1;
  return Math.min(...poly.vertices.map(v => v.y || 0));
}

function getMinX(poly?: BoundingPoly | null): number {
  if (!poly || !poly.vertices || poly.vertices.length !== 4) return -1;
  return Math.min(...poly.vertices.map(v => v.x || 0));
}

function extractBase64(dataUrl: string) {
  const parts = dataUrl.split(',');
  if (parts.length > 1) {
    return parts[1];
  }
  return dataUrl;
}

const SURNAME_LABELS = ['surname', 'nazwisko', 'nom', 'name', 'cognome', 'apellido', 'familienname'];
const GIVEN_NAMES_LABELS = ['given', 'names', 'imiona', 'prénoms', 'prenoms', 'first', 'vorname', 'nome', 'nombre'];

function isFuzzyMatch(word: string, dict: string[], maxDist: number = 2): boolean {
  const cleanWord = word.toLowerCase().replace(/[^a-zżółćęśąźń]/g, '');
  if (cleanWord.length < 3) return false;
  return dict.some(d => levenshtein(cleanWord, d) <= maxDist);
}

export async function extractPassportData(input: ExtractPassportDataInput): Promise<ExtractPassportDataOutput> {
  try {
    const client = new vision.ImageAnnotatorClient();

    const request = {
      image: { content: extractBase64(input.photoDataUri) },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
    };

    const [result] = await client.annotateImage(request);
    const textAnnotations = result.textAnnotations;

    if (!textAnnotations || textAnnotations.length === 0) {
      throw new Error("Nie wykryto żadnego tekstu na zdjęciu. Upewnij się, że zdjęcie jest ostre.");
    }

    // textAnnotations[0] is the entire text string, [1...] are individual words
    const words = textAnnotations.slice(1);

    let lastName = '';
    let firstName = '';

    // Find the labels
    const surnameLabelWord = words.find(w => w.description && isFuzzyMatch(w.description, SURNAME_LABELS, 2));
    const givenNameLabelWord = words.find(w => w.description && isFuzzyMatch(w.description, GIVEN_NAMES_LABELS, 2));

    // Heuristic: Extract values below the labels using geometry
    // Look for words that are positioned below the label (greater Y), but roughly aligned visually
    const extractValueBelow = (labelWord: typeof words[0] | undefined, excludeWords: string[] = []) => {
      if (!labelWord || !labelWord.boundingPoly) return '';

      const labelCenterY = getCenterY(labelWord.boundingPoly);
      const labelMinX = getMinX(labelWord.boundingPoly);
      if (labelCenterY === -1) return '';

      // Find words below this label
      // Assume text line height is roughly the height of the word box itself, say 10-50px 
      // We look for words whose min Y is below the label's center Y, but not too far down
      const wordsBelow = words.filter(w => {
        if (!w.boundingPoly || !w.description) return false;
        const wCenterY = getCenterY(w.boundingPoly);
        const wMinY = getMinY(w.boundingPoly);
        const wMinX = getMinX(w.boundingPoly);

        // It must be physically below
        if (wMinY <= labelCenterY) return false;

        // It shouldn't be too far below (e.g. max 180 pixels drop for next logical line)
        if (wCenterY > labelCenterY + 180) return false;

        // It should be roughly aligned to the left of the label, or slightly before it
        if (wMinX < labelMinX - 100) return false;

        // Strict Cleaning: Skip non-alphabetical noise, typical prefixes like F, M, F/K, nationality codes
        const clean = w.description.replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '');
        if (clean.length < 2) return false;
        if (['nationality', 'sex', 'm', 'f', 'm/m', 'f/k', 'pol', 'ukr', 'gbr'].includes(clean.toLowerCase())) return false;
        if (excludeWords.includes(clean.toLowerCase())) return false;

        return true;
      });

      // The remaining words might be on multiple lines. Group by Y proximity.
      if (wordsBelow.length === 0) return '';

      // Sort by Y first
      wordsBelow.sort((a, b) => getCenterY(a.boundingPoly!) - getCenterY(b.boundingPoly!));

      // Take the cluster of words that belong to the very first line below the label
      const firstLineY = getCenterY(wordsBelow[0].boundingPoly);
      const firstLineWords = wordsBelow.filter(w => Math.abs(getCenterY(w.boundingPoly!) - firstLineY) < 25); // 25px tolerance for same line

      // Sort the line left-to-right
      firstLineWords.sort((a, b) => getMinX(a.boundingPoly!) - getMinX(b.boundingPoly!));

      return firstLineWords.map(w => w.description?.replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ -]/g, '')).join(' ').trim();
    };

    lastName = extractValueBelow(surnameLabelWord);
    firstName = extractValueBelow(givenNameLabelWord, SURNAME_LABELS.concat(lastName.toLowerCase().split(' ')));

    // Fallback: If Geometry failed, attempt MRZ Regex on the full string block
    if (!lastName || !firstName) {
      console.warn("Could not find structured geometric fields, attempting fallback MRZ search...");
      const fullText = textAnnotations[0]?.description || "";
      const mrzText = fullText.replace(/\s/g, '');
      const regex = /[PIAC][A-Z<][A-Z]{3}[A-Z0-9<]+/;
      const mrzMatch = mrzText.match(regex);

      if (mrzMatch && mrzMatch[0]) {
        const mrzStr = mrzMatch[0];
        const nameMatch = mrzStr.match(/([A-Z]+(?:<[A-Z]+)*)<<([A-Z]+(?:<[A-Z]+)*)/);
        if (nameMatch) {
          lastName = nameMatch[1].replace(/</g, ' ').trim();
          firstName = nameMatch[2].replace(/</g, ' ').trim();
        }
      }
    }

    if (!lastName && !firstName) {
      throw new Error("Skrypt nie mógł zlokalizować rubryki 'Nazwisko' i 'Imiona'. Upewnij się, że główna strona z danymi jest ostra i dobrze oświetlona.");
    }

    const titleCase = (str: string) => str ? str.split(/[\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : "";

    return {
      firstName: titleCase(firstName),
      lastName: titleCase(lastName)
    };

  } catch (err) {
    console.error("OCR Error:", err);
    throw err;
  }
}

