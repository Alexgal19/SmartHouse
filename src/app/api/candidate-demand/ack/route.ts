import { NextRequest, NextResponse } from 'next/server';
import { acknowledgeCandidateDemandAction } from '@/lib/actions';
import { getSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { demandId } = body;
        if (!demandId || typeof demandId !== 'string') {
            return NextResponse.json({ error: 'Missing demandId' }, { status: 400 });
        }
        const session = await getSession();
        if (!session?.isLoggedIn) {
            return NextResponse.json({ error: 'Nieautoryzowany dostęp.' }, { status: 401 });
        }

        // Rate limiting
        const identifier = session?.uid ? `u:${session.uid}` : `ip:unknown`;
        const rate = checkRateLimit('/api/candidate-demand/ack', identifier);
        if (!rate.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.', retryAfterMs: rate.retryAfterMs },
                { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) } }
            );
        }

        const result = await acknowledgeCandidateDemandAction(demandId, session?.uid);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[CandidateDemand Ack] Error:', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
