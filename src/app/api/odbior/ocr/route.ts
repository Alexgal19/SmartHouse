import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { extractPassportData } from '@/ai/flows/extract-passport-data-flow';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session.isLoggedIn) {
        return NextResponse.json({ error: 'Nieautoryzowany dostęp.' }, { status: 401 });
    }
    if (!session.isAdmin && !session.isDriver) {
        return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
    }

    // Rate limiting
    const identifier = session.uid ? `u:${session.uid}` : `ip:unknown`;
    const rate = checkRateLimit('/api/odbior/ocr', identifier);
    if (!rate.allowed) {
        return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.', retryAfterMs: rate.retryAfterMs },
            { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) } }
        );
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
        const message = error instanceof Error ? error.message : 'Błąd OCR.';
        const isRateLimit = message.includes('Przekroczono limit') || message.includes('429') || message.toLowerCase().includes('too many requests');
        return NextResponse.json(
            { error: message },
            { status: isRateLimit ? 429 : 500 }
        );
    }
}
