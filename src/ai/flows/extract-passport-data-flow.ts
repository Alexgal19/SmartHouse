'use server';

import vision from '@google-cloud/vision';

export type ExtractPassportDataInput = {
  photoDataUri: string;
};

export type ExtractPassportDataOutput = {
  firstName: string;
  lastName: string;
};

// Remove the data URL prefix to get raw base64
function extractBase64(dataUrl: string) {
  const parts = dataUrl.split(',');
  if (parts.length > 1) {
    return parts[1];
  }
  return dataUrl;
}

export async function extractPassportData(input: ExtractPassportDataInput): Promise<ExtractPassportDataOutput> {
  try {
    const client = new vision.ImageAnnotatorClient();

    const request = {
      image: {
        content: extractBase64(input.photoDataUri),
      },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
    };

    const [result] = await client.annotateImage(request);
    const fullTextAnnotation = result.fullTextAnnotation;

    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      throw new Error("Nie wykryto żadnego tekstu na zdjęciu. Upewnij się, że zdjęcie jest ostre i dobrze oświetlone.");
    }

    const lines = fullTextAnnotation.text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    let lastName = '';
    let firstName = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      if (line.includes('surname') || line.includes('nazwisko') || line.includes('nom')) {
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const candidate = lines[j];
          if (candidate && !candidate.toLowerCase().includes('given') && !candidate.toLowerCase().includes('imiona') && candidate.length > 1) {
            lastName = candidate.replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ -]/g, '');
            break;
          }
        }
      }

      if (line.includes('given names') || line.includes('imiona') || line.includes('prénoms')) {
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const candidate = lines[j];
          if (candidate && !['m', 'f', 'm/m', 'f/k'].includes(candidate.toLowerCase()) && !candidate.toLowerCase().includes('nationality') && candidate.length > 1) {
            firstName = candidate.replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ -]/g, '');
            break;
          }
        }
      }
    }

    if (!lastName || !firstName) {
      console.warn("Could not find structured label fields, attempting fallback MRZ search within vision text...");
      const mrzText = lines.join('').replace(/\s/g, '');
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
      throw new Error("Skrypt nie mógł zlokalizować rubryki 'Nazwisko' i 'Imiona'. Upewnij się, że główna strona z danymi jest wyraźna.");
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
