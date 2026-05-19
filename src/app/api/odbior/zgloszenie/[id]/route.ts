import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateOdbiorZgloszenie, softDeleteOdbiorZgloszenie, getOdbiorZgloszenia } from '@/lib/sheets';
import { format } from 'date-fns';

export async function DELETE(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session.isLoggedIn) {
        return NextResponse.json({ error: 'Nieautoryzowany dostęp.' }, { status: 401 });
    }
    // allow admin or non-driver (recruiter); pure drivers cannot delete
    if (!session.isAdmin && session.isDriver) {
        return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
    }

    const { id } = params;
    if (!id) {
        return NextResponse.json({ error: 'Brak ID zgłoszenia.' }, { status: 400 });
    }

    try {
        await softDeleteOdbiorZgloszenie(id, session.name ?? session.uid ?? '');
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Błąd usuwania zgłoszenia odbioru:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Błąd serwera.' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session.isLoggedIn) {
        return NextResponse.json({ error: 'Nieautoryzowany dostęp.' }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
        return NextResponse.json({ error: 'Brak ID zgłoszenia.' }, { status: 400 });
    }

    try {
        const body = await req.json() as {
            action: 'przyjmij' | 'odrzuc' | 'zakoncz' | 'update' | 'anuluj_zakonczenie';
            nastepnyKrok?: string;
            osoby?: string;
            numerTelefonu?: string;
            skad?: string;
            komentarzSkad?: string;
            iloscOsob?: string;
            komentarz?: string;
            zdjeciaUrls?: string;
        };

        const zgloszenia = await getOdbiorZgloszenia();
        const existing = zgloszenia.find(z => z.id === id);

        const updates: Record<string, string> = {};
        const changeLogEntries: Array<{ timestamp: string; userId: string; userName: string; changes: string }> = [];
        const nowIso = new Date().toISOString();

        if (body.action === 'przyjmij') {
            updates.status = 'W trakcie';
            updates.kierowcaId = session.uid ?? '';
            updates.kierowcaNazwa = session.name ?? '';
            updates.przyjeteAt = format(new Date(), 'yyyy-MM-dd HH:mm');
            changeLogEntries.push({ timestamp: nowIso, userId: session.uid ?? '', userName: session.name ?? '', changes: 'Przyjęto zgłoszenie' });
        } else if (body.action === 'odrzuc') {
            updates.status = 'Nieprzyjęte';
            updates.kierowcaId = '';
            updates.kierowcaNazwa = '';
            changeLogEntries.push({ timestamp: nowIso, userId: session.uid ?? '', userName: session.name ?? '', changes: 'Odrzucono zgłoszenie' });
        } else if (body.action === 'zakoncz') {
            updates.status = 'Zakończone';
            updates.dataZakonczenia = format(new Date(), 'yyyy-MM-dd HH:mm');
            updates.zakonczoneAt = format(new Date(), 'yyyy-MM-dd HH:mm');
            changeLogEntries.push({ timestamp: nowIso, userId: session.uid ?? '', userName: session.name ?? '', changes: 'Zakończono odbiór' });
        } else if (body.action === 'anuluj_zakonczenie') {
            if (!session.isAdmin) {
                return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
            }
            updates.status = 'W trakcie';
            updates.dataZakonczenia = '';
            updates.zakonczoneAt = '';
            changeLogEntries.push({ timestamp: nowIso, userId: session.uid ?? '', userName: session.name ?? '', changes: 'Admin anulował zakończenie' });
        } else if (body.action === 'update') {
            const diff: string[] = [];
            if (body.nastepnyKrok !== undefined && body.nastepnyKrok !== existing?.nastepnyKrok) diff.push(`Następny krok: ${existing?.nastepnyKrok || '-'} → ${body.nastepnyKrok || '-'}`);
            if (body.osoby !== undefined && body.osoby !== existing?.osoby) {
                const oldCount = JSON.parse(existing?.osoby || '[]').length;
                const newCount = JSON.parse(body.osoby || '[]').length;
                diff.push(`Lista osób: ${oldCount} → ${newCount}`);
            }
            if (body.numerTelefonu !== undefined && body.numerTelefonu !== existing?.numerTelefonu) diff.push('Zmieniono numer telefonu');
            if (body.skad !== undefined && body.skad !== existing?.skad) diff.push(`Zmieniono miejsce odbioru: ${existing?.skad} → ${body.skad}`);
            if (body.iloscOsob !== undefined && String(body.iloscOsob) !== String(existing?.iloscOsob)) diff.push(`Zmieniono ilość osób: ${existing?.iloscOsob} → ${body.iloscOsob}`);
            if (body.komentarz !== undefined && body.komentarz !== existing?.komentarz) diff.push('Zmieniono komentarz');
            if (body.zdjeciaUrls !== undefined && body.zdjeciaUrls !== existing?.zdjeciaUrls) diff.push('Zmieniono zdjęcia');
            if (diff.length > 0) {
                changeLogEntries.push({ timestamp: nowIso, userId: session.uid ?? '', userName: session.name ?? '', changes: diff.join('; ') });
            }
            if (body.nastepnyKrok !== undefined) updates.nastepnyKrok = body.nastepnyKrok;
            if (body.osoby !== undefined) updates.osoby = body.osoby;
            if (body.numerTelefonu !== undefined) updates.numerTelefonu = body.numerTelefonu;
            if (body.skad !== undefined) updates.skad = body.skad;
            if (body.komentarzSkad !== undefined) updates.komentarzSkad = body.komentarzSkad;
            if (body.iloscOsob !== undefined) updates.iloscOsob = body.iloscOsob;
            if (body.komentarz !== undefined) updates.komentarz = body.komentarz;
            if (body.zdjeciaUrls !== undefined) updates.zdjeciaUrls = body.zdjeciaUrls;
        } else {
            return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
        }

        // Append changeLog
        if (existing && changeLogEntries.length > 0) {
            const existingLog = (existing.changeLog ? JSON.parse(existing.changeLog) : []) as Array<{ timestamp: string; userId: string; userName: string; changes: string }>;
            existingLog.push(...changeLogEntries);
            updates.changeLog = JSON.stringify(existingLog);
        }

        await updateOdbiorZgloszenie(id, updates);

        return NextResponse.json({ success: true, updates });
    } catch (error) {
        console.error('Błąd aktualizacji zgłoszenia odbioru:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Błąd serwera.' },
            { status: 500 }
        );
    }
}
