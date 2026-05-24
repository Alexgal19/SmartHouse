import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import admin from 'firebase-admin';
import '@/lib/firebase-admin'; // Ensure Firebase Admin is initialized

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session.isLoggedIn) {
        return NextResponse.json({ error: 'Nieautoryzowany dostęp.' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const photo = formData.get('photo') as File | null;

        if (!photo || !(photo instanceof File) || photo.size === 0) {
            return NextResponse.json({ error: 'Brak zdjęcia.' }, { status: 400 });
        }

        const buffer = Buffer.from(await photo.arrayBuffer());
        
        // Safety size check: 5MB maximum
        if (buffer.length > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'Zdjęcie jest za duże (maksymalnie 5MB)' }, { status: 400 });
        }

        const safeName = `passports/${Date.now()}_${photo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        const bucket = admin.storage().bucket();
        const file = bucket.file(safeName);

        await file.save(buffer, {
            metadata: {
                contentType: photo.type || 'image/jpeg',
            },
        });

        // Make the file accessible via signed URL for a long time
        const [publicUrl] = await file.getSignedUrl({
            action: 'read',
            expires: '01-01-2099',
        });

        return NextResponse.json({ url: publicUrl });
    } catch (error) {
        console.error('Błąd uploadu zdjęcia paszportu do Firebase Storage:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Nieznany błąd serwera.' },
            { status: 500 }
        );
    }
}
