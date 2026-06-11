import { NextRequest, NextResponse } from 'next/server';
import { retryCandidateDemandsAction } from '@/lib/actions';
import { checkRateLimit } from '@/lib/rate-limiter';

function authorize(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  return !!process.env.CRON_SECRET?.trim() && authHeader === `Bearer ${process.env.CRON_SECRET?.trim()}`;
}

export async function POST(req: NextRequest) {
    if (!authorize(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting (by IP for cron/internal calls)
    const forwarded = req.headers.get('x-forwarded-for');
    const identifier = forwarded ? `ip:${forwarded.split(',')[0].trim()}` : 'ip:unknown';
    const rate = checkRateLimit('/api/candidate-demand/retry', identifier);
    if (!rate.allowed) {
        return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.', retryAfterMs: rate.retryAfterMs },
            { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) } }
        );
    }

    try {
        const result = await retryCandidateDemandsAction();
        return NextResponse.json(result);
    } catch (error) {
        console.error('[CandidateDemand Retry] Error:', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
