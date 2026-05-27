import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { addOdbiorZgloszenieRow } from '@/lib/sheets';
import admin from 'firebase-admin';
import '@/lib/firebase-admin';
import { getSettings } from '@/lib/sheets';
import { sendPushNotification } from '@/lib/actions';
import { format } from 'date-fns';

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session.isLoggedIn) {
        return NextResponse.json({ error: 'Nieautoryzowany dostęp.' }, { status: 401 });
    }
    if (!session.isAdmin && !session.isDriver) {
        return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
    }

    try {
        const formData = await req.formData();

        const numerTelefonu = formData.get('numerTelefonu') as string;
        const skad = formData.get('skad') as 'autobusowa' | 'pociagowa' | 'inne';
        const komentarzSkad = (formData.get('komentarzSkad') as string) ?? '';
        const iloscOsob = parseInt(formData.get('iloscOsob') as string, 10);
        const komentarz = (formData.get('komentarz') as string) ?? '';
        const hasPermit = formData.get('hasPermit') === 'true';
        const hasPesel = formData.get('hasPesel') === 'true';

        if (!numerTelefonu || !skad || isNaN(iloscOsob)) {
            return NextResponse.json({ error: 'Brakujące wymagane pola.' }, { status: 400 });
        }

        // Wgraj zdjęcia do Firebase Storage
        const photoFiles = formData.getAll('zdjecia');
        const uploadedUrls: string[] = [];
        const bucket = admin.storage().bucket();

        for (const file of photoFiles) {
            if (!file || typeof file === 'string') {
                console.warn('[Odbiór] Pominięto plik, ponieważ nie jest prawidłowym plikiem.');
                continue;
            }

            if (typeof file.arrayBuffer !== 'function' || file.size === 0) {
                console.warn('[Odbiór] Pominięto plik, ponieważ nie posiada metody arrayBuffer lub ma rozmiar 0.');
                continue;
            }
            
            const validFile = file;
            const buffer = Buffer.from(await validFile.arrayBuffer());
            
            // Limit 5MB
            if (buffer.length > 5 * 1024 * 1024) {
                return NextResponse.json({ error: `Plik ${validFile.name} jest za duży (maksymalnie 5MB)` }, { status: 400 });
            }

            const safeName = `odbior_zdjecia/${Date.now()}_${validFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            
            console.log(`[Odbiór] Rozpoczynam upload zdjęcia: ${safeName}, size: ${validFile.size}`);
            
            const storageFile = bucket.file(safeName);
            await storageFile.save(buffer, {
                metadata: {
                    contentType: validFile.type || 'image/jpeg',
                },
            });

            const [publicUrl] = await storageFile.getSignedUrl({
                action: 'read',
                expires: '01-01-2099',
            });

            console.log(`[Odbiór] Sukces uploadu: ${publicUrl}`);
            uploadedUrls.push(publicUrl);
        }

        const zgloszenie = await addOdbiorZgloszenieRow({
            dataZgloszenia: format(new Date(), 'yyyy-MM-dd HH:mm'),
            numerTelefonu,
            skad,
            komentarzSkad,
            iloscOsob,
            komentarz,
            hasPermit,
            hasPesel,
            zdjeciaUrls: uploadedUrls.join(','),
            rekruterId: session.uid ?? '',
            rekruterNazwa: session.name ?? '',
            status: 'Nieprzyjęte',
            kierowcaId: '',
            kierowcaNazwa: '',
            osoby: '[]',
            nastepnyKrok: '',
            dataZakonczenia: '',
            przyjeteAt: '',
            zakonczoneAt: '',
            deletedAt: '',
            deletedBy: '',
            changeLog: '',
        });

        // Fire push notifications in background — do NOT await, return response immediately
        const notifyTitle = 'Nowe zgłoszenie odbioru';
        const notifyBody = `${skad === 'autobusowa' ? 'Stacja autobusowa' : skad === 'pociagowa' ? 'Stacja pociągowa' : 'Inne'} — ${iloscOsob} os., tel. ${numerTelefonu}`;
        getSettings()
            .then(settings => {
                const drivers = settings.coordinators.filter(c => c.isDriver && c.pushSubscription);
                return Promise.allSettled(
                    drivers.map(d => sendPushNotification(d.uid, notifyTitle, notifyBody, '/dashboard?view=odbior'))
                );
            })
            .catch(e => console.warn('[Odbiór] Failed to send driver notifications:', e));

        return NextResponse.json({ success: true, zgloszenie });
    } catch (error) {
        console.error('Błąd dodawania zgłoszenia odbioru:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Nieznany błąd serwera.' },
            { status: 500 }
        );
    }
}
