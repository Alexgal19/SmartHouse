import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { addOdbiorZgloszenieRow } from '@/lib/sheets';
import { uploadFileToDrive } from '@/lib/drive';
import { getSettings } from '@/lib/sheets';
import { sendPushNotification } from '@/lib/actions';
import { format } from 'date-fns';

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session.isLoggedIn) {
        return NextResponse.json({ error: 'Nieautoryzowany dostęp.' }, { status: 401 });
    }

    try {
        const formData = await req.formData();

        const numerTelefonu = formData.get('numerTelefonu') as string;
        const skad = formData.get('skad') as 'autobusowa' | 'pociagowa' | 'inne';
        const komentarzSkad = (formData.get('komentarzSkad') as string) ?? '';
        const iloscOsob = parseInt(formData.get('iloscOsob') as string, 10);
        const komentarz = (formData.get('komentarz') as string) ?? '';

        if (!numerTelefonu || !skad || isNaN(iloscOsob)) {
            return NextResponse.json({ error: 'Brakujące wymagane pola.' }, { status: 400 });
        }

        // Wgraj zdjęcia do Google Drive
        const photoFiles = formData.getAll('zdjecia') as File[];
        const uploadedUrls: string[] = [];

        for (const file of photoFiles) {
            if (!(file instanceof File) || file.size === 0) continue;
            const buffer = Buffer.from(await file.arrayBuffer());
            const safeName = `odbior_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const result = await uploadFileToDrive(safeName, file.type || 'image/jpeg', buffer);
            if (result.url) {
                uploadedUrls.push(result.url);
            }
        }

        const zgloszenie = await addOdbiorZgloszenieRow({
            dataZgloszenia: format(new Date(), 'yyyy-MM-dd HH:mm'),
            numerTelefonu,
            skad,
            komentarzSkad,
            iloscOsob,
            komentarz,
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

        // Notify drivers with push subscriptions
        try {
            const settings = await getSettings();
            const drivers = settings.coordinators.filter(c => c.isDriver && c.pushSubscription);
            const title = 'Nowe zgłoszenie odbioru';
            const body = `${skad === 'autobusowa' ? 'Stacja autobusowa' : skad === 'pociagowa' ? 'Stacja pociągowa' : 'Inne'} — ${iloscOsob} os., tel. ${numerTelefonu}`;
            await Promise.allSettled(
                drivers.map(d => sendPushNotification(d.uid, title, body, '/dashboard?view=odbior'))
            );
        } catch (e) {
            console.warn('[Odbiór] Failed to send driver notifications:', e);
        }

        return NextResponse.json({ success: true, zgloszenie });
    } catch (error) {
        console.error('Błąd dodawania zgłoszenia odbioru:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Nieznany błąd serwera.' },
            { status: 500 }
        );
    }
}
