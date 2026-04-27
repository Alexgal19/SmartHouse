import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateOdbiorZgloszenie, deleteOdbiorZgloszenie } from '@/lib/sheets';
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
        await deleteOdbiorZgloszenie(id);
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
            action: 'przyjmij' | 'odrzuc' | 'zakoncz' | 'update';
            nastepnyKrok?: string;
            osoby?: string;
            numerTelefonu?: string;
            skad?: string;
            komentarzSkad?: string;
            iloscOsob?: string;
            komentarz?: string;
            zdjeciaUrls?: string;
        };

        const updates: Record<string, string> = {};

        if (body.action === 'przyjmij') {
            updates.status = 'W trakcie';
            updates.kierowcaId = session.uid ?? '';
            updates.kierowcaNazwa = session.name ?? '';
        } else if (body.action === 'odrzuc') {
            updates.status = 'Nieprzyjęte';
            updates.kierowcaId = '';
            updates.kierowcaNazwa = '';
        } else if (body.action === 'zakoncz') {
            updates.status = 'Zakończone';
            updates.dataZakonczenia = format(new Date(), 'yyyy-MM-dd HH:mm');
        } else if (body.action === 'update') {
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
