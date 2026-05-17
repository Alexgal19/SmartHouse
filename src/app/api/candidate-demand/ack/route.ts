import { NextRequest, NextResponse } from 'next/server';
import { acknowledgeCandidateDemandAction } from '@/lib/actions';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { demandId } = body;
        if (!demandId || typeof demandId !== 'string') {
            return NextResponse.json({ error: 'Missing demandId' }, { status: 400 });
        }
        const session = await getSession();
        const result = await acknowledgeCandidateDemandAction(demandId, session?.uid);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[CandidateDemand Ack] Error:', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
