import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST() {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sw-house.pl';
        const res = await fetch(`${baseUrl}/api/candidate-demand/retry`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.CRON_SECRET}`,
                'Content-Type': 'application/json',
            },
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[CandidateDemand Run] Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
