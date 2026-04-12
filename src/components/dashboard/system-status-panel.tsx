"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ShieldCheck, ShieldAlert, Bell, BellOff } from 'lucide-react';

interface SheetSnapshot {
  rowCount: number;
  checkedAt: string;
}

interface DataGuardStatus {
  snapshot: Record<string, SheetSnapshot> | null;
}

interface AlertsSummary {
  totalAlerts: number;
  checkedAt: string;
  summary: {
    contractExpiry: number;
    bokStatusInconsistency: number;
    capacityExceeded: number;
    missingPaymentData: number;
    missingCheckInDate: number;
  };
}

const SHEET_LABELS: Record<string, string> = {
  Employees: 'Pracownicy',
  NonEmployees: 'NZ',
  Addresses: 'Adresy',
  Rooms: 'Pokoje',
  AddressHistory: 'Historia adresów',
  BokResidents: 'BOK',
  ControlCards: 'Karty kontrolne',
  Coordinators: 'Koordynatorzy',
};

const ALERT_LABELS: Record<string, string> = {
  contractExpiry: 'Wygasające umowy',
  bokStatusInconsistency: 'Niespójny status BOK',
  capacityExceeded: 'Przekroczona pojemność',
  missingPaymentData: 'Brak danych płatności NZ',
  missingCheckInDate: 'Brak daty zameldowania',
};

function timeAgo(isoDate: string): string {
  const diff = Math.round((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (diff < 1) return 'przed chwilą';
  if (diff < 60) return `${diff} min temu`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h temu`;
  return `${Math.floor(hours / 24)}d temu`;
}

export function SystemStatusPanel() {
  const [dataGuard, setDataGuard] = useState<DataGuardStatus | null>(null);
  const [alerts, setAlerts] = useState<AlertsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningGuard, setRunningGuard] = useState(false);
  const [runningAlerts, setRunningAlerts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/data-guard/status');
      if (res.ok) {
        const data = await res.json();
        setDataGuard(data);
      }
    } catch {
      setError('Błąd połączenia z API');
    } finally {
      setLoading(false);
    }
  };

  const runDataGuard = async () => {
    setRunningGuard(true);
    try {
      const res = await fetch('/api/data-guard/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDataGuard({ snapshot: Object.fromEntries(
          Object.entries(data.sheets as Record<string, number>).map(([k, v]) => [
            k, { rowCount: v as number, checkedAt: data.checkedAt }
          ])
        )});
      }
    } finally {
      setRunningGuard(false);
    }
  };

  const runAlerts = async () => {
    setRunningAlerts(true);
    try {
      const res = await fetch('/api/alerts/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } finally {
      setRunningAlerts(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const snapshot = dataGuard?.snapshot;
  const lastChecked = snapshot
    ? Object.values(snapshot)[0]?.checkedAt
    : null;

  const totalAlerts = alerts?.totalAlerts ?? null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Data Guard */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {snapshot ? (
              <ShieldCheck className="h-4 w-4 text-green-500" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-yellow-500" />
            )}
            Data Guard
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastChecked && (
              <span className="text-xs text-muted-foreground">{timeAgo(lastChecked)}</span>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={runDataGuard}
              disabled={runningGuard}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${runningGuard ? 'animate-spin' : ''}`} />
              Sprawdź
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {loading && <p className="text-xs text-muted-foreground">Ładowanie...</p>}
          {snapshot ? (
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(snapshot).map(([sheet, data]) => (
                <div key={sheet} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-muted-foreground">
                    {SHEET_LABELS[sheet] ?? sheet}
                  </span>
                  <Badge variant="secondary" className="text-xs font-mono h-5">
                    {data.rowCount}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <p className="text-xs text-muted-foreground">
                Brak snapshotu — kliknij &quot;Sprawdź&quot; aby zainicjować.
              </p>
            )
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {totalAlerts === 0 ? (
              <BellOff className="h-4 w-4 text-green-500" />
            ) : totalAlerts && totalAlerts > 0 ? (
              <Bell className="h-4 w-4 text-red-500" />
            ) : (
              <Bell className="h-4 w-4 text-muted-foreground" />
            )}
            Alerty biznesowe
          </CardTitle>
          <div className="flex items-center gap-2">
            {alerts?.checkedAt && (
              <span className="text-xs text-muted-foreground">{timeAgo(alerts.checkedAt)}</span>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={runAlerts}
              disabled={runningAlerts}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${runningAlerts ? 'animate-spin' : ''}`} />
              Sprawdź
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {alerts ? (
            totalAlerts === 0 ? (
              <p className="text-xs text-green-600 font-medium">✓ Brak alertów — wszystko OK</p>
            ) : (
              <div className="space-y-1">
                {Object.entries(alerts.summary)
                  .filter(([, count]) => count > 0)
                  .map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {ALERT_LABELS[key] ?? key}
                      </span>
                      <Badge variant="destructive" className="text-xs h-5">
                        {count}
                      </Badge>
                    </div>
                  ))}
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              Kliknij &quot;Sprawdź&quot; aby uruchomić skanowanie alertów.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
