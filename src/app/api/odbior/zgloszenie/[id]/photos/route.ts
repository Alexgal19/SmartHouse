import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateOdbiorZgloszenie, getOdbiorZgloszenia } from '@/lib/sheets';
import admin from 'firebase-admin';
import '@/lib/firebase-admin';

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session.isLoggedIn) {
        return NextResponse.json({ error: 'Nieautoryzowany dostęp.' }, { status: 401 });
    }
    if (!session.isAdmin && !session.isDriver) {
        return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
    }

    const { id } = params;
    if (!id) {
        return NextResponse.json({ error: 'Brak ID zgłoszenia.' }, { status: 400 });
    }

    try {
        const formData = await req.formData();
        const photoFiles = formData.getAll('zdjecia') as File[];

        const uploadedUrls: string[] = [];
        const bucket = admin.storage().bucket();

        for (const file of photoFiles) {
            if (!(file instanceof File) || file.size === 0) continue;
            
            const buffer = Buffer.from(await file.arrayBuffer());
            
            // Limit 5MB
            if (buffer.length > 5 * 1024 * 1024) continue;

            const safeName = `odbior_zdjecia/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const storageFile = bucket.file(safeName);

            await storageFile.save(buffer, {
                metadata: {
                    contentType: file.type || 'image/jpeg',
                },
            });

            const [publicUrl] = await storageFile.getSignedUrl({
                action: 'read',
                expires: '01-01-2099',
            });

            uploadedUrls.push(publicUrl);
        }

        if (uploadedUrls.length === 0) {
            return NextResponse.json({ error: 'Brak plików do wgrania.' }, { status: 400 });
        }

        const all = await getOdbiorZgloszenia();
        const zgloszenie = all.find(z => z.id === id);
        const existing = zgloszenie?.zdjeciaUrls ? zgloszenie.zdjeciaUrls.split(',').filter(Boolean) : [];
        const merged = [...existing, ...uploadedUrls].join(',');

        await updateOdbiorZgloszenie(id, { zdjeciaUrls: merged });

        return NextResponse.json({ success: true, zdjeciaUrls: merged, newUrls: uploadedUrls });
    } catch (error) {
        console.error('Błąd uploadu zdjęć:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Błąd serwera.' },
            { status: 500 }
        );
    }
}
