"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Bell, BellOff, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { AlertDetailItem, AlertDetails } from '@/lib/alert-utils';
import { useLanguage } from '@/lib/i18n';
import type { TFunction } from '@/lib/i18n';

interface MyAlerts {
  checkedAt: string;
  details: AlertDetails;
}

function getAlertConfig(t: TFunction): { key: keyof AlertDetails; label: string; icon: string }[] {
  return [
    { key: 'contractExpiry',        label: t('alert.contractExpiry'),         icon: '📋' },
    { key: 'bokStatusInconsistency', label: t('alert.bokStatusInconsistency'), icon: '⚠️' },
    { key: 'capacityExceeded',      label: t('alert.capacityExceeded'),        icon: '🏠' },
    { key: 'missingPaymentData',    label: t('alert.missingPaymentData'),      icon: '💳' },
    { key: 'duplicatePersons',      label: t('alert.duplicatePersons'),        icon: '👥' },
  ];
}

function timeAgo(isoDate: string, t: TFunction): string {
  const diff = Math.round((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (diff < 1) return t('time.justNow');
  if (diff < 60) return t('time.minutesAgo', { count: diff });
  const hours = Math.floor(diff / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  return t('time.daysAgo', { count: Math.floor(hours / 24) });
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
  const { t } = useLanguage();
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

  const AUTO_REFRESH_MS = 60 * 60 * 1000;

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
  const alertConfig = getAlertConfig(t);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {hasAlerts
            ? <Bell className="h-4 w-4 text-red-500" />
            : totalCount === 0
              ? <BellOff className="h-4 w-4 text-green-500" />
              : <Bell className="h-4 w-4 text-muted-foreground" />}
          {t('dashboard.myAlerts')}
          {hasAlerts && (
            <Badge variant="destructive" className="text-xs h-5 px-1.5">{totalCount}</Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {data?.checkedAt && (
            <span className="text-xs text-muted-foreground">{timeAgo(data.checkedAt, t)}</span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => fetchAlerts(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
        ) : !data ? (
          <p className="text-xs text-destructive">{t('dashboard.alertsLoadError')}</p>
        ) : totalCount === 0 ? (
          <p className="text-xs text-green-600 font-medium">{t('dashboard.noAlerts')}</p>
        ) : (
          <div className="space-y-0.5">
            {alertConfig.map(({ key, label, icon }) => (
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
