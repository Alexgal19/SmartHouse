import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { extractPassportData } from '@/ai/flows/extract-passport-data-flow';

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session.isLoggedIn) {
        return NextResponse.json({ error: 'Nieautoryzowany dostęp.' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('photo') as File;
        if (!file || file.size === 0) {
            return NextResponse.json({ error: 'Brak zdjęcia.' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString('base64');
        const mimeType = file.type || 'image/jpeg';
        const photoDataUri = `data:${mimeType};base64,${base64}`;

        const result = await extractPassportData({ photoDataUri });

        return NextResponse.json({
            imie: result.firstName,
            nazwisko: result.lastName,
            paszport: result.passportNumber,
        });
    } catch (error) {
        console.error('Błąd OCR:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Błąd OCR.' },
            { status: 500 }
        );
    }
}
