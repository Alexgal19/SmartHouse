import { NextRequest, NextResponse } from 'next/server';
import { retryCandidateDemandsAction } from '@/lib/actions';

function authorize(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  return !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
    if (!authorize(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const result = await retryCandidateDemandsAction();
        return NextResponse.json(result);
    } catch (error) {
        console.error('[CandidateDemand Retry] Error:', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
