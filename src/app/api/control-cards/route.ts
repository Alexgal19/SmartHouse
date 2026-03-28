import { getControlCards } from '@/lib/sheets';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const cards = await getControlCards();
        return NextResponse.json(cards);
    } catch (error) {
        console.error('Error fetching control cards:', error);
        return NextResponse.json({ error: 'Failed to fetch control cards' }, { status: 500 });
    }
}
