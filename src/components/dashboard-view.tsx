
"use client";

import type { Employee, Settings, HousingAddress, Coordinator, Room, NonEmployee } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, LabelList, Cell, Label, Bar, BarChart } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { useMemo, useState, useEffect } from "react";
import { Building, UserMinus, Users, Home, BedDouble, ChevronRight, ChevronDown, UserCheck, RefreshCw, UserX } from "lucide-react";
import { isWithinInterval, format, getYear, getMonth, parseISO } from "date-fns";
import { type Locale, pl, uk, enUS, es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

interface DashboardViewProps {
  employees: Employee[];
  allEmployees: Employee[];
  nonEmployees: NonEmployee[];
  settings: Settings;
  onEditEmployee: (employee: Employee) => void;
  currentUser: Coordinator;
  selectedCoordinatorId: string;
  onSelectCoordinator: (id: string) => void;
  onDataRefresh: () => void;
}

const localesMap: Record<string, Locale> = {
    pl,
    uk,
    en: enUS,
    es
}

const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
        const date = parseISO(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return format(date, 'dd-MM-yyyy');
    } catch {
        return 'Invalid Date';
    }
}

const isEmployee = (person: Employee | NonEmployee): person is Employee => {
    return 'coordinatorId' in person;
}

// New component for detailed housing view
const HousingDetailView = ({
  address,
  allOccupants,
  onEmployeeClick,
  highlightAvailable,
}: {
  address: HousingAddress;
  allOccupants: (Employee | NonEmployee)[];
  onEmployeeClick: (employee: Employee) => void;
  highlightAvailable: boolean;
}) => {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const t = useTranslations('Dashboard');
  const rooms = useMemo(() => {
    const roomMap = new Map<string, { occupants: (Employee | NonEmployee)[], capacity: number }>();
    
    address.rooms.forEach(room => {
        roomMap.set(room.name, { occupants: [], capacity: room.capacity });
    });

    allOccupants.forEach(occupant => {
      if (occupant.address === address.name) {
        if (!roomMap.has(occupant.roomNumber)) {
          roomMap.set(occupant.roomNumber, { occupants: [], capacity: 0 });
        }
        const roomData = roomMap.get(occupant.roomNumber)!;
        roomData.occupants.push(occupant);
        if (roomData.capacity === 0) {
            roomData.capacity = roomData.occupants.length;
        }
      }
    });

    return Array.from(roomMap.entries())
      .map(([roomNumber, data]) => ({
        roomNumber,
        occupants: data.occupants,
        capacity: data.capacity,
        available: data.capacity - data.occupants.length
      }))
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));

  }, [allOccupants, address]);

  if (selectedRoom) {
    const roomData = rooms.find(r => r.roomNumber === selectedRoom);
    const occupants = roomData?.occupants || [];
    return (
      <div>
        <Button variant="ghost" onClick={() => setSelectedRoom(null)} className="mb-4">
          &larr; {t('backToRooms')}
        </Button>
        <DialogHeader>
          <DialogTitle>{t('housingDetailViewTitle', {roomNumber: selectedRoom})}</DialogTitle>
          <DialogDescription>{t('housingDetailViewDescription', {addressName: address.name})}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] mt-4">
          {occupants.length > 0 ? (
            occupants.map(occupant => {
                const canClick = isEmployee(occupant);
                return (
                    <Card 
                        key={occupant.id} 
                        onClick={() => canClick && onEmployeeClick(occupant)} 
                        className={cn("mb-3", canClick && "cursor-pointer hover:bg-muted/50")}
                    >
                      <CardHeader>
                        <CardTitle className="text-base">{occupant.fullName}</CardTitle>
                        <CardDescription>
                          {isEmployee(occupant) ? `${t('employeeLabel')} / ${occupant.nationality}` : t('residentLabel')}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                )
            })
          ) : (
             <p className="text-center text-muted-foreground pt-8">{t('noResidentsInRoom')}</p>
          )}
        </ScrollArea>
      </div>
    );
  }

  return (
    <div>
       <DialogHeader>
          <DialogTitle>{address.name}</DialogTitle>
          <DialogDescription>{t('selectRoom')}</DialogDescription>
        </DialogHeader>
      <ScrollArea className="h-[60vh] mt-4">
        <div className="space-y-3">
          {rooms.map(({ roomNumber, occupants, capacity, available }) => {
            const hasAvailability = available > 0;
            return (
                <Card key={roomNumber} onClick={() => setSelectedRoom(roomNumber)} className={cn("cursor-pointer hover:bg-muted/50 transition-colors", highlightAvailable && hasAvailability && "bg-green-100 dark:bg-green-900/30 border-green-500")}>
                <CardHeader className="flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BedDouble className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{t('roomLabel')} {roomNumber}</CardTitle>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant={highlightAvailable && hasAvailability ? 'default' : 'secondary'} className={cn(highlightAvailable && hasAvailability && 'bg-green-600')}>{occupants.length} / {capacity}</Badge>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                </CardHeader>
                </Card>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

const VerticalChartComponent = ({ data, title, labelX }: { data: {name: string, value: number}[], title: string, labelX?: string }) => {
    const t = useTranslations('Dashboard');
    return(
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pr-0 sm:pr-2 pl-4">
        <ChartContainer config={{value: {label: labelX || t('employeeLabel')}}} className="h-[400px] w-full">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 20, right: 40, left: 20, bottom: 20 }}>
              <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--primary) / 0.7)" />
                      <stop offset="100%" stopColor="hsl(var(--primary) / 0.2)" />
                  </linearGradient>
              </defs>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
              <XAxis 
                type="number" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={10} 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                allowDecimals={false}
              />
              <YAxis 
                type="category"
                dataKey="name" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={10} 
                width={150}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                interval={0}
              />
              <Tooltip 
                cursor={{ fill: 'hsl(var(--accent) / 0.1)' }} 
                content={({ active, payload, label }) => active && payload && payload.length && (
                    <div className="bg-background/95 p-3 rounded-lg border shadow-lg">
                        <p className="font-bold text-foreground">{label}</p>
                        <p className="text-sm text-primary">{`${payload[0].value} ${labelX || t('employeeLabel')}`}</p>
                    </div>
                )}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="url(#chartGradient)" animationDuration={500}>
                <LabelList dataKey="value" position="right" offset={10} className="fill-foreground font-semibold" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
)};

const DeparturesChart = ({ employees, currentLocale }: { employees: Employee[], currentLocale: string }) => {
    const t = useTranslations('Dashboard');
    const locale = localesMap[currentLocale] || pl;
    const [departureYear, setDepartureYear] = useState<string>(String(new Date().getFullYear()));
    const [departureMonth, setDepartureMonth] = useState<string>(String(new Date().getMonth()));
    
    const departureYears = useMemo(() => {
        const years = new Set(employees.filter(e => e.checkOutDate).map(e => String(getYear(parseISO(e.checkOutDate!)))));
        return Array.from(years).sort((a,b) => Number(b) - Number(a));
    }, [employees]);

    const departuresByMonth = useMemo(() => {
        const departures = employees.filter(e => 
        e.checkOutDate && 
        getYear(parseISO(e.checkOutDate)) === Number(departureYear) &&
        (departureMonth === 'all' || getMonth(parseISO(e.checkOutDate)) === Number(departureMonth))
        );
        
        const counts = departures.reduce((acc, employee) => {
        const checkOutDate = parseISO(employee.checkOutDate!);
        let key;
        if (departureMonth === 'all') {
            key = format(checkOutDate, 'yyyy-MM');
        } else {
            key = format(checkOutDate, 'dd');
        }
        acc[key] = (acc[key] || 0) + 1;
        return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(counts)
        .map(([key, value]) => {
            let name;
            if (departureMonth === 'all') {
                name = format(new Date(key), 'MMM', { locale });
            } else {
                const date = new Date(Number(departureYear), Number(departureMonth), Number(key));
                name = format(date, 'dd MMM', { locale });
            }
            return { name, value };
        })
        .sort((a, b) => {
            if (departureMonth === 'all') {
                return new Date(a.name + ' 1, 2000').getTime() - new Date(b.name + ' 1, 2000').getTime();
            }
            return new Date(a.name).getTime() - new Date(b.name).getTime();
        });
    }, [employees, departureYear, departureMonth, locale]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('departuresChartTitle')}</CardTitle>
                <div className="flex gap-2 pt-2">
                    <Select value={departureYear} onValueChange={setDepartureYear}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {departureYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={departureMonth} onValueChange={setDepartureMonth}>
                        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('allMonths')}</SelectItem>
                            {Array.from({length: 12}).map((_, i) => (
                                <SelectItem key={i} value={String(i)}>{format(new Date(2000, i), 'LLLL', {locale})}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="pr-0 sm:pr-2 pl-4">
               <ChartContainer config={{value: {label: t('departuresTooltipLabel')}}} className="h-[400px] w-full">
                <ResponsiveContainer>
                    <BarChart data={departuresByMonth} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary) / 0.7)" />
                            <stop offset="100%" stopColor="hsl(var(--primary) / 0.2)" />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                    <XAxis 
                        dataKey="name" 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={10} 
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                        interval={0}
                    />
                    <YAxis 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={10} 
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                        allowDecimals={false}
                    />
                    <Tooltip 
                        cursor={{ fill: 'hsl(var(--accent) / 0.1)' }} 
                        content={({ active, payload, label }) => active && payload && payload.length && (
                            <div className="bg-background/95 p-3 rounded-lg border shadow-lg">
                                <p className="font-bold text-foreground">{label}</p>
                                <p className="text-sm text-primary">{`${payload[0].value} ${t('departuresTooltipLabel')}`}</p>
                            </div>
                        )}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="url(#chartGradient)" animationDuration={500}>
                      <LabelList dataKey="value" position="top" offset={10} className="fill-foreground font-semibold" />
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}

const DeductionsChart = ({ employees, currentLocale }: { employees: Employee[], currentLocale: string }) => {
    const t = useTranslations('Dashboard');
    const locale = localesMap[currentLocale] || pl;

    const [deductionYear, setDeductionYear] = useState<string>(String(new Date().getFullYear()));
    const [deductionMonth, setDeductionMonth] = useState<string>(String(new Date().getMonth()));

    const deductionYears = useMemo(() => {
        const years = new Set(employees.filter(e => e.checkOutDate).map(e => String(getYear(parseISO(e.checkOutDate!)))));
        return Array.from(years).sort((a,b) => Number(b) - Number(a));
    }, [employees]);

    const deductionsByTime = useMemo(() => {
        const employeesWithDeductions = employees.filter(e => 
            e.checkOutDate &&
            getYear(parseISO(e.checkOutDate)) === Number(deductionYear) &&
            (deductionMonth === 'all' || getMonth(parseISO(e.checkOutDate)) === Number(deductionMonth)) &&
            (
                (e.deductionRegulation || 0) > 0 ||
                (e.deductionNo4Months || 0) > 0 ||
                (e.deductionNo30Days || 0) > 0 ||
                (e.deductionReason?.some(d => d.checked && (d.amount || 0) > 0))
            )
        );
        
        const sums = employeesWithDeductions.reduce((acc, employee) => {
            const checkOutDate = parseISO(employee.checkOutDate!);
            let key;
            if (deductionMonth === 'all') {
                key = format(checkOutDate, 'yyyy-MM');
            } else {
                key = format(checkOutDate, 'dd');
            }

            const reasonDeductions = employee.deductionReason
                ?.filter(d => d.checked && d.amount)
                .reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
            
            const totalDeduction = (employee.deductionRegulation || 0) +
                                   (employee.deductionNo4Months || 0) +
                                   (employee.deductionNo30Days || 0) +
                                   reasonDeductions;

            acc[key] = (acc[key] || 0) + totalDeduction;
            return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(sums)
            .map(([key, value]) => {
                let name;
                if (deductionMonth === 'all') {
                    name = format(new Date(key), 'MMM', { locale });
                } else {
                    const date = new Date(Number(deductionYear), Number(deductionMonth), Number(key));
                    name = format(date, 'dd MMM', { locale });
                }
                return { name, value: parseFloat(value.toFixed(2)) };
            })
            .sort((a, b) => {
                if (deductionMonth === 'all') {
                    return new Date(a.name + ' 1, 2000').getTime() - new Date(b.name + ' 1, 2000').getTime();
                }
                return new Date(a.name).getTime() - new Date(b.name).getTime();
            });
    }, [employees, deductionYear, deductionMonth, locale]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('deductionsChartTitle')}</CardTitle>
                <div className="flex gap-2 pt-2">
                    <Select value={deductionYear} onValueChange={setDeductionYear}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {deductionYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={deductionMonth} onValueChange={setDeductionMonth}>
                        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('allMonths')}</SelectItem>
                            {Array.from({length: 12}).map((_, i) => (
                                <SelectItem key={i} value={String(i)}>{format(new Date(2000, i), 'LLLL', {locale})}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="pr-0 sm:pr-2 pl-4">
               <ChartContainer config={{value: {label: t('sumLabel')}}} className="h-[400px] w-full">
                <ResponsiveContainer>
                    <BarChart data={deductionsByTime} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <defs>
                        <linearGradient id="deductionGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--destructive) / 0.7)" />
                            <stop offset="100%" stopColor="hsl(var(--destructive) / 0.2)" />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                    <XAxis 
                        dataKey="name" 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={10} 
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                        interval={0}
                    />
                    <YAxis 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={10} 
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        allowDecimals={false}
                        tickFormatter={(value) => `${value} ${t('deductionsTooltipLabel')}`}
                    />
                    <Tooltip 
                        cursor={{ fill: 'hsl(var(--destructive) / 0.1)' }} 
                        content={({ active, payload, label }) => active && payload && payload.length && (
                            <div className="bg-background/95 p-3 rounded-lg border shadow-lg">
                                <p className="font-bold text-foreground">{label}</p>
                                <p className="text-sm text-destructive">{`${payload[0].value} ${t('deductionsTooltipLabel')}`}</p>
                            </div>
                        )}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="url(#deductionGradient)" animationDuration={500}>
                      <LabelList dataKey="value" position="top" offset={10} className="fill-foreground font-semibold" formatter={(value: number) => `${value} ${t('deductionsTooltipLabel')}`} />
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
};

export default function DashboardView({ employees, allEmployees, nonEmployees, settings, onEditEmployee, currentUser, selectedCoordinatorId, onSelectCoordinator, onDataRefresh }: DashboardViewProps) {
  const t = useTranslations('Dashboard');
  const { toast } = useToast();

  const [isHousingDialogOpen, setIsHousingDialogOpen] = useState(false);
  const [isCheckoutsDialogOpen, setIsCheckoutsDialogOpen] = useState(false);
  const [housingSearchTerm, setHousingSearchTerm] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<HousingAddress | null>(null);
  const [isAllEmployeesDialogOpen, setIsAllEmployeesDialogOpen] = useState(false);
  const [highlightAvailableForAddressId, setHighlightAvailableForAddressId] = useState<string | null>(null);
  const [currentLocale, setCurrentLocale] = useState('pl');

  useEffect(() => {
    // A simple way to get locale from URL path
    const localeFromPath = window.location.pathname.split('/')[1];
    if (localeFromPath && ['pl', 'en', 'uk', 'es'].includes(localeFromPath)) {
        setCurrentLocale(localeFromPath);
    }
  }, []);
  
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);
  const activeOccupants = useMemo(() => [...activeEmployees, ...nonEmployees], [activeEmployees, nonEmployees]);

  const apartmentsInUse = useMemo(() => [...new Set(activeOccupants.map(o => o.address))].length, [activeOccupants]);
  
  const upcomingCheckoutsList = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next30DaysEnd = new Date(today);
    next30DaysEnd.setDate(today.getDate() + 30);

    return employees
      .filter(e => e.status === 'active' && e.checkOutDate && isWithinInterval(parseISO(e.checkOutDate), { start: today, end: next30DaysEnd }))
      .sort((a, b) => parseISO(a.checkOutDate!).getTime() - parseISO(b.checkOutDate!).getTime());
  }, [employees]);
  
  const upcomingCheckoutsCount = upcomingCheckoutsList.length;

  const handleEmployeeClick = (employee: Employee) => {
    setIsCheckoutsDialogOpen(false);
    setIsHousingDialogOpen(false);
    setIsAllEmployeesDialogOpen(false);
    onEditEmployee(employee);
  };

  const handleAddressCardClick = (address: HousingAddress) => {
    setSelectedAddress(address);
    setIsHousingDialogOpen(true);
  };
  
  const handleAllEmployeesForAddressClick = (e: React.MouseEvent, address: HousingAddress) => {
    e.stopPropagation();
    setSelectedAddress(address);
    setIsAllEmployeesDialogOpen(true);
  }

  const handleAvailableClick = (e: React.MouseEvent, address: HousingAddress) => {
    e.stopPropagation();
    setHighlightAvailableForAddressId(address.id);
    handleAddressCardClick(address);
  };

  const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || 'N/A';

  const kpiData = [
    { title: t('allEmployeesKPI'), value: employees.filter(e => e.status === 'active').length, icon: Users, color: "text-blue-400" },
    { title: t('nonEmployeesKPI'), value: nonEmployees.length, icon: UserX, color: "text-purple-400" },
    { title: t('usedApartmentsKPI'), value: apartmentsInUse, icon: Building, color: "text-orange-400" },
  ];

  const housingOverview = useMemo(() => {
    let addressesToShow = settings.addresses;

    if (currentUser.isAdmin && selectedCoordinatorId !== 'all') {
        const coordinatorAddresses = new Set(
            employees
                .filter(e => e.coordinatorId === selectedCoordinatorId)
                .map(e => e.address)
        );
        addressesToShow = settings.addresses.filter(addr => coordinatorAddresses.has(addr.name));
    }

    const baseOverview = addressesToShow.map(address => {
      const occupied = activeOccupants.filter(e => e.address === address.name).length;
      const capacity = address.rooms.reduce((sum, room) => sum + room.capacity, 0);
      const available = capacity - occupied;
      const occupancy = capacity > 0 ? (occupied / capacity) * 100 : 0;
      return { ...address, occupied, available, capacity, occupancy };
    });

    if (!housingSearchTerm) {
      return baseOverview.sort((a, b) => b.occupancy - a.occupancy);
    }

    return baseOverview.filter(house =>
      house.name.toLowerCase().includes(housingSearchTerm.toLowerCase())
    ).sort((a, b) => b.occupancy - a.occupancy);
  }, [settings.addresses, activeOccupants, employees, housingSearchTerm, currentUser.isAdmin, selectedCoordinatorId]);
  
  const occupantsForSelectedAddress = useMemo(() => {
    if (!selectedAddress) return [];
    return activeOccupants.filter(e => e.address === selectedAddress.name);
  }, [activeOccupants, selectedAddress]);

  const aggregateData = (key: 'coordinatorId' | 'nationality' | 'zaklad') => {
    const counts = employees.filter(e => e.status === 'active').reduce((acc, employee) => {
      const value = employee[key];
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (key === 'coordinatorId') {
        return Object.entries(counts).map(([id, count]) => ({
            name: settings.coordinators.find(c => c.uid === id)?.name || id,
            value: count
        }));
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const nonEmployeesByAddress = useMemo(() => {
    const counts = nonEmployees.reduce((acc, person) => {
      const addressName = person.address || "Nieznany";
      acc[addressName] = (acc[addressName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [nonEmployees]);


  const employeesByCoordinator = useMemo(() => aggregateData('coordinatorId'), [employees, settings.coordinators]);
  const employeesByNationality = useMemo(() => aggregateData('nationality'), [employees]);
  const employeesByDepartment = useMemo(() => aggregateData('zaklad'), [employees]);

  return (
    <div className="space-y-6">
        {currentUser.isAdmin && (
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle>{t('filtersTitle')}</CardTitle>
                            <CardDescription>{t('filtersDescription')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <Select value={selectedCoordinatorId} onValueChange={onSelectCoordinator}>
                        <SelectTrigger className="w-full sm:w-72">
                            <div className="flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder={t('selectCoordinator')} />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('allCoordinators')}</SelectItem>
                            {settings.coordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
        )}
        <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">{t('summaryTab')}</TabsTrigger>
                <TabsTrigger value="housing">{t('housingTab')}</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="mt-6">
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {kpiData.map(kpi => (
                        <Card key={kpi.title} className="col-span-1">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                            <kpi.icon className={`h-4 w-4 text-muted-foreground ${kpi.color}`} />
                            </CardHeader>
                            <CardContent>
                            <div className="text-2xl font-bold">{kpi.value}</div>
                            </CardContent>
                        </Card>
                        ))}

                        <Dialog open={isCheckoutsDialogOpen} onOpenChange={setIsCheckoutsDialogOpen}>
                            <DialogTrigger asChild>
                                <Card className="cursor-pointer hover:border-primary transition-colors col-span-2 sm:col-span-1">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">{t('checkoutsKPI')}</CardTitle>
                                        <UserMinus className="h-4 w-4 text-muted-foreground text-red-400" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{upcomingCheckoutsCount}</div>
                                    </CardContent>
                                </Card>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
                                <DialogHeader>
                                    <DialogTitle>{t('checkoutsDialogTitle')}</DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="h-[60vh]">
                                <div className="pr-4">
                                    {upcomingCheckoutsList.length > 0 ? (
                                        upcomingCheckoutsList.map(employee => (
                                            <Card key={employee.id} onClick={() => handleEmployeeClick(employee)} className="mb-3 cursor-pointer">
                                                <CardHeader>
                                                    <CardTitle className="text-base">{employee.fullName}</CardTitle>
                                                    <CardDescription>{getCoordinatorName(employee.coordinatorId)}</CardDescription>
                                                </CardHeader>
                                                <CardContent className="text-sm space-y-1">
                                                    <p><span className="font-semibold">{t('addressLabel')}</span> {employee.address}</p>
                                                    <p><span className="font-semibold">{t('checkoutDateLabel')}</span> {formatDate(employee.checkOutDate)}</p>
                                                </CardContent>
                                            </Card>
                                        ))
                                    ) : (
                                        <p className="text-center text-muted-foreground py-8">{t('noUpcomingCheckouts')}</p>
                                    )}
                                </div>
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                    </div>
                      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                          <VerticalChartComponent data={employeesByCoordinator} title={t('employeesByCoordinatorChart')} labelX={t('employeeLabel')}/>
                          <VerticalChartComponent data={employeesByNationality} title={t('employeesByNationalityChart')} labelX={t('employeeLabel')} />
                          <VerticalChartComponent data={employeesByDepartment} title={t('employeesByDepartmentChart')} labelX={t('employeeLabel')} />
                          <VerticalChartComponent data={nonEmployeesByAddress} title={t('nonEmployeesByAddressChart')} labelX={t('nonEmployeeLabelShort')}/>
                          <DeparturesChart employees={employees} currentLocale={currentLocale} />
                          <DeductionsChart employees={employees} currentLocale={currentLocale} />
                      </div>
                </div>
            </TabsContent>
            <TabsContent value="housing" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('housingOverviewTitle')}</CardTitle>
                        <CardDescription>{t('housingOverviewDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-1 mb-4">
                            <Input
                                placeholder={t('searchByAddress')}
                                value={housingSearchTerm}
                                onChange={(e) => setHousingSearchTerm(e.target.value)}
                                className="w-full max-w-sm"
                            />
                        </div>
                        <ScrollArea className="h-[60vh]">
                            <div className="space-y-4 pr-4">
                            {housingOverview.length > 0 ? (
                                housingOverview.map(house => (
                                    <Card key={house.id} onClick={() => handleAddressCardClick(house)} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                    <CardHeader className="pb-4">
                                        <CardTitle 
                                            className="text-lg md:text-xl truncate hover:underline"
                                            onClick={(e) => handleAllEmployeesForAddressClick(e, house)}
                                        >
                                            {house.name}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-4">
                                            <Progress value={house.occupancy} className="w-full h-3" />
                                            <span className="text-base font-medium text-muted-foreground shrink-0">{Math.round(house.occupancy)}%</span>
                                        </div>
                                        <div className="flex justify-between text-sm mt-3 text-muted-foreground">
                                            <span className="text-blue-500">{t('capacityLabel')} <span className="font-bold text-foreground">{house.capacity}</span></span>
                                            <span className="text-red-500">{t('occupiedLabel')} <span className="font-bold text-foreground">{house.occupied}</span></span>
                                            <span onClick={(e) => handleAvailableClick(e, house)} className="text-green-500 cursor-pointer hover:underline">{t('availableLabel')} <span className="font-bold text-foreground">{house.available}</span></span>
                                        </div>
                                    </CardContent>
                                    </Card>
                                ))
                            ) : (
                                <p className="text-center text-muted-foreground py-8">{t('noMatchingAddresses')}</p>
                            )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      
      {/* Dialog for Room/Employee drilldown */}
      <Dialog open={isHousingDialogOpen} onOpenChange={(isOpen) => {
          setIsHousingDialogOpen(isOpen);
          if (!isOpen) {
            setSelectedAddress(null);
            setHighlightAvailableForAddressId(null);
          }
      }}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
              {selectedAddress && (
                  <HousingDetailView 
                      address={selectedAddress}
                      allOccupants={activeOccupants}
                      onEmployeeClick={handleEmployeeClick}
                      highlightAvailable={highlightAvailableForAddressId === selectedAddress.id}
                  />
              )}
          </DialogContent>
      </Dialog>
      
      {/* Dialog for showing all employees for an address */}
      <Dialog open={isAllEmployeesDialogOpen} onOpenChange={setIsAllEmployeesDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
            {selectedAddress && (
                <>
                    <DialogHeader>
                        <DialogTitle>{t('allResidents')}</DialogTitle>
                        <DialogDescription>{selectedAddress.name}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh] mt-4">
                        {occupantsForSelectedAddress.map(occupant => {
                           const canClick = isEmployee(occupant);
                           return (
                               <Card key={occupant.id} onClick={() => canClick && handleEmployeeClick(occupant)} className={cn("mb-3", canClick && "cursor-pointer hover:bg-muted/50")}>
                                 <CardHeader>
                                   <CardTitle className="text-base">{occupant.fullName}</CardTitle>
                                   <CardDescription>
                                    {isEmployee(occupant)
                                        ? `${t('employeeLabel')} / ${t('roomLabel')}: ${occupant.roomNumber} / ${occupant.nationality}`
                                        : `${t('nonEmployeeLabelShort')} / ${t('roomLabel')}: ${occupant.roomNumber}`
                                    }
                                   </CardDescription>
                                 </CardHeader>
                               </Card>
                           )
                        })}
                    </ScrollArea>
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

    

    