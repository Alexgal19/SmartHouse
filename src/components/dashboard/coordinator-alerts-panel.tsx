"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Bell, BellOff, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { AlertDetailItem, AlertDetails } from '@/lib/alert-utils';

interface MyAlerts {
  checkedAt: string;
  details: AlertDetails;
}

const ALERT_CONFIG: { key: keyof AlertDetails; label: string; icon: string }[] = [
  { key: 'contractExpiry',        label: 'Wygasające umowy',         icon: '📋' },
  { key: 'bokStatusInconsistency', label: 'Niespójny status BOK',    icon: '⚠️' },
  { key: 'capacityExceeded',      label: 'Przekroczona pojemność',   icon: '🏠' },
  { key: 'missingPaymentData',    label: 'Brak danych płatności NZ', icon: '💳' },
  { key: 'duplicatePersons',      label: 'Zdublowane osoby',         icon: '👥' },
];

function timeAgo(isoDate: string): string {
  const diff = Math.round((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (diff < 1) return 'przed chwilą';
  if (diff < 60) return `${diff} min temu`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h temu`;
  return `${Math.floor(hours / 24)}d temu`;
}

function DetailList({ items }: { items: AlertDetailItem[] }) {
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

function AlertRow({ icon, label, items }: { icon: string; label: string; items: AlertDetailItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        className="w-full flex items-center justify-between py-1.5 hover:bg-muted/40 rounded px-1 transition-colors"
        onClick={() => setOpen(p => !p)}
      >
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span>{icon}</span>
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <Badge variant="destructive" className="text-xs h-5">{items.length}</Badge>
          {open
            ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </div>
      </button>
      {open && <DetailList items={items} />}
    </div>
  );
}

export function CoordinatorAlertsPanel() {
  const [data, setData] = useState<MyAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch('/api/alerts/mine');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const AUTO_REFRESH_MS = 60 * 60 * 1000; // 1 hour

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => fetchAlerts(true), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCount = data
    ? Object.values(data.details).reduce((s, arr) => s + arr.length, 0)
    : null;

  const hasAlerts = totalCount !== null && totalCount > 0;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {hasAlerts
            ? <Bell className="h-4 w-4 text-red-500" />
            : totalCount === 0
              ? <BellOff className="h-4 w-4 text-green-500" />
              : <Bell className="h-4 w-4 text-muted-foreground" />}
          Moje alerty
          {hasAlerts && (
            <Badge variant="destructive" className="text-xs h-5 px-1.5">{totalCount}</Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {data?.checkedAt && (
            <span className="text-xs text-muted-foreground">{timeAgo(data.checkedAt)}</span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => fetchAlerts(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Odśwież
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Ładowanie...</p>
        ) : !data ? (
          <p className="text-xs text-destructive">Błąd ładowania alertów.</p>
        ) : totalCount === 0 ? (
          <p className="text-xs text-green-600 font-medium">✓ Brak alertów — wszystko OK</p>
        ) : (
          <div className="space-y-0.5">
            {ALERT_CONFIG.map(({ key, label, icon }) => (
              <AlertRow
                key={key}
                icon={icon}
                label={label}
                items={data.details[key]}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
