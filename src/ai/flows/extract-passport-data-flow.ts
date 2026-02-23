export type ExtractPassportDataInput = {
  photoDataUri: string;
};

export type ExtractPassportDataOutput = {
  firstName: string;
  lastName: string;
};

export async function extractPassportData(input: ExtractPassportDataInput): Promise<ExtractPassportDataOutput> {
  try {
    const Tesseract = (await import('tesseract.js')).default;

    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => console.log('Tesseract:', m),
    });

    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
    });

    const { data: { text } } = await worker.recognize(input.photoDataUri);
    await worker.terminate();

    const result = parseMRZ(text);
    if (!result) {
      throw new Error("Nie znaleziono strefy MRZ lub nie udało się odczytać imienia i nazwiska. Spróbuj poprawić oświetlenie lub kadr.");
    }
    return result;

  } catch (err) {
    console.error("OCR Error:", err);
    throw err;
  }
}

function parseMRZ(text: string): { firstName: string, lastName: string } | null {
  const lines = text.split('\n').map(l => l.replace(/\\s/g, '').toUpperCase());

  for (let line of lines) {
    if (line.includes('<<')) {
      let namePart = line;

      // Check if it's the first line of Passport (P<POL...) or ID (I<POL...)
      // The first 5 chars are DocType (2) and Country (3).
      if (line.length >= 30) {
        if (/^(P<|I<|V<|P[A-Z]|I[A-Z]|V[A-Z])[A-Z<]{3}/.test(line)) {
          namePart = line.substring(5);
        }
      }

      const parts = namePart.split('<<');
      if (parts.length >= 2) {
        let lastName = parts[0].replace(/</g, ' ').trim();
        let firstName = parts[1].replace(/</g, ' ').trim();

        // Remove trailing or extra stuff
        lastName = lastName.replace(/[^A-Z ]/g, '');
        firstName = firstName.replace(/[^A-Z ]/g, '');

        if (lastName && firstName) {
          const titleCase = (str: string) => str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

          return {
            firstName: titleCase(firstName),
            lastName: titleCase(lastName)
          };
        }
      }
    }
  }
  return null;
}
