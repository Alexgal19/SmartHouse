export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEmployees, getNonEmployees, getBokResidents, getSettings } from '@/lib/sheets';
import { extractAlertDetails } from '@/lib/alert-utils';

/** Alerty przefiltrowane do zalogowanego koordynatora */
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const uid = session.uid;

  try {
    const [employees, nonEmployees, bokResidents, settings] = await Promise.all([
      getEmployees(),
      getNonEmployees(),
      getBokResidents(),
      getSettings(),
    ]);

    const all = extractAlertDetails(employees, nonEmployees, bokResidents, settings.addresses);

    // Filter to this coordinator's people only
    const details = {
      contractExpiry:        all.contractExpiry.filter(d => d.coordinatorId === uid),
      bokStatusInconsistency: all.bokStatusInconsistency.filter(d => d.coordinatorId === uid),
      capacityExceeded:      all.capacityExceeded.filter(d => d.coordinatorIds?.includes(uid)),
      missingPaymentData:    all.missingPaymentData.filter(d => d.coordinatorId === uid),
      missingCheckInDate:    all.missingCheckInDate.filter(d => d.coordinatorId === uid),
      duplicatePersons:      all.duplicatePersons.filter(d =>
        d.coordinatorIds?.includes(uid) || d.coordinatorId === uid
      ),
    };

    return NextResponse.json({ checkedAt: new Date().toISOString(), details });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
