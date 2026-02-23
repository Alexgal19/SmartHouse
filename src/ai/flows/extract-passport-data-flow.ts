import { parseMrz } from '@/lib/mrz/parsers';

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

    // We serve the Tesseract worker, WASM, and traineddata directly from Next.js /public directory
    const worker = await Tesseract.createWorker('mrz', 1, {
      logger: (m) => console.log('Tesseract:', m),
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/',
      langPath: '/model/', // path to mrz.traineddata.gz
    });

    // Run MRZ recognition
    const { data: { text } } = await worker.recognize(input.photoDataUri);
    await worker.terminate();

    // Use the optimized MRZ regex matching from web-mrz-reader
    const cleanText = text.replace(/(\r\n|\n|\r| )/gm, "");
    const regex = /[PIAC][A-Z<][A-Z]{3}[A-Z0-9<]+/;
    const mrzMatch = cleanText.match(regex);

    if (!mrzMatch || !mrzMatch[0]) {
      throw new Error("Nie odnaleziono poprawnej strefy MRZ na zdjęciu. Upewnij się, że dolny pasek paszportu jest dobrze widoczny i ostry.");
    }

    let mrzString = mrzMatch[0];
    let expectedLength: number;
    if (mrzString.length >= 90) expectedLength = 90;
    else if (mrzString.length >= 88) expectedLength = 88;
    else if (mrzString.length >= 72) expectedLength = 72;
    else {
      throw new Error("Odczytany kod MRZ ma nieprawidłową długość. Spróbuj poprawić ostrość zdjęcia.");
    }

    mrzString = mrzString.substring(0, expectedLength);
    const parsedData = parseMrz(mrzString);

    if (typeof parsedData === 'string') {
      throw new Error("Błąd zdekodowania danych MRZ: " + parsedData);
    }

    const { "Surname": lastName, "Given Names": firstName } = parsedData as any;

    if (!lastName && !firstName) {
      throw new Error("Nie udało się odczytać Imienia i Nazwiska. Upewnij się, że oświetlenie jest odpowiednie.");
    }

    const titleCase = (str: string) => str ? str.split(/[\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : "-";

    return {
      firstName: titleCase(firstName),
      lastName: titleCase(lastName)
    };

  } catch (err) {
    console.error("OCR Error:", err);
    throw err;
  }
}
