"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ShieldCheck, ShieldAlert, Bell, BellOff, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { AlertDetailItem, AlertDetails } from '@/lib/alert-utils';
import { useLanguage } from '@/lib/i18n';
import type { TFunction } from '@/lib/i18n';

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

function getSheetLabel(sheet: string, t: TFunction): string {
  const map: Record<string, string> = {
    Employees: t('sheet.employees'),
    NonEmployees: t('sheet.nonEmployees'),
    Addresses: t('sheet.addresses'),
    Rooms: t('sheet.rooms'),
    AddressHistory: t('sheet.addressHistory'),
    BokResidents: t('sheet.bokResidents'),
    ControlCards: t('sheet.controlCards'),
    Coordinators: t('sheet.coordinators'),
  };
  return map[sheet] ?? sheet;
}

function getAlertLabel(key: string, t: TFunction): string {
  const map: Record<string, string> = {
    contractExpiry: t('alert.contractExpiry'),
    bokStatusInconsistency: t('alert.bokStatusInconsistency'),
    capacityExceeded: t('alert.capacityExceeded'),
    missingPaymentData: t('alert.missingPaymentData'),
    duplicatePersons: t('alert.duplicatePersons'),
  };
  return map[key] ?? key;
}

function timeAgo(isoDate: string, t: TFunction): string {
  const diff = Math.round((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (diff < 1) return t('time.justNow');
  if (diff < 60) return t('time.minutesAgo', { count: diff });
  const hours = Math.floor(diff / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  return t('time.daysAgo', { count: Math.floor(hours / 24) });
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
  const { t } = useLanguage();
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
      setError(t('dashboard.apiConnectionError'));
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
        <span className="text-sm font-semibold">{t('dashboard.systemStatus')}</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {guardOk
              ? <ShieldCheck className="h-4 w-4 text-green-500" />
              : <ShieldAlert className="h-4 w-4 text-yellow-500" />}
            <span className="text-xs text-muted-foreground">Data Guard</span>
            {lastChecked && (
              <span className="text-xs text-muted-foreground hidden sm:inline">· {timeAgo(lastChecked, t)}</span>
            )}
          </div>
          <span className="text-muted-foreground/40 text-xs">|</span>
          <div className="flex items-center gap-1.5">
            {alertsOk
              ? <BellOff className="h-4 w-4 text-green-500" />
              : alertsActive
                ? <><Bell className="h-4 w-4 text-red-500" /><Badge variant="destructive" className="text-xs h-5 px-1.5">{totalAlerts}</Badge></>
                : <Bell className="h-4 w-4 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">{t('dashboard.coordinatorAlerts')}</span>
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
                  {t('common.check')}
                </Button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              {loading && <p className="text-xs text-muted-foreground">{t('common.loading')}</p>}
              {snapshot ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {Object.entries(snapshot).flatMap(([sheet, data]) => {
                    if (sheet === 'Employees' && employeeStats) {
                      return [
                        <div key="emp-active" className="flex items-center justify-between py-0.5">
                          <span className="text-xs text-muted-foreground">{t('dashboard.employeesActive')}</span>
                          <Badge variant="secondary" className="text-xs font-mono h-5">{employeeStats.active}</Badge>
                        </div>,
                        <div key="emp-dismissed" className="flex items-center justify-between py-0.5">
                          <span className="text-xs text-muted-foreground">{t('dashboard.employeesDismissed')}</span>
                          <Badge variant="outline" className="text-xs font-mono h-5">{employeeStats.dismissed}</Badge>
                        </div>,
                      ];
                    }
                    return [
                      <div key={sheet} className="flex items-center justify-between py-0.5">
                        <span className="text-xs text-muted-foreground">{getSheetLabel(sheet, t)}</span>
                        <Badge variant="secondary" className="text-xs font-mono h-5">{data.rowCount}</Badge>
                      </div>,
                    ];
                  })}
                </div>
              ) : (
                !loading && <p className="text-xs text-muted-foreground">{t('dashboard.noSnapshot')}</p>
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
                  {t('dashboard.businessAlerts')}
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={e => { e.stopPropagation(); runAlerts(); }} disabled={runningAlerts}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${runningAlerts ? 'animate-spin' : ''}`} />
                  {t('common.check')}
                </Button>
              </div>
              {alerts ? (
                totalAlerts === 0 ? (
                  <p className="text-xs text-green-600 font-medium">{t('dashboard.noAlerts')}</p>
                ) : (
                  <div className="space-y-0.5">
                    {Object.entries(alerts.summary)
                      .filter(([, count]) => count > 0)
                      .map(([key, count]) => (
                        <AlertRow
                          key={key}
                          label={getAlertLabel(key, t)}
                          count={count}
                          items={alerts.details?.[key as keyof AlertDetails]}
                        />
                      ))}
                  </div>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.clickToRunAlerts')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
