import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session.isLoggedIn) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { input, type } = await req.json() as { input: string; type: 'quick' | 'full' };
    if (!input || !type) {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    const hash = createHash('sha256').update(input).digest('hex');
    const expected = type === 'quick'
        ? process.env.PASSPORT_HASH_QUICK
        : process.env.PASSPORT_HASH_FULL;

    return NextResponse.json({ valid: hash === expected });
}
