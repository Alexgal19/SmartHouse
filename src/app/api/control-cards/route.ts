import { getControlCards } from '@/lib/sheets';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
    const session = await getSession();
    if (!session.isLoggedIn) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const cards = await getControlCards();
        return NextResponse.json(cards);
    } catch (error) {
        console.error('Error fetching control cards:', error);
        return NextResponse.json({ error: 'Failed to fetch control cards' }, { status: 500 });
    }
}
