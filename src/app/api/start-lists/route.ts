import { getStartLists } from '@/lib/sheets';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
    const session = await getSession();
    if (!session.isLoggedIn) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const lists = await getStartLists();
        return NextResponse.json(lists);
    } catch (error) {
        console.error('Error fetching start lists:', error);
        return NextResponse.json({ error: 'Failed to fetch start lists' }, { status: 500 });
    }
}
