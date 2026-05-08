'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Employee, NonEmployee, SessionData, Room, Settings, BokResident } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bed, Building, BarChart2, Copy, Lock, Bus } from 'lucide-react';
import { useMainLayout } from '@/components/main-layout';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LabelList,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { ChartConfig, ChartTooltipContent } from '@/components/ui/chart';
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Badge } from './ui/badge';
import { getActiveAddressCapacity } from '@/lib/address-filters';
import { bulkSetSendDateAction } from '@/lib/actions';
import { useLanguage } from '@/lib/i18n';

const SEND_REASONS = ['Badania wstępne', 'Badania okresowe', 'Na PKP'] as const;
type SendReason = (typeof SEND_REASONS)[number];

type PersonSendData = { date: Date | undefined; time: string; reason: SendReason | '' };
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

type Occupant = Employee | NonEmployee | BokResident;
type RoomWithOccupants = Room & { occupants: Occupant[]; occupantCount: number; available: number };
type HousingData = ReturnType<typeof useHousingData>[0];

const isBokResident = (occupant: Occupant): occupant is BokResident => 'returnStatus' in occupant;
const isEmployee = (occupant: Occupant): occupant is Employee => 'zaklad' in occupant && !isBokResident(occupant);

const calculateStats = (occupants: Occupant[]) => {
  const stats = {
    nationalities: new Map<string, number>(),
    genders: new Map<string, number>(),
    departments: new Map<string, number>(),
  };
  occupants.forEach((occ) => {
    stats.nationalities.set(occ.nationality || 'Brak', (stats.nationalities.get(occ.nationality || 'Brak') || 0) + 1);
    stats.genders.set(occ.gender || 'Brak', (stats.genders.get(occ.gender || 'Brak') || 0) + 1);

    if (isEmployee(occ) || isBokResident(occ)) {
      stats.departments.set(occ.zaklad || 'Brak', (stats.departments.get(occ.zaklad || 'Brak') || 0) + 1);
    }
  });
  return {
    nationalities: Array.from(stats.nationalities.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    genders: Array.from(stats.genders.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    departments: Array.from(stats.departments.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
};

const NoDataState = ({ message, className }: { message: string; className?: string }) => (
  <div
    className={cn(
      'flex h-full w-full min-h-[150px] items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20',
      className,
    )}
  >
    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
      <BarChart2 className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-xs">{message}</p>
    </div>
  </div>
);

const StatsCharts = ({ occupants, chartConfig }: { occupants: Occupant[]; chartConfig: ChartConfig }) => {
  const statsData = useMemo(() => calculateStats(occupants), [occupants]);
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('charts.byNationality')}</CardTitle>
        </CardHeader>
        <CardContent>
          {statsData.nationalities.length > 0 ? (
            <ResponsiveContainer width="100%" height={statsData.nationalities.length * 25 + 20}>
              <BarChart data={statsData.nationalities} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={5}
                  width={80}
                  className="text-xs"
                  interval={0}
                />
                <XAxis type="number" hide={true} />
                <RechartsTooltip cursor={false} content={<ChartTooltipContent config={chartConfig} />} />
                <Bar dataKey="count" fill={chartConfig.nationalities.color} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="count" position="right" offset={8} className="fill-foreground text-xs" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoDataState message={t('common.noDataShort')} />
          )}
        </CardContent>
      </Card>
      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('charts.byGender')}</CardTitle>
        </CardHeader>
        <CardContent>
          {statsData.genders.length > 0 ? (
            <ResponsiveContainer width="100%" height={statsData.genders.length * 30 + 20}>
              <BarChart data={statsData.genders} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={5}
                  width={80}
                  className="text-xs"
                  interval={0}
                />
                <XAxis type="number" hide={true} />
                <RechartsTooltip cursor={false} content={<ChartTooltipContent config={chartConfig} />} />
                <Bar dataKey="count" fill={chartConfig.genders.color} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="count" position="right" offset={8} className="fill-foreground text-xs" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoDataState message={t('common.noDataShort')} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const PersonSendRow = ({
  id, name, data, onUpdate, onRemove,
}: {
  id: string;
  name: string;
  data: PersonSendData;
  onUpdate: (id: string, patch: Partial<PersonSendData>) => void;
  onRemove: (id: string) => void;
}) => {
  const [dateOpen, setDateOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <div className="rounded border bg-white dark:bg-amber-950/60 p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold truncate mr-2">{name}</span>
        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onRemove(id)}>
          <span className="text-xs">✕</span>
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {/* Data */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('h-7 text-xs px-2', !data.date && 'border-dashed border-amber-400')}>
              <CalendarIcon className="h-3 w-3 mr-1" />
              {data.date ? format(data.date, 'd MMM yyyy', { locale: pl }) : t('common.date')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={data.date} onSelect={(d) => { onUpdate(id, { date: d }); setDateOpen(false); }} locale={pl} initialFocus />
          </PopoverContent>
        </Popover>
        {/* Godzina */}
        <Input
          type="time"
          value={data.time}
          onChange={(e) => onUpdate(id, { time: e.target.value })}
          className={cn('h-7 text-xs w-24 px-2', !data.time && 'border-dashed border-amber-400')}
        />
        {/* Powód */}
        <Select value={data.reason} onValueChange={(v) => onUpdate(id, { reason: v as SendReason })}>
          <SelectTrigger className={cn('h-7 text-xs w-36', !data.reason && 'border-dashed border-amber-400')}>
            <SelectValue placeholder={t('housing.sendReasonShort')} />
          </SelectTrigger>
          <SelectContent>
            {SEND_REASONS.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

const AddressDetailView = ({
  addresses,
  onOccupantClick,
  selectedAddressIds,
  onRoomClick,
  selectedRoomIds,
  currentUser,
  settings,
  handleUpdateSettings,
  isSelectionMode,
  selectedBokData,
  selectedBokNames,
  onToggleBokSelection,
  onUpdatePersonSendData,
  onSaveSelection,
}: {
  addresses: HousingData[];
  onOccupantClick: (occupant: Occupant) => void;
  selectedAddressIds: string[];
  onRoomClick: (e: React.MouseEvent, roomId: string) => void;
  selectedRoomIds: string[];
  currentUser: SessionData | null;
  settings: Settings | null;
  handleUpdateSettings: (updates: Partial<Settings>) => Promise<void>;
  isSelectionMode: boolean;
  selectedBokData: Map<string, PersonSendData>;
  selectedBokNames: Map<string, string>;
  onToggleBokSelection: (id: string, name: string) => void;
  onUpdatePersonSendData: (id: string, patch: Partial<PersonSendData>) => void;
  onSaveSelection: () => Promise<void>;
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useLanguage();

  const isSingleSelectedBlocked = useMemo(() => {
    const selected = addresses.filter((a) => selectedAddressIds.includes(a.id));
    return selected.length === 1 && selected[0].isActive === false;
  }, [addresses, selectedAddressIds]);
  const { copyToClipboard } = useCopyToClipboard();

  const selectedAddressesData = useMemo(() => {
    return addresses.filter((a) => selectedAddressIds.includes(a.id));
  }, [addresses, selectedAddressIds]);

  const aggregatedAddressesData = useMemo(() => {
    if (selectedAddressesData.length === 0) return null;

    if (selectedAddressesData.length === 1) {
      const singleAddress = selectedAddressesData[0];
      return {
        isMultiple: false,
        id: singleAddress.id,
        isActive: singleAddress.isActive,
        isOwnAddress: singleAddress.isOwnAddress,
        name: singleAddress.name,
        occupants: singleAddress.occupants,
        unassignedOccupants: singleAddress.unassignedOccupants,
        occupantCount: singleAddress.occupantCount,
        capacity: singleAddress.capacity,
        available: singleAddress.available,
        rooms: singleAddress.rooms,
      };
    }

    const totalOccupantCount = selectedAddressesData.reduce((sum, a) => sum + a.occupantCount, 0);
    const totalCapacity = selectedAddressesData.reduce((sum, a) => sum + a.capacity, 0);
    const allOccupants = selectedAddressesData.flatMap((a) => a.occupants);
    const allUnassigned = selectedAddressesData.flatMap((a) => a.unassignedOccupants);

    return {
      isMultiple: true,
      isOwnAddress: false,
      name: t('housing.multipleAddresses', { count: String(selectedAddressesData.length) }),
      occupants: allOccupants,
      unassignedOccupants: allUnassigned,
      occupantCount: totalOccupantCount,
      capacity: totalCapacity,
      available: totalCapacity - totalOccupantCount,
      rooms: [],
    };
  }, [selectedAddressesData]);

  const selectedRoomsData = useMemo(() => {
    if (!aggregatedAddressesData || aggregatedAddressesData.isMultiple || selectedRoomIds.length === 0) return null;

    const rooms = aggregatedAddressesData.rooms.filter((r) => selectedRoomIds.includes(r.id));
    if (rooms.length === 0) return null;

    const totalOccupantCount = rooms.reduce((sum, r) => sum + r.occupantCount, 0);
    const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
    const allOccupants = rooms.flatMap((r) => r.occupants);

    return {
      isMultiple: rooms.length > 1,
      name: rooms.length > 1 ? t('housing.multipleRooms', { count: String(rooms.length) }) : t('housing.room', { name: rooms[0].name }),
      occupants: allOccupants,
      occupantCount: totalOccupantCount,
      capacity: totalCapacity,
      available: totalCapacity - totalOccupantCount,
      rooms: rooms,
    };
  }, [aggregatedAddressesData, selectedRoomIds]);

  const chartConfig: ChartConfig = {
    count: { label: 'Ilość' },
    nationalities: { label: 'Nationalities', color: 'hsl(var(--chart-2))' },
    genders: { label: 'Genders', color: 'hsl(var(--chart-1))' },
    departments: { label: 'Zakłady', color: 'hsl(var(--chart-3))' },
  };

  if (!aggregatedAddressesData) {
    return (
      <Card className="lg:col-span-2 h-full">
        <CardHeader>
          <CardTitle>{t('housing.addressDetails')}</CardTitle>
          <CardDescription>{t('housing.selectAddressPrompt')}</CardDescription>
        </CardHeader>
        <CardContent>
          <NoDataState message={t('housing.noAddressSelected')} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('lg:col-span-2 h-full', isSingleSelectedBlocked && 'border-destructive/50 bg-destructive/5')}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedRoomsData ? selectedRoomsData.name : aggregatedAddressesData.name}
            {isSingleSelectedBlocked && (
              <Badge variant="destructive" className="ml-2 text-xs">
                <Lock className="h-3 w-3 mr-1" />
                {t('housing.blockedAddress')}
              </Badge>
            )}
          </div>
          {currentUser?.isAdmin &&
            !aggregatedAddressesData.isMultiple &&
            aggregatedAddressesData.id !== undefined &&
            !selectedRoomsData && (
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`lock-address-${aggregatedAddressesData.id}`}
                  className="text-xs text-muted-foreground cursor-pointer font-normal"
                >
                  {aggregatedAddressesData.isActive ? t('housing.lockAddress') : t('housing.unlockAddress')}
                </Label>
                <Switch
                  id={`lock-address-${aggregatedAddressesData.id}`}
                  checked={!aggregatedAddressesData.isActive}
                  onCheckedChange={async (checked) => {
                    if (!settings) return;
                    const newIsActive = !checked;
                    const updatedAddresses = settings.addresses.map((a) =>
                      a.id === aggregatedAddressesData.id
                        ? {
                            ...a,
                            isActive: newIsActive,
                            // When unlocking address → automatically unlock all its rooms too
                            rooms: newIsActive ? a.rooms.map((r) => ({ ...r, isActive: true })) : a.rooms,
                          }
                        : a,
                    );
                    await handleUpdateSettings({ addresses: updatedAddresses });
                  }}
                />
              </div>
            )}
        </CardTitle>
        <CardDescription>
          <span>
            {(selectedRoomsData || aggregatedAddressesData).occupantCount} /{' '}
            {(selectedRoomsData || aggregatedAddressesData).capacity} {t('housing.residents').toLowerCase()}
          </span>
          <span
            className={cn(
              'ml-2 font-bold',
              (selectedRoomsData || aggregatedAddressesData).available > 0 ? 'text-green-600' : 'text-red-600',
            )}
          >
            ({(selectedRoomsData || aggregatedAddressesData).available} {t('housing.freePlaces')})
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className={cn('flex flex-col', isSelectionMode && 'pb-0')}>
        <ScrollArea className={cn(isSelectionMode ? 'h-[calc(100vh-20rem)]' : 'h-[calc(100vh-16rem)]')}>
          {aggregatedAddressesData.isMultiple ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">{t('housing.totalStats')}</h3>
                <StatsCharts occupants={aggregatedAddressesData.occupants} chartConfig={chartConfig} />
              </div>
              <div>
                <h3 className="font-semibold mb-4">{t('housing.individualStats')}</h3>
                <Accordion type="multiple" className="w-full space-y-3">
                  {selectedAddressesData.map((address) => (
                    <Card key={address.id} className="overflow-hidden">
                      <AccordionItem value={address.id} className="border-b-0">
                        <AccordionTrigger className="p-4 hover:no-underline">
                          <div className="w-full">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-base font-semibold flex items-center gap-2">
                                {address.name}
                              </CardTitle>
                              <span className="text-base">
                                <span>
                                  {address.occupantCount} / {address.capacity}
                                </span>
                              </span>
                            </div>
                            <CardDescription className="text-xs pt-1 text-left">
                              {t('housing.freePlacesLabel')}{' '}
                              <span
                                className={cn('font-bold', address.available > 0 ? 'text-green-600' : 'text-red-600')}
                              >
                                {address.available}
                              </span>
                            </CardDescription>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 pt-0">
                          <StatsCharts occupants={address.occupants} chartConfig={chartConfig} />
                        </AccordionContent>
                      </AccordionItem>
                    </Card>
                  ))}
                </Accordion>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                {aggregatedAddressesData.isOwnAddress ? (
                  <>
                    <h3 className="font-semibold">{t('housing.residents')} ({aggregatedAddressesData.occupantCount})</h3>
                    {aggregatedAddressesData.occupants.length > 0 ? (
                      <div className="rounded-md border p-3 space-y-1">
                        {aggregatedAddressesData.occupants.map((o) => {
                          const fullName = `${o.lastName} ${o.firstName}`.trim();
                          return (
                            <div key={o.id} className="flex items-center justify-between text-xs group">
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isSelectionMode) {
                                    if (isBokResident(o)) onToggleBokSelection(o.id, `${o.lastName} ${o.firstName}`.trim());
                                  } else {
                                    onOccupantClick(o);
                                  }
                                }}
                                className={cn(
                                  'flex-1 cursor-pointer transition-colors',
                                  isSelectionMode && !isBokResident(o) ? 'opacity-40 cursor-not-allowed' : 'hover:text-primary',
                                  isSelectionMode && isBokResident(o) && selectedBokData.has(o.id) && 'text-primary font-bold'
                                )}
                              >
                                {isSelectionMode && isBokResident(o) && (
                                  <span className="mr-2 inline-flex items-center justify-center w-4 h-4 border rounded bg-white dark:bg-black">
                                    {selectedBokData.has(o.id) && <Check className="w-3 h-3 text-primary" />}
                                  </span>
                                )}
                                {fullName}
                              </span>
                              {!isSelectionMode && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(fullName, `Skopiowano: ${fullName}`); }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <NoDataState message={t('housing.noOccupants')} />
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold">{t('housing.rooms')}</h3>
                    {aggregatedAddressesData.rooms.length > 0 ? (
                      aggregatedAddressesData.rooms
                        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }))
                        .map((room) => (
                          <div
                            key={room.id}
                            className={cn(
                              'rounded-md border p-3 cursor-pointer transition-colors',
                              selectedRoomIds.includes(room.id) ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50',
                              !room.isActive && 'bg-destructive/10 border-destructive/20',
                              room.isLocked && 'bg-yellow-500/10 border-yellow-500/30',
                              room.isActive &&
                                !room.isLocked &&
                                room.available > 0 &&
                                !selectedRoomIds.includes(room.id) &&
                                'bg-green-500/10 border-green-500/20',
                            )}
                            onClick={(e) => onRoomClick(e, room.id)}
                          >
                            <div className="flex justify-between items-center font-medium">
                              <div className="flex items-center gap-2">
                                <Bed className="h-4 w-4 text-muted-foreground" />
                                {t('housing.room', { name: room.name })}
                                {room.isLocked && <Lock className="h-3 w-3 ml-1 text-yellow-600" />}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm">
                                  <span>
                                    {room.occupantCount} / {room.capacity}
                                  </span>
                                </span>
                                {currentUser?.isAdmin && !isSingleSelectedBlocked && (
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Label
                                      htmlFor={`disable-room-${room.id}`}
                                      className="text-xs text-muted-foreground cursor-pointer font-normal"
                                    >
                                      {room.isActive ? t('housing.lockRoom') : t('housing.unlockRoom')}
                                    </Label>
                                    <Switch
                                      id={`disable-room-${room.id}`}
                                      checked={!room.isActive}
                                      onCheckedChange={async (checked) => {
                                        if (!settings || !aggregatedAddressesData || aggregatedAddressesData.isMultiple)
                                          return;
                                        const updatedAddresses = settings.addresses.map((a) =>
                                          a.id === aggregatedAddressesData.id
                                            ? {
                                                ...a,
                                                rooms: a.rooms.map((r) =>
                                                  r.id === room.id ? { ...r, isActive: !checked } : r,
                                                ),
                                              }
                                            : a,
                                        );
                                        await handleUpdateSettings({ addresses: updatedAddresses });
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="pl-4 mt-2 space-y-1">
                              {room.occupants.map((o) => {
                                const fullName = `${o.lastName} ${o.firstName}`.trim();
                                const isBlocked = isSingleSelectedBlocked || room.isLocked || !room.isActive;
                                return (
                                  <div
                                    key={o.id}
                                    className="flex items-center justify-between text-xs group"
                                  >
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isBlocked) return;
                                        if (isSelectionMode) {
                                          if (isBokResident(o)) onToggleBokSelection(o.id, `${o.lastName} ${o.firstName}`.trim());
                                        } else {
                                          onOccupantClick(o);
                                        }
                                      }}
                                      className={cn(
                                        'flex-1 transition-colors',
                                        isBlocked ? 'cursor-not-allowed opacity-40' :
                                          isSelectionMode && isBokResident(o) ? 'cursor-pointer hover:text-primary' :
                                          isSelectionMode ? 'text-muted-foreground' :
                                          'cursor-pointer hover:text-primary',
                                        isSelectionMode && isBokResident(o) && selectedBokData.has(o.id) && 'text-primary font-bold'
                                      )}
                                    >
                                      {isSelectionMode && !isBlocked && isBokResident(o) && (
                                        <span className="mr-2 inline-flex items-center justify-center w-4 h-4 border rounded bg-white dark:bg-black">
                                          {selectedBokData.has(o.id) && <Check className="w-3 h-3 text-primary" />}
                                        </span>
                                      )}
                                      {fullName}
                                    </span>
                                    {!isBlocked && !isSelectionMode && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyToClipboard(fullName, `Skopiowano: ${fullName}`);
                                        }}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                    ) : (
                      <NoDataState message={t('housing.noRoomsForAddress')} />
                    )}
                    {aggregatedAddressesData.unassignedOccupants && aggregatedAddressesData.unassignedOccupants.length > 0 && (
                      <div className="rounded-md border p-3 bg-muted/30">
                        <div className="flex items-center gap-2 font-medium mb-2">
                          <Bed className="h-4 w-4 text-muted-foreground" />
                          <span>{t('housing.unassignedRoom')}</span>
                          <span className="text-sm text-muted-foreground">({aggregatedAddressesData.unassignedOccupants.length})</span>
                        </div>
                        <div className="pl-4 space-y-1">
                          {aggregatedAddressesData.unassignedOccupants.map((o) => {
                            const fullName = `${o.lastName} ${o.firstName}`.trim();
                            return (
                              <div key={o.id} className="flex items-center justify-between text-xs group">
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isSelectionMode) {
                                      if (isBokResident(o)) onToggleBokSelection(o.id, `${o.lastName} ${o.firstName}`.trim());
                                    } else {
                                      onOccupantClick(o);
                                    }
                                  }}
                                  className={cn(
                                    'flex-1 transition-colors',
                                    (isSelectionMode && !isBokResident(o)) ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:text-primary',
                                    isSelectionMode && isBokResident(o) && selectedBokData.has(o.id) && 'text-primary font-bold'
                                  )}
                                >
                                  {isSelectionMode && isBokResident(o) && (
                                    <span className="mr-2 inline-flex items-center justify-center w-4 h-4 border rounded bg-white dark:bg-black">
                                      {selectedBokData.has(o.id) && <Check className="w-3 h-3 text-primary" />}
                                    </span>
                                  )}
                                  {fullName}
                                </span>
                                {!isSelectionMode && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(fullName, `Skopiowano: ${fullName}`); }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="space-y-4">
                {selectedRoomsData ? (
                  selectedRoomsData.isMultiple ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-semibold mb-4">{t('housing.statsForRooms')}</h3>
                        <StatsCharts occupants={selectedRoomsData.occupants} chartConfig={chartConfig} />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-4">{t('housing.individualStatsRooms')}</h3>
                        <Accordion type="multiple" className="w-full space-y-3">
                          {selectedRoomsData.rooms.map((room) => (
                            <Card key={room.id} className="overflow-hidden">
                              <AccordionItem value={room.id} className="border-b-0">
                                <AccordionTrigger className="p-4 hover:no-underline">
                                  <div className="w-full">
                                    <div className="flex justify-between items-start">
                                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        {t('housing.room', { name: room.name })}
                                      </CardTitle>
                                      <span className="text-base">
                                        <span>
                                          {room.occupantCount} / {room.capacity}
                                        </span>
                                      </span>
                                    </div>
                                    <CardDescription className="text-xs pt-1 text-left">
                                      {t('housing.freePlacesLabel')}{' '}
                                      <span
                                        className={cn(
                                          'font-bold',
                                          room.available > 0 ? 'text-green-600' : 'text-red-600',
                                        )}
                                      >
                                        {room.available}
                                      </span>
                                    </CardDescription>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 pt-0">
                                  <StatsCharts occupants={room.occupants} chartConfig={chartConfig} />
                                </AccordionContent>
                              </AccordionItem>
                            </Card>
                          ))}
                        </Accordion>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-semibold">{t('housing.statsForRoom', { name: selectedRoomsData.rooms[0].name })}</h3>
                      <StatsCharts occupants={selectedRoomsData.occupants} chartConfig={chartConfig} />
                    </>
                  )
                ) : (
                  <>
                    <h3 className="font-semibold">{t('housing.statsForAddress')}</h3>
                    <StatsCharts occupants={aggregatedAddressesData.occupants} chartConfig={chartConfig} />
                  </>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
        {/* Selection bar shown below the scroll area */}
        {isSelectionMode && (
          <div className="mt-2 border rounded-md bg-amber-50 dark:bg-amber-950/40">
            <div className="px-3 py-2 flex items-center justify-between border-b border-amber-200 dark:border-amber-800">
              <span className="text-sm font-semibold">{t('housing.selectedForSending', { count: String(selectedBokData.size) })}</span>
              {selectedBokData.size > 0 && (
                <Button
                  size="sm"
                  className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={isSubmitting || Array.from(selectedBokData.values()).some(d => !d.date || !d.time || !d.reason)}
                  onClick={async () => {
                    setIsSubmitting(true);
                    await onSaveSelection();
                    setIsSubmitting(false);
                  }}
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                  {t('housing.confirmAllSelected')}
                </Button>
              )}
            </div>
            {selectedBokData.size > 0 && (
              <ScrollArea className="max-h-56">
                <div className="p-2 space-y-2">
                  {Array.from(selectedBokData.entries()).map(([id, data]) => {
                    const nameEntry = selectedBokNames.get(id) ?? id;
                    return (
                      <PersonSendRow
                        key={id}
                        id={id}
                        name={nameEntry}
                        data={data}
                        onUpdate={onUpdatePersonSendData}
                        onRemove={(removeId) => onToggleBokSelection(removeId, '')}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const useHousingData = () => {
  const { allEmployees, allNonEmployees, allBokResidents, settings, currentUser, selectedCoordinatorId } =
    useMainLayout();

  return useMemo(() => {
    if (!settings || !allEmployees || !allNonEmployees || !allBokResidents || !currentUser) return [];

    let addressesToDisplay = settings.addresses;
    if ((!currentUser.isAdmin && !currentUser.isDriver) || (currentUser.isAdmin && selectedCoordinatorId !== 'all')) {
      const coordId = currentUser.isAdmin ? selectedCoordinatorId : currentUser.uid;
      addressesToDisplay = settings.addresses.filter((a) => a.coordinatorIds.includes(coordId));
    } else if (currentUser.isDriver) {
      addressesToDisplay = settings.addresses.filter((a) => a.coordinatorIds.includes(currentUser.uid));
    }

    const allActiveOccupants: Occupant[] = [
      ...allEmployees.filter((e) => e.status === 'active'),
      ...allNonEmployees.filter((ne) => ne.status === 'active'),
      ...allBokResidents.filter((bok) => {
        if (bok.status === 'dismissed' || bok.dismissDate) return false;
        if (!bok.sendDate) return true;
        return bok.sendReason === 'Badania wstępne' || bok.sendReason === 'Badania okresowe';
      }),
    ];

    return addressesToDisplay.map((address) => {
      const occupantsInAddress = allActiveOccupants.filter((o) => o.address === address.name);
      // Only count capacity from active (non-blocked) rooms
      const totalCapacity = getActiveAddressCapacity(address);
      const occupantCount = occupantsInAddress.length;

      const normalizedAddressName = address.name.toLowerCase().replace(/ł/g, 'l');
      const isOwnAddress = normalizedAddressName.includes('wlasne mieszkani');

      const rooms: RoomWithOccupants[] = address.rooms.map((room) => {
        const occupantsInRoom = occupantsInAddress.filter((o) => o.roomNumber === room.name);
        return {
          id: room.id,
          name: room.name,
          capacity: room.capacity,
          isActive: room.isActive,
          isLocked: room.isLocked,
          occupants: occupantsInRoom,
          occupantCount: occupantsInRoom.length,
          available: isOwnAddress ? 0 : room.capacity - occupantsInRoom.length,
        };
      });

      const assignedOccupantIds = new Set(rooms.flatMap((r) => r.occupants.map((o) => o.id)));
      const unassignedOccupants = occupantsInAddress.filter((o) => !assignedOccupantIds.has(o.id));

      return {
        id: address.id,
        name: address.name,
        locality: address.locality,
        isActive: address.isActive,
        isOwnAddress,
        occupants: occupantsInAddress,
        unassignedOccupants,
        occupantCount: occupantCount,
        capacity: totalCapacity,
        available: isOwnAddress ? 0 : totalCapacity - occupantCount,
        occupancy: totalCapacity > 0 ? (occupantCount / totalCapacity) * 100 : 0,
        rooms: rooms,
      };
    });
  }, [allEmployees, allNonEmployees, allBokResidents, settings, currentUser, selectedCoordinatorId]);
};

const MobileAddressCard = ({
  address,
  onOccupantClick,
  currentUser,
  settings,
  handleUpdateSettings,
  style,
  isHighlighted,
}: {
  address: HousingData;
  onOccupantClick: (occupant: Occupant) => void;
  currentUser: SessionData;
  settings: Settings;
  handleUpdateSettings: (updates: Partial<Settings>) => Promise<void>;
  style?: React.CSSProperties;
  isHighlighted?: boolean;
}) => {
  const { copyToClipboard } = useCopyToClipboard();
  const { t } = useLanguage();

  return (
    <Card
      id={`housing-address-${address.id}`}
      className={cn(
        'overflow-hidden animate-fade-in-up',
        !address.isActive && 'border-destructive/50 bg-destructive/5',
        address.isActive && address.available > 0 && 'border-green-500/30',
        isHighlighted && 'ring-2 ring-primary border-primary',
      )}
      style={style}
    >
      <AccordionItem value={address.id} className="border-b-0">
        <AccordionTrigger className="p-4 hover:no-underline">
          <div className="w-full">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building className={cn('h-5 w-5', address.isActive ? 'text-primary' : 'text-destructive')} />
                {address.name}
                {!address.isActive && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    <Lock className="h-3 w-3 mr-0.5" />
                    {t('housing.blockedAddress')}
                  </Badge>
                )}
              </CardTitle>
              <span className="text-base">
                <span>
                  {address.occupantCount} / {address.capacity}
                </span>
              </span>
            </div>
            <CardDescription className="text-xs pt-1 text-left">
              {t('housing.freePlacesLabel')}{' '}
              <span className={cn('font-bold', address.available > 0 ? 'text-green-600' : 'text-red-600')}>
                {address.available}
              </span>
            </CardDescription>
          </div>
        </AccordionTrigger>
        <AccordionContent className="p-4 pt-0">
          <div className="space-y-4">
            {currentUser.isAdmin && (
              <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
                <Label htmlFor={`lock-address-mobile-${address.id}`} className="text-sm font-medium cursor-pointer">
                  {address.isActive ? t('housing.lockAddress') : t('housing.unlockAddress')}
                </Label>
                <Switch
                  id={`lock-address-mobile-${address.id}`}
                  checked={!address.isActive}
                  onCheckedChange={async (checked) => {
                    const newIsActive = !checked;
                    const updatedAddresses = settings!.addresses.map((a) =>
                      a.id === address.id
                        ? {
                            ...a,
                            isActive: newIsActive,
                            // When unlocking address → automatically unlock all its rooms too
                            rooms: newIsActive ? a.rooms.map((r) => ({ ...r, isActive: true })) : a.rooms,
                          }
                        : a,
                    );
                    await handleUpdateSettings({ addresses: updatedAddresses });
                  }}
                />
              </div>
            )}
            <div>
              {address.isOwnAddress ? (
                <>
                  <h4 className="text-sm font-semibold mb-2">{t('housing.residents')} ({address.occupantCount})</h4>
                  {address.occupants.length > 0 ? (
                    <div className="rounded-md border p-3 space-y-1">
                      {address.occupants.map((o) => {
                        const fullName = `${o.lastName} ${o.firstName}`.trim();
                        return (
                          <div key={o.id} className="flex items-center justify-between text-xs text-muted-foreground group">
                            <span
                              onClick={() => onOccupantClick(o)}
                              className="cursor-pointer hover:text-primary"
                            >
                              {fullName}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(fullName, `Skopiowano: ${fullName}`); }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('housing.noOccupants')}</p>
                  )}
                </>
              ) : (
                <>
                  <h4 className="text-sm font-semibold mb-2">{t('housing.rooms')}</h4>
                  <div className="space-y-2">
                    {address.rooms
                      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }))
                      .map((room) => (
                        <div
                          key={room.id}
                          className={cn(
                            'rounded-md border p-3',
                            !room.isActive && 'bg-destructive/10 border-destructive/20',
                            room.isLocked && 'bg-yellow-500/10 border-yellow-500/30',
                            room.isActive && !room.isLocked && room.available > 0 && 'bg-green-500/10 border-green-500/20',
                          )}
                        >
                          <div className="flex justify-between items-center font-medium text-sm">
                            <div className="flex items-center gap-2">
                              <Bed className="h-4 w-4 text-muted-foreground" />
                              {t('housing.room', { name: room.name })}
                              {room.isLocked && <Lock className="h-3 w-3 text-yellow-600" />}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm">
                                <span>
                                  {room.occupantCount} / {room.capacity}
                                </span>
                              </span>
                              {currentUser.isAdmin && (
                                <div className="flex items-center gap-2">
                                  <Label
                                    htmlFor={`lock-${room.id}`}
                                    className="text-xs text-muted-foreground cursor-pointer"
                                  >
                                    {room.isLocked ? t('housing.unlockRoom') : t('housing.lockRoom')}
                                  </Label>
                                  <Switch
                                    id={`lock-${room.id}`}
                                    checked={room.isLocked || false}
                                    onCheckedChange={async (checked) => {
                                      const updatedAddresses = settings!.addresses.map((a) =>
                                        a.id === address.id
                                          ? {
                                              ...a,
                                              rooms: a.rooms.map((r) =>
                                                r.id === room.id ? { ...r, isLocked: checked } : r,
                                              ),
                                            }
                                          : a,
                                      );
                                      await handleUpdateSettings({ addresses: updatedAddresses });
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="pl-4 mt-2 space-y-1">
                            {room.occupants.map((o) => {
                              const fullName = `${o.lastName} ${o.firstName}`.trim();
                              const isBlocked = !address.isActive || room.isLocked || !room.isActive;
                              return (
                                <div
                                  key={o.id}
                                  className="flex items-center justify-between text-xs text-muted-foreground group"
                                >
                                  <span
                                    onClick={() => {
                                      if (!isBlocked) onOccupantClick(o);
                                    }}
                                    className={cn(
                                      isBlocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:text-primary',
                                    )}
                                  >
                                    {fullName}
                                  </span>
                                  {!isBlocked && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(fullName, `Skopiowano: ${fullName}`);
                                      }}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                  {address.unassignedOccupants && address.unassignedOccupants.length > 0 && (
                    <div className="mt-2 rounded-md border p-3 bg-muted/30">
                      <div className="flex items-center gap-2 font-medium text-sm mb-2">
                        <Bed className="h-4 w-4 text-muted-foreground" />
                        <span>{t('housing.unassignedRoom')}</span>
                        <span className="text-xs text-muted-foreground">({address.unassignedOccupants.length})</span>
                      </div>
                      <div className="pl-4 space-y-1">
                        {address.unassignedOccupants.map((o) => {
                          const fullName = `${o.lastName} ${o.firstName}`.trim();
                          return (
                            <div key={o.id} className="flex items-center justify-between text-xs text-muted-foreground group">
                              <span
                                onClick={() => onOccupantClick(o)}
                                className="cursor-pointer hover:text-primary"
                              >
                                {fullName}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(fullName, `Skopiowano: ${fullName}`); }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">{t('housing.statistics')}</h4>
              <StatsCharts
                occupants={address.occupants}
                chartConfig={{
                  count: { label: 'Ilość' },
                  nationalities: { label: 'Nationalities', color: 'hsl(var(--chart-2))' },
                  genders: { label: 'Genders', color: 'hsl(var(--chart-1))' },
                  departments: { label: 'Zakłady', color: 'hsl(var(--chart-3))' },
                }}
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Card>
  );
};

export const FilterControls = ({
  filters,
  onFilterChange,
  settings,
  currentUser,
}: {
  filters: { name: string; locality: string; showOnlyAvailable: boolean };
  onFilterChange: (filters: { name: string; locality: string; showOnlyAvailable: boolean }) => void;
  settings: Settings | null;
  currentUser: SessionData | null;
}) => {
  const sortedLocalities = useMemo(() => {
    if (!settings || !currentUser) return [];

    if (currentUser.isAdmin) {
      return [...settings.localities].sort((a, b) => a.localeCompare(b));
    }

    const coordinatorAddresses = settings.addresses.filter((a) => a.coordinatorIds.includes(currentUser.uid));
    const uniqueLocalities = [...new Set(coordinatorAddresses.map((a) => a.locality))];
    return uniqueLocalities.sort((a, b) => a.localeCompare(b));
  }, [settings, currentUser]);

  const { t } = useLanguage();
  const handleValueChange = (key: string, value: string | boolean) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="grid flex-1 min-w-[150px] items-center gap-1.5">
        <Label htmlFor="search-address">{t('housing.searchAddress')}</Label>
        <Input
          id="search-address"
          placeholder={t('housing.typeAddressName')}
          value={filters.name as string}
          onChange={(e) => handleValueChange('name', e.target.value)}
        />
      </div>
      <div className="grid flex-1 min-w-[150px] items-center gap-1.5">
        <Label htmlFor="search-locality">{t('housing.locality')}</Label>
        <Select value={filters.locality as string} onValueChange={(v) => handleValueChange('locality', v)}>
          <SelectTrigger id="search-locality">
            <SelectValue placeholder={t('housing.allLocalities')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('housing.allLocalities')}</SelectItem>
            {sortedLocalities.filter(Boolean).map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center space-x-2 pb-2">
        <Switch
          id="show-available"
          checked={filters.showOnlyAvailable as boolean}
          onCheckedChange={(checked) => handleValueChange('showOnlyAvailable', checked)}
        />
        <Label htmlFor="show-available">{t('housing.onlyAvailable')}</Label>
      </div>
    </div>
  );
};

export default function HousingView({ currentUser }: { currentUser: SessionData }) {
  const {
    settings,
    rawSettings,
    handleEditEmployeeClick,
    handleEditNonEmployeeClick,
    handleEditBokResidentClick,
    handleUpdateSettings,
    refreshData,
    patchRawBokResident,
  } = useMainLayout();
  const { isMobile } = useIsMobile();
  const searchParams = useSearchParams();
  const [selectedAddressIds, setSelectedAddressIds] = useState<string[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [mobileOpenItems, setMobileOpenItems] = useState<string[]>([]);
  const [deepLinkedAddressId, setDeepLinkedAddressId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedBokData, setSelectedBokData] = useState<Map<string, PersonSendData>>(new Map());
  const [selectedBokNames, setSelectedBokNames] = useState<Map<string, string>>(new Map());
  const { toast } = useToast();
  const { t } = useLanguage();
  const deepLinkApplied = useRef(false);

  const [filters, setFilters] = useState({
    name: '',
    locality: 'all',
    showOnlyAvailable: false,
  });

  const rawHousingData = useHousingData();

  // Auto-select address from URL param (e.g. from push notification deep link)
  useEffect(() => {
    if (deepLinkApplied.current) return;
    const addressId = searchParams.get('address');
    if (!addressId || rawHousingData.length === 0) return;
    const match = rawHousingData.find((a) => a.id === addressId);
    if (!match) return;
    deepLinkApplied.current = true;
    setSelectedAddressIds([addressId]);
    setSelectedRoomIds([]);
    // Mobile: open accordion and highlight the card
    setMobileOpenItems([addressId]);
    setDeepLinkedAddressId(addressId);
    // Scroll the address card into view after render
    setTimeout(() => {
      const el = document.getElementById(`housing-address-${addressId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }, [searchParams, rawHousingData]);

  const handleOccupantClick = (occupant: Occupant) => {
    if (isBokResident(occupant)) {
      handleEditBokResidentClick(occupant);
    } else if (isEmployee(occupant)) {
      handleEditEmployeeClick(occupant);
    } else {
      handleEditNonEmployeeClick(occupant);
    }
  };

  const handleFilterChange = (newFilters: Record<string, string | boolean>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const filteredData = useMemo(() => {
    let items = [...rawHousingData];

    if (filters.name) {
      items = items.filter((item) => (item.name || '').toLowerCase().includes(filters.name.toLowerCase()));
    }
    if (filters.locality !== 'all') {
      items = items.filter((item) => item.locality === filters.locality);
    }
    if (filters.showOnlyAvailable) {
      items = items.filter((item) => item.available > 0);
    }

    items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return items;
  }, [rawHousingData, filters]);

  const groupedByLocality = useMemo(() => {
    const grouped = filteredData.reduce(
      (acc, address) => {
        const locality = address.locality || 'Inne';
        if (!acc[locality]) {
          acc[locality] = { addresses: [], availablePlaces: 0 };
        }
        acc[locality].addresses.push(address);
        return acc;
      },
      {} as Record<string, { addresses: HousingData[]; availablePlaces: number }>,
    );

    // Calculate available places per locality (only from active addresses/rooms)
    for (const locality in grouped) {
      grouped[locality].availablePlaces = grouped[locality].addresses.reduce((sum, address) => {
        const normalizedAddressName = address.name.toLowerCase().replace(/ł/g, 'l');
        if (normalizedAddressName.includes('wlasne mieszkani')) {
          return sum;
        }
        // Only count available places if address is active
        if (!address.isActive) {
          return sum;
        }
        return sum + address.available;
      }, 0);
    }

    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredData]);

  const handleAddressClick = (e: React.MouseEvent, addressId: string) => {
    setSelectedRoomIds([]);
    setSelectedAddressIds((prev) => {
      if (e.ctrlKey || e.metaKey) {
        const isSelected = prev.includes(addressId);
        if (isSelected) {
          return prev.filter((id) => id !== addressId);
        } else {
          return [...prev, addressId];
        }
      } else {
        if (prev.length === 1 && prev[0] === addressId) {
          return [];
        }
        return [addressId];
      }
    });
  };

  const handleRoomClick = (e: React.MouseEvent, roomId: string) => {
    setSelectedRoomIds((prev) => {
      if (e.ctrlKey || e.metaKey) {
        const isSelected = prev.includes(roomId);
        if (isSelected) {
          return prev.filter((id) => id !== roomId);
        } else {
          return [...prev, roomId];
        }
      } else {
        if (prev.length === 1 && prev[0] === roomId) {
          return [];
        }
        return [roomId];
      }
    });
  };

  const handleToggleBokSelection = (id: string, name: string) => {
    setSelectedBokData(prev => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, { date: undefined, time: '', reason: '' });
      return next;
    });
    setSelectedBokNames(prev => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, name);
      return next;
    });
  };

  const handleUpdatePersonSendData = (id: string, patch: Partial<PersonSendData>) => {
    setSelectedBokData(prev => {
      const next = new Map(prev);
      const current = next.get(id);
      if (current) next.set(id, { ...current, ...patch });
      return next;
    });
  };

  const handleSaveSelection = async () => {
    if (selectedBokData.size === 0) return;
    try {
      const entries = Array.from(selectedBokData.entries()).map(([id, d]) => ({
        id,
        sendDate: format(d.date!, 'yyyy-MM-dd'),
        sendTime: d.time,
        sendReason: d.reason,
      }));
      const result = await bulkSetSendDateAction(entries, currentUser!.uid);
      if (result.success) {
        // Optimistic update — immediately reflect in UI without waiting for Sheets
        for (const entry of entries) {
          patchRawBokResident(entry.id, { sendDate: entry.sendDate, sendTime: entry.sendTime, sendReason: entry.sendReason });
        }
        toast({ title: t('housing.bulkSendDateSuccess'), description: `Data wysyłki ustawiona dla ${result.updatedCount} osób.` });
        setSelectedBokData(new Map());
        setSelectedBokNames(new Map());
        setIsSelectionMode(false);
        refreshData(false, true); // fire-and-forget background sync
      } else {
        toast({ variant: 'destructive', title: t('common.error'), description: result.error });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('housing.bulkSendDateError') });
    }
  };

  if (!rawHousingData || !settings) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/3" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('housing.housing')}</CardTitle>
              <CardDescription>{t('housing.housingDesc')}</CardDescription>
            </div>
            {(currentUser.isAdmin || currentUser.isDriver) && (
              <Button
                variant={isSelectionMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  if (isSelectionMode) { setSelectedBokData(new Map()); setSelectedBokNames(new Map()); }
                }}
                className={cn('h-8 text-xs gap-1', isSelectionMode && 'bg-amber-500 hover:bg-amber-600 text-white border-0')}
              >
                <Bus className="h-4 w-4" />
                {isSelectionMode ? t('housing.exitSendMode') : t('housing.sendMode')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <FilterControls
              filters={filters}
              onFilterChange={handleFilterChange}
              settings={settings}
              currentUser={currentUser}
            />
          </div>
          <ScrollArea className="h-[calc(100vh-22rem)] -mx-4 px-4">
            {filters.locality !== 'all' ? (
              // Show addresses directly when specific locality is selected
              <Accordion
                type="multiple"
                className="w-full space-y-3"
                value={mobileOpenItems}
                onValueChange={setMobileOpenItems}
              >
                {filteredData.map((address, index) => (
                  <MobileAddressCard
                    key={address.id}
                    address={address}
                    onOccupantClick={handleOccupantClick}
                    currentUser={currentUser}
                    settings={rawSettings ?? settings}
                    handleUpdateSettings={handleUpdateSettings}
                    isHighlighted={deepLinkedAddressId === address.id}
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                  />
                ))}
              </Accordion>
            ) : (
              // Show grouped by locality when 'all' is selected
              <Accordion
                type="multiple"
                className="w-full space-y-3"
                value={mobileOpenItems}
                onValueChange={setMobileOpenItems}
              >
                {groupedByLocality.map(([locality, { addresses, availablePlaces }]) => (
                  <div key={locality}>
                    <h2 className="text-lg font-bold sticky top-0 bg-background py-3 z-10 flex items-center">
                      {locality}
                      {availablePlaces > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {t('housing.freePlacesShort', { count: String(availablePlaces) })}
                        </Badge>
                      )}
                    </h2>
                    <div className="space-y-3">
                      {addresses.map((address, index) => (
                        <MobileAddressCard
                          key={address.id}
                          address={address}
                          onOccupantClick={handleOccupantClick}
                          currentUser={currentUser}
                          settings={rawSettings ?? settings}
                          handleUpdateSettings={handleUpdateSettings}
                          isHighlighted={deepLinkedAddressId === address.id}
                          style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </Accordion>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start h-full">
      <Card className="h-full">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('housing.addresses')}</CardTitle>
              <CardDescription>{t('housing.selectAddressDetails')}</CardDescription>
            </div>
            {(currentUser.isAdmin || currentUser.isDriver) && (
              <Button
                variant={isSelectionMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  if (isSelectionMode) { setSelectedBokData(new Map()); setSelectedBokNames(new Map()); }
                }}
                className={cn('h-8 text-xs gap-1', isSelectionMode && 'bg-amber-500 hover:bg-amber-600 text-white border-0')}
              >
                <Bus className="h-4 w-4" />
                {isSelectionMode ? t('housing.exitSendMode') : t('housing.sendMode')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-4 mb-4">
            <FilterControls
              filters={filters}
              onFilterChange={handleFilterChange}
              settings={settings}
              currentUser={currentUser}
            />
          </div>
          <ScrollArea className="h-[calc(100vh-25rem)] lg:h-[calc(100vh-24rem)]">
            {filters.locality !== 'all' ? (
              // Show addresses directly when specific locality is selected
              <div className="space-y-3">
                {filteredData.map((address, index) => (
                  <Card
                    key={address.id}
                    id={`housing-address-${address.id}`}
                    className={cn(
                      'cursor-pointer transition-colors animate-fade-in-up',
                      !address.isActive && 'border-destructive/50 bg-destructive/10',
                      address.isActive && selectedAddressIds.includes(address.id)
                        ? 'bg-primary/10 border-primary'
                        : address.isActive && 'hover:bg-muted/50',
                      address.isActive &&
                        address.available > 0 &&
                        !selectedAddressIds.includes(address.id) &&
                        'bg-green-500/10 border-green-500/20',
                    )}
                    onClick={(e) => handleAddressClick(e, address.id)}
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                  >
                    <CardHeader className="p-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Building className={cn('h-4 w-4', address.isActive ? 'text-primary' : 'text-destructive')} />
                          {address.name}
                          {!address.isActive && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              <Lock className="h-3 w-3 mr-0.5" />
                              {t('housing.blockedAddress')}
                            </Badge>
                          )}
                        </CardTitle>
                        <span className="text-sm">
                          <span>
                            {address.occupantCount} / {address.capacity}
                          </span>
                        </span>
                      </div>
                      <CardDescription className="text-xs pt-1">
                        {t('housing.freePlacesLabel')}{' '}
                        <span className={cn('font-bold', address.available > 0 ? 'text-green-600' : 'text-red-600')}>
                          {address.available}
                        </span>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              // Show grouped by locality when 'all' is selected
              <Accordion type="multiple" className="w-full" defaultValue={groupedByLocality.map((g) => g[0])}>
                {groupedByLocality.map(([locality, { addresses, availablePlaces }]) => (
                  <AccordionItem value={locality} key={locality} className="border-b-0">
                    <AccordionTrigger className="text-lg font-bold sticky top-0 bg-background py-3 z-10 hover:no-underline">
                      <div className="flex items-center">
                        {locality}
                        {availablePlaces > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {t('housing.freePlacesShort', { count: String(availablePlaces) })}
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      {addresses.map((address, index) => (
                        <Card
                          key={address.id}
                          id={`housing-address-${address.id}`}
                          className={cn(
                            'cursor-pointer transition-colors animate-fade-in-up',
                            !address.isActive && 'border-destructive/50 bg-destructive/10',
                            address.isActive && selectedAddressIds.includes(address.id)
                              ? 'bg-primary/10 border-primary'
                              : address.isActive && 'hover:bg-muted/50',
                            address.isActive &&
                              address.available > 0 &&
                              !selectedAddressIds.includes(address.id) &&
                              'bg-green-500/10 border-green-500/20',
                          )}
                          onClick={(e) => handleAddressClick(e, address.id)}
                          style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                        >
                          <CardHeader className="p-2">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Building
                                  className={cn('h-4 w-4', address.isActive ? 'text-primary' : 'text-destructive')}
                                />
                                {address.name}
                                {!address.isActive && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                    <Lock className="h-3 w-3 mr-0.5" />
                                    {t('housing.blockedAddress')}
                                  </Badge>
                                )}
                              </CardTitle>
                              <span className="text-sm">
                                <span>
                                  {address.occupantCount} / {address.capacity}
                                </span>
                              </span>
                            </div>
                            <CardDescription className="text-xs pt-1">
                              {t('housing.freePlacesLabel')}{' '}
                              <span
                                className={cn('font-bold', address.available > 0 ? 'text-green-600' : 'text-red-600')}
                              >
                                {address.available}
                              </span>
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      <AddressDetailView
        addresses={filteredData}
        onOccupantClick={handleOccupantClick}
        selectedAddressIds={selectedAddressIds}
        onRoomClick={handleRoomClick}
        selectedRoomIds={selectedRoomIds}
        currentUser={currentUser}
        settings={rawSettings ?? settings}
        handleUpdateSettings={handleUpdateSettings}
        isSelectionMode={isSelectionMode}
        selectedBokData={selectedBokData}
        selectedBokNames={selectedBokNames}
        onToggleBokSelection={handleToggleBokSelection}
        onUpdatePersonSendData={handleUpdatePersonSendData}
        onSaveSelection={handleSaveSelection}
      />
    </div>
  );
}
