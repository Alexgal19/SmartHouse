"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ShieldCheck, ShieldAlert, Bell, BellOff, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(false);

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
  const lastChecked = snapshot ? Object.values(snapshot)[0]?.checkedAt : null;
  const totalAlerts = alerts?.totalAlerts ?? null;

  // Summary badges for collapsed state
  const guardOk = !!snapshot;
  const alertsOk = totalAlerts === 0;
  const alertsActive = totalAlerts !== null && totalAlerts > 0;

  return (
    <Card>
      {/* Header row — always visible */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors rounded-t-lg"
        onClick={() => setIsOpen(prev => !prev)}
      >
        <span className="text-sm font-semibold">Status systemu</span>
        <div className="flex items-center gap-3">
          {/* Data Guard badge */}
          <div className="flex items-center gap-1.5">
            {guardOk ? (
              <ShieldCheck className="h-4 w-4 text-green-500" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-xs text-muted-foreground">Data Guard</span>
            {lastChecked && (
              <span className="text-xs text-muted-foreground hidden sm:inline">· {timeAgo(lastChecked)}</span>
            )}
          </div>

          {/* Divider */}
          <span className="text-muted-foreground/40 text-xs">|</span>

          {/* Alerts badge */}
          <div className="flex items-center gap-1.5">
            {alertsOk ? (
              <BellOff className="h-4 w-4 text-green-500" />
            ) : alertsActive ? (
              <>
                <Bell className="h-4 w-4 text-red-500" />
                <Badge variant="destructive" className="text-xs h-5 px-1.5">{totalAlerts}</Badge>
              </>
            ) : (
              <Bell className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">Alerty</span>
          </div>

          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expandable content */}
      {isOpen && (
        <CardContent className="pt-0 pb-4 px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
            {/* Data Guard */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  {guardOk ? (
                    <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5 text-yellow-500" />
                  )}
                  Data Guard
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={e => { e.stopPropagation(); runDataGuard(); }}
                  disabled={runningGuard}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${runningGuard ? 'animate-spin' : ''}`} />
                  Sprawdź
                </Button>
              </div>
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
            </div>

            {/* Alerts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  {alertsOk ? (
                    <BellOff className="h-3.5 w-3.5 text-green-500" />
                  ) : alertsActive ? (
                    <Bell className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  Alerty biznesowe
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={e => { e.stopPropagation(); runAlerts(); }}
                  disabled={runningAlerts}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${runningAlerts ? 'animate-spin' : ''}`} />
                  Sprawdź
                </Button>
              </div>
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
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
