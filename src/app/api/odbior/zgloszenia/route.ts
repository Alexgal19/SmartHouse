import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOdbiorZgloszenia } from '@/lib/sheets';

export async function GET() {
    const session = await getSession();
    if (!session.isLoggedIn) {
        return NextResponse.json({ error: 'Nieautoryzowany dostęp.' }, { status: 401 });
    }

    try {
        const zgloszenia = await getOdbiorZgloszenia();
        const active = zgloszenia.filter(z => !z.deletedAt);
        const sorted = [...active].sort((a, b) =>
            b.dataZgloszenia.localeCompare(a.dataZgloszenia)
        );
        return NextResponse.json(sorted);
    } catch (error) {
        console.error('Błąd pobierania zgłoszeń odbioru:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Błąd serwera.' },
            { status: 500 }
        );
    }
}
