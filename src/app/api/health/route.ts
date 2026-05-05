import { NextResponse } from 'next/server';
import { pingSheets } from '@/lib/sheets';

export async function GET() {
    const timestamp = new Date().toISOString();
    const start = Date.now();
    try {
        await pingSheets();
        return NextResponse.json({
            status: 'ok',
            timestamp,
            sheets: { status: 'ok', latencyMs: Date.now() - start },
        });
    } catch (error) {
        return NextResponse.json(
            {
                status: 'degraded',
                timestamp,
                sheets: {
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 503 }
        );
    }
}
