"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ShieldCheck, ShieldAlert, Bell, BellOff, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { AlertDetailItem, AlertDetails } from '@/lib/alert-utils';

interface SheetSnapshot {
  rowCount: number;
  checkedAt: string;
}

interface DataGuardStatus {
  snapshot: Record<string, SheetSnapshot> | null;
}

interface EmployeeStats {
  active: number;
  dismissed: number;
  total: number;
}

interface AlertsSummary {
  totalAlerts: number;
  checkedAt: string;
  summary: Record<string, number>;
  details?: AlertDetails;
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
  duplicatePersons: 'Zdublowane osoby',
};

function timeAgo(isoDate: string): string {
  const diff = Math.round((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (diff < 1) return 'przed chwilą';
  if (diff < 60) return `${diff} min temu`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h temu`;
  return `${Math.floor(hours / 24)}d temu`;
}

function AlertDetailList({ items }: { items: AlertDetailItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-1 mb-2 ml-2 space-y-0.5 border-l-2 border-muted pl-3">
      {items.map((item) => (
        <div key={`${item.id}-${item.extra}`} className="flex items-center justify-between gap-2 py-0.5">
          <Link
            href={item.link}
            className="text-xs text-foreground hover:text-primary hover:underline truncate max-w-[180px] flex items-center gap-1"
          >
            {item.name}
            <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-50" />
          </Link>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{item.extra}</span>
        </div>
      ))}
    </div>
  );
}

function AlertRow({
  label,
  count,
  items,
}: {
  label: string;
  count: number;
  items?: AlertDetailItem[];
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  return (
    <div>
      <button
        type="button"
        className="w-full flex items-center justify-between py-1 hover:bg-muted/40 rounded px-1 transition-colors"
        onClick={() => setOpen(p => !p)}
      >
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          <Badge variant="destructive" className="text-xs h-5">{count}</Badge>
          {items && items.length > 0 && (
            open
              ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
              : <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </button>
      {open && items && <AlertDetailList items={items} />}
    </div>
  );
}

export function SystemStatusPanel() {
  const [dataGuard, setDataGuard] = useState<DataGuardStatus | null>(null);
  const [alerts, setAlerts] = useState<AlertsSummary | null>(null);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningGuard, setRunningGuard] = useState(false);
  const [runningAlerts, setRunningAlerts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const [guardRes, statsRes] = await Promise.all([
        fetch('/api/data-guard/status'),
        fetch('/api/employees/stats'),
      ]);
      if (guardRes.ok) setDataGuard(await guardRes.json());
      if (statsRes.ok) setEmployeeStats(await statsRes.json());
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
      if (res.ok) setAlerts(await res.json());
    } finally {
      setRunningAlerts(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const snapshot = dataGuard?.snapshot;
  const lastChecked = snapshot ? Object.values(snapshot)[0]?.checkedAt : null;
  const totalAlerts = alerts?.totalAlerts ?? null;
  const guardOk = !!snapshot;
  const alertsOk = totalAlerts === 0;
  const alertsActive = totalAlerts !== null && totalAlerts > 0;

  return (
    <Card>
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors rounded-t-lg"
        onClick={() => setIsOpen(prev => !prev)}
      >
        <span className="text-sm font-semibold">Status systemu</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {guardOk
              ? <ShieldCheck className="h-4 w-4 text-green-500" />
              : <ShieldAlert className="h-4 w-4 text-yellow-500" />}
            <span className="text-xs text-muted-foreground">Data Guard</span>
            {lastChecked && (
              <span className="text-xs text-muted-foreground hidden sm:inline">· {timeAgo(lastChecked)}</span>
            )}
          </div>
          <span className="text-muted-foreground/40 text-xs">|</span>
          <div className="flex items-center gap-1.5">
            {alertsOk
              ? <BellOff className="h-4 w-4 text-green-500" />
              : alertsActive
                ? <><Bell className="h-4 w-4 text-red-500" /><Badge variant="destructive" className="text-xs h-5 px-1.5">{totalAlerts}</Badge></>
                : <Bell className="h-4 w-4 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">Alerty</span>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {isOpen && (
        <CardContent className="pt-0 pb-4 px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
            {/* Data Guard */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  {guardOk
                    ? <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                    : <ShieldAlert className="h-3.5 w-3.5 text-yellow-500" />}
                  Data Guard
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={e => { e.stopPropagation(); runDataGuard(); }} disabled={runningGuard}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${runningGuard ? 'animate-spin' : ''}`} />
                  Sprawdź
                </Button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              {loading && <p className="text-xs text-muted-foreground">Ładowanie...</p>}
              {snapshot ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {Object.entries(snapshot).flatMap(([sheet, data]) => {
                    if (sheet === 'Employees' && employeeStats) {
                      return [
                        <div key="emp-active" className="flex items-center justify-between py-0.5">
                          <span className="text-xs text-muted-foreground">Pracownicy aktywni</span>
                          <Badge variant="secondary" className="text-xs font-mono h-5">{employeeStats.active}</Badge>
                        </div>,
                        <div key="emp-dismissed" className="flex items-center justify-between py-0.5">
                          <span className="text-xs text-muted-foreground">Pracownicy zwolnieni</span>
                          <Badge variant="outline" className="text-xs font-mono h-5">{employeeStats.dismissed}</Badge>
                        </div>,
                      ];
                    }
                    return [
                      <div key={sheet} className="flex items-center justify-between py-0.5">
                        <span className="text-xs text-muted-foreground">{SHEET_LABELS[sheet] ?? sheet}</span>
                        <Badge variant="secondary" className="text-xs font-mono h-5">{data.rowCount}</Badge>
                      </div>,
                    ];
                  })}
                </div>
              ) : (
                !loading && <p className="text-xs text-muted-foreground">Brak snapshotu — kliknij &quot;Sprawdź&quot; aby zainicjować.</p>
              )}
            </div>

            {/* Alerts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  {alertsOk
                    ? <BellOff className="h-3.5 w-3.5 text-green-500" />
                    : alertsActive
                      ? <Bell className="h-3.5 w-3.5 text-red-500" />
                      : <Bell className="h-3.5 w-3.5 text-muted-foreground" />}
                  Alerty biznesowe
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={e => { e.stopPropagation(); runAlerts(); }} disabled={runningAlerts}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${runningAlerts ? 'animate-spin' : ''}`} />
                  Sprawdź
                </Button>
              </div>
              {alerts ? (
                totalAlerts === 0 ? (
                  <p className="text-xs text-green-600 font-medium">✓ Brak alertów — wszystko OK</p>
                ) : (
                  <div className="space-y-0.5">
                    {Object.entries(alerts.summary)
                      .filter(([, count]) => count > 0)
                      .map(([key, count]) => (
                        <AlertRow
                          key={key}
                          label={ALERT_LABELS[key] ?? key}
                          count={count}
                          items={alerts.details?.[key as keyof AlertDetails]}
                        />
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
