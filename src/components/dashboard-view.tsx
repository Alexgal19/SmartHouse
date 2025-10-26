
"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart2, Briefcase, CalendarOff, Home, Building, UserCheck, ArrowUp, ArrowDown, X as XIcon, PlusCircle, Users, Bed, User as UserIcon, Copy, CalendarDays, BarChartHorizontal } from "lucide-react";
import type { Employee, NonEmployee, Settings, Inspection, SessionData } from "@/types";
import { differenceInDays, parseISO, isPast, getYear, getMonth, format, startOfMonth, isValid, endOfMonth, eachMonthOfInterval, isFuture } from 'date-fns';
import { pl, uk, es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { cn } from "@/lib/utils";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMainLayout } from '@/components/main-layout';

const t = (key: string) => key.split('.').pop() || key;
const useScopedI18n = (scope: string) => (key: string) => `${scope}.${key}`.split('.').pop() || key;
const useI18n = () => t;
const useCurrentLocale = () => 'pl' as const;

type Occupant = Employee | NonEmployee;

type RoomStat = {
    roomNumber: string;
    occupants: Occupant[];
    occupantCount: number;
    capacity: number;
    available: number;
};

type HousingStat = {
    name: string;
    occupants: Occupant[];
    occupantCount: number;
    capacity: number;
    available: number | typeof Infinity;
    rooms: RoomStat[];
};

type SortConfig = {
    key: keyof HousingStat | 'occupancy' | 'capacity';
    direction: 'ascending' | 'descending';
} | null;


const kpiIcons = {
    housedEmployees: (
        <Users className="h-6 w-6 text-primary" />
    ),
    nonEmployees: (
        <UserIcon className="h-6 w-6 text-purple-500" />
    ),
    apartmentsInUse: (
        <Building className="h-6 w-6 text-primary" />
    ),
    upcomingCheckouts: (
        <CalendarOff className="h-6 w-6 text-pink-500" />
    )
};


export default function DashboardView({ currentUser }: { currentUser: SessionData}) {
  const { 
    allEmployees, 
    allNonEmployees,
    settings,
    allInspections,
    selectedCoordinatorId,
    setSelectedCoordinatorId,
    handleEditEmployeeClick,
  } = useMainLayout();

  const translations = useScopedI18n('dashboard');
  const tGenders = useScopedI18n('genders');
  const tDismissed = useScopedI18n('dismissed');
  const tNationalities = useScopedI18n('nationalities');
  const currentLocale = useCurrentLocale();
  const [activeTab, setActiveTab] = useState('stats');
  const [activeBar, setActiveBar] = useState<string | null>(null);
  const [housingSearch, setHousingSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  
  const [selectedAddress, setSelectedAddress] = useState<HousingStat | null>(null);
  const [isHousingDetailOpen, setIsHousingDetailOpen] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState<RoomStat | null>(null);
  const [isRoomDetailOpen, setIsRoomDetailOpen] = useState(false);
  
  const [isAddressResidentsModalOpen, setIsAddressResidentsModalOpen] = useState(false);
  
  const [isUpcomingCheckoutsModalOpen, setIsUpcomingCheckoutsModalOpen] = useState(false);
  const [upcomingCheckoutsEmployees, setUpcomingCheckoutsEmployees] = useState<Employee[]>([]);

  const { isMobile } = useIsMobile();
  const { copyToClipboard } = useCopyToClipboard();
  
  const [penaltyChartYear, setPenaltyChartYear] = useState<string>(new Date().getFullYear().toString());
  const [penaltyChartMonth, setPenaltyChartMonth] = useState<string>('all');

  const [checkoutStatsYear, setCheckoutStatsYear] = useState<string>(new Date().getFullYear().toString());
  const [checkoutStatsMonth, setCheckoutStatsMonth] = useState<string>('all');
  
  const employeesForCoordinator = useMemo(() => {
    if (!allEmployees) return [];
    if (currentUser.isAdmin && selectedCoordinatorId === 'all') {
      return allEmployees;
    }
    return allEmployees.filter(e => e.coordinatorId === selectedCoordinatorId);
  }, [allEmployees, currentUser.isAdmin, selectedCoordinatorId]);

  const nonEmployeesForCoordinator = useMemo(() => {
    if (!allNonEmployees || !settings) return [];
    if (currentUser.isAdmin && selectedCoordinatorId === 'all') {
      return allNonEmployees;
    }
     const coordinatorAddresses = settings.addresses
      .filter(a => a.coordinatorId === selectedCoordinatorId)
      .map(a => a.name);

    return allNonEmployees.filter(ne => coordinatorAddresses.includes(ne.address));
  }, [allNonEmployees, settings, currentUser.isAdmin, selectedCoordinatorId]);

  const inspectionsForCoordinator = useMemo(() => {
    if (!allInspections) return [];
    if (currentUser.isAdmin && selectedCoordinatorId === 'all') {
      return allInspections;
    }
    return allInspections.filter(i => i.coordinatorId === selectedCoordinatorId);
  }, [allInspections, currentUser.isAdmin, selectedCoordinatorId]);

  const coordinatorsList = useMemo(() => {
    return settings?.coordinators.map(c => c.name) || [];
  }, [settings]);

  const dismissedEmployees = useMemo(() => {
    return allEmployees?.filter(e => e.status === 'dismissed') || [];
  }, [allEmployees]);
  
  const allEmployeesForStats = useMemo(() => {
      if (!allEmployees) return [];
      return [...employeesForCoordinator, ...dismissedEmployees.filter(de => employeesForCoordinator.some(e => e.id === de.id))];
  }, [employeesForCoordinator, dismissedEmployees]);
  
  const safeAddresses = useMemo(() => Array.isArray(settings?.addresses) ? settings.addresses : [], [settings]);
  
  const availablePenaltyYears = useMemo(() => {
    if(!dismissedEmployees) return [];
    const years = new Set<string>();
    dismissedEmployees.forEach(e => {
      if (e.checkOutDate) {
        const date = parseISO(e.checkOutDate);
        if (isValid(date)) {
          years.add(getYear(date).toString());
        }
      }
    });
    const currentYear = new Date().getFullYear().toString();
    if (!years.has(currentYear)) {
        years.add(currentYear);
    }
    return Array.from(years).sort((a,b) => b.localeCompare(a));
  }, [dismissedEmployees]);

  const availableCheckoutYears = useMemo(() => {
    if(!allEmployeesForStats) return [];
    const years = new Set<string>();
    allEmployeesForStats.forEach(e => {
        if (e.checkOutDate) {
            const date = parseISO(e.checkOutDate);
            if (isValid(date)) {
                years.add(getYear(date).toString());
            }
        }
    });
    const currentYear = new Date().getFullYear().toString();
    if (!years.has(currentYear)) {
        years.add(currentYear);
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [allEmployeesForStats]);
  
  const penaltyStats = useMemo(() => {
    if(!dismissedEmployees) return [];
    const penaltiesByMonth: Record<string, number> = {};

    dismissedEmployees.forEach(employee => {
      if (!employee.checkOutDate) return;

      const checkOutDate = parseISO(employee.checkOutDate);
      if (!isValid(checkOutDate)) return;

      const year = getYear(checkOutDate).toString();
      const month = getMonth(checkOutDate); 

      if (year !== penaltyChartYear) return;
      if (penaltyChartMonth !== 'all' && month !== parseInt(penaltyChartMonth)) return;
      
      const totalPenaltyForEmployee = (employee.deductionRegulation || 0) + (employee.deductionNo4Months || 0) + (employee.deductionNo30Days || 0);

      if (totalPenaltyForEmployee > 0) {
        const monthKey = format(startOfMonth(checkOutDate), 'yyyy-MM');
        if (!penaltiesByMonth[monthKey]) {
          penaltiesByMonth[monthKey] = 0;
        }
        penaltiesByMonth[monthKey] += totalPenaltyForEmployee;
      }
    });
    
    return Object.keys(penaltiesByMonth)
        .map(month => ({
            month,
            totalPenalties: penaltiesByMonth[month]
        }))
        .sort((a,b) => a.month.localeCompare(b.month));

  }, [dismissedEmployees, penaltyChartYear, penaltyChartMonth]);
  
   const checkoutStats = useMemo(() => {
    if(!allEmployeesForStats) return [];
    const monthlyData: Record<string, { checkedOut: number; upcoming: number }> = {};
    const year = parseInt(checkoutStatsYear);

    const yearMonths = eachMonthOfInterval({
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31)
    });

    yearMonths.forEach(monthDate => {
        const monthKey = format(monthDate, 'yyyy-MM');
        monthlyData[monthKey] = { checkedOut: 0, upcoming: 0 };
    });

    allEmployeesForStats.forEach(employee => {
        if (!employee.checkOutDate) return;
        const checkOutDate = parseISO(employee.checkOutDate);
        if (!isValid(checkOutDate) || getYear(checkOutDate) !== year) return;

        if (checkoutStatsMonth !== 'all' && getMonth(checkOutDate) !== parseInt(checkoutStatsMonth)) return;

        const monthKey = format(startOfMonth(checkOutDate), 'yyyy-MM');

        if (isPast(checkOutDate)) {
            monthlyData[monthKey].checkedOut++;
        } else if (isFuture(checkOutDate) || format(checkOutDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
            monthlyData[monthKey].upcoming++;
        }
    });

    return Object.keys(monthlyData)
        .map(month => ({ month, ...monthlyData[month] }))
        .sort((a, b) => a.month.localeCompare(b.month));

    }, [allEmployeesForStats, checkoutStatsYear, checkoutStatsMonth]);


  const stats = useMemo(() => {
    if (!employeesForCoordinator || !nonEmployeesForCoordinator || !inspectionsForCoordinator || !settings) {
        return null;
    }
    
    const activeEmployees = employeesForCoordinator;
    
    const relevantEmployees = activeEmployees;

    const allActiveOccupantsForHousing = [...activeEmployees, ...nonEmployeesForCoordinator]
    
    const housedEmployees = relevantEmployees.length;
    
    const upcomingCheckoutsList = relevantEmployees.filter(e => {
        if (!e.checkOutDate) return false;
        const today = new Date();
        const date = parseISO(e.checkOutDate);
        const diff = differenceInDays(date, today);
        return diff >= 0 && diff <= 30;
    });

    const employeesPerCoordinator = activeEmployees.reduce((acc, employee) => {
        const coordinatorName = settings.coordinators.find(c => c.uid === employee.coordinatorId)?.name || "Unassigned";
        if (!acc[coordinatorName]) {
            acc[coordinatorName] = { coordinator: coordinatorName, employees: 0 };
        }
        acc[coordinatorName].employees++;
        return acc;
    }, {} as Record<string, { coordinator: string, employees: number }>);
    
    const occupantsByNationality = relevantEmployees.reduce((acc, occupant) => {
      const nationalityKey = (occupant as Employee).nationality?.toLowerCase() || "unassigned";
      const nationality = tNationalities(nationalityKey as any) || (occupant as Employee).nationality;
      
      if (nationality) {
        if (!acc[nationality]) {
            acc[nationality] = { nationality, employees: 0 };
        }
        acc[nationality].employees++;
      }
      return acc;
    }, {} as Record<string, { nationality: string, employees: number }>);
    
    const employeesByGender = relevantEmployees.reduce((acc, employee) => {
        const genderKey = employee.gender || "unassigned";
        const gender = tGenders(genderKey.toLowerCase() as any) || genderKey;
        if (!acc[gender]) {
            acc[gender] = { gender, count: 0 };
        }
        acc[gender].count++;
        return acc;
    }, {} as Record<string, { gender: string, count: number }>);
    
    const employeesPerZaklad = relevantEmployees.reduce((acc, employee) => {
      const zaklad = employee.zaklad || "Unassigned";
      if (!acc[zaklad]) {
        acc[zaklad] = { zaklad, employees: 0 };
      }
      acc[zaklad].employees++;
      return acc;
    }, {} as Record<string, { zaklad: string; employees: number }>);

    let housingStats: HousingStat[] = [];
    
    const addressesInUse = new Set(relevantEmployees.map(o => o.address).filter((a): a is string => !!a));
    const allAddressNames = new Set(safeAddresses.map(a => a.name).filter((a): a is string => !!a));

    let addressesToDisplayNames: Set<string>;

    if (currentUser.isAdmin && selectedCoordinatorId === 'all') {
      addressesToDisplayNames = new Set([...Array.from(addressesInUse), ...Array.from(allAddressNames)]);
    } else {
      addressesToDisplayNames = new Set(settings.addresses.filter(a => a.coordinatorId === selectedCoordinatorId).map(a => a.name));
    }
    
    const apartmentsInUse = addressesInUse.size;

    housingStats = Array.from(addressesToDisplayNames).map(addressName => {
        if (!addressName) return null;
        const occupantsInAddress = allActiveOccupantsForHousing.filter(o => o.address === addressName);
        const addressDetails = safeAddresses.find(a => a.name === addressName);
        const totalCapacity = addressDetails?.rooms.reduce((sum, room) => sum + room.capacity, 0) || 0;
        
        const roomsWithOccupants = (addressDetails?.rooms || []).map(room => {
            const occupantsInRoom = occupantsInAddress.filter(o => o.roomNumber === room.name);
            return {
                roomNumber: room.name,
                occupants: occupantsInRoom,
                occupantCount: occupantsInRoom.length,
                capacity: room.capacity,
                available: room.capacity - occupantsInRoom.length,
            };
        }).sort((a,b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));

        return {
            name: addressName,
            occupants: occupantsInAddress,
            occupantCount: occupantsInAddress.length,
            capacity: totalCapacity,
            available: totalCapacity > 0 ? totalCapacity - occupantsInAddress.length : Infinity,
            rooms: roomsWithOccupants,
        };
    }).filter((stat): stat is HousingStat => stat !== null);

    const coordinatorScores: Record<string, { totalScore: number, count: number, name: string }> = {};
    if (settings.coordinators) {
      settings.coordinators.forEach(c => {
          coordinatorScores[c.name] = { totalScore: 0, count: 0, name: c.name };
      });
    }

    const coordinatorEffectiveness = Object.values(coordinatorScores)
      .map(({ name, totalScore, count }) => ({
        name,
        effectiveness: count > 0 ? parseFloat((totalScore / count).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.effectiveness - a.effectiveness);
      
    const dismissalReasons = dismissedEmployees.reduce((acc, employee) => {
        const reasonKey = "unspecified";
        const reason = translations(reasonKey as any) || reasonKey;
        if (!acc[reason]) {
            acc[reason] = { reason, count: 0 };
        }
        acc[reason].count++;
        return acc;
    }, {} as Record<string, { reason: string; count: number }>);


    return {
        totalEmployees: relevantEmployees.length,
        housedEmployees: housedEmployees,
        nonEmployeesCount: nonEmployeesForCoordinator.length,
        apartmentsInUse,
        upcomingCheckouts: upcomingCheckoutsList.length,
        upcomingCheckoutsList: upcomingCheckoutsList,
        employeesPerCoordinator: Object.values(employeesPerCoordinator),
        employeesByNationality: Object.values(occupantsByNationality).sort((a, b) => b.employees - a.employees),
        employeesByGender: Object.values(employeesByGender),
        employeesPerZaklad: Object.values(employeesPerZaklad).sort((a, b) => b.employees - a.employees),
        housingStats,
        coordinatorEffectiveness,
        dismissalReasons: Object.values(dismissalReasons),
    };
  }, [employeesForCoordinator, nonEmployeesForCoordinator, inspectionsForCoordinator, settings, selectedCoordinatorId, currentUser.isAdmin, safeAddresses, tGenders, tNationalities, dismissedEmployees, translations]);

  const sortedAndFilteredHousingStats = useMemo(() => {
    if (!stats) return [];
    let sortableItems = [...stats.housingStats];

    if (housingSearch) {
      sortableItems = sortableItems.filter(address => address.name.toLowerCase().includes(housingSearch.toLowerCase()));
    }
    
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'occupancy') {
          aValue = a.capacity > 0 ? (a.occupantCount / a.capacity) * 100 : 0;
          bValue = b.capacity > 0 ? (b.occupantCount / a.capacity) * 100 : 0;
        } else if (sortConfig.key === 'capacity') {
            aValue = a.capacity;
            bValue = b.capacity;
        } else {
          aValue = a[sortConfig.key as keyof HousingStat];
          bValue = b[sortConfig.key as keyof HousingStat];
        }

        if (aValue === Infinity) return 1;
        if (bValue === Infinity) return -1;
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return sortableItems;
  }, [stats, sortConfig, housingSearch]);
  
  const allHousingAddresses = useMemo(() => {
    if (!stats) return [];
    return [...new Set(stats.housingStats.map(s => s.name))].sort();
  }, [stats]);

  const kpiData = useMemo(() => {
    if (!stats) return [];
    return [
        { title: 'Wszyscy pracownicy', value: stats.totalEmployees.toString(), icon: kpiIcons.housedEmployees },
        { title: 'Mieszkańcy (NZ)', value: stats.nonEmployeesCount.toString(), icon: kpiIcons.nonEmployees },
        { title: 'Używane mieszkania', value: stats.apartmentsInUse.toString(), icon: kpiIcons.apartmentsInUse },
        { 
          title: 'Wykwaterowania (30 dni)', 
          value: stats.upcomingCheckouts.toString(), 
          icon: kpiIcons.upcomingCheckouts, 
          onClick: () => {
            setUpcomingCheckoutsEmployees(stats.upcomingCheckoutsList);
            setIsUpcomingCheckoutsModalOpen(true);
          } 
        },
  ]}, [stats, translations]);

  const mobileKpiData = useMemo(() => {
    if (!kpiData) return [];
    return kpiData.filter(kpi => kpi.title !== translations('housedEmployees'));
  }, [kpiData, translations]);


  const handleAddressClick = (address: HousingStat) => {
    setSelectedAddress(address);
    setIsHousingDetailOpen(true);
  };
  
  const handleRoomClick = (room: RoomStat) => {
    setSelectedRoom(room);
    setIsRoomDetailOpen(true);
  };

  const requestSort = (key: keyof HousingStat | 'occupancy' | 'capacity') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: keyof HousingStat | 'occupancy' | 'capacity') => {
    if (!sortConfig || sortConfig.key !== key) {
        return null;
    }
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4" />;
  };

  const renderHeader = (key: keyof HousingStat | 'occupancy' | 'capacity', label: string) => (
    <Button variant="ghost" onClick={() => requestSort(key)} className="px-2 py-1 h-auto">
      {label}
      {getSortIcon(key)}
    </Button>
  );
  
  const handleCopy = (data: Occupant[], title: string) => {
    const textToCopy = data.map(o => o.fullName).join('\n');
    copyToClipboard(textToCopy, t('copySuccess'));
  }

  const NoDataState = ({ message }: { message: string }) => (
    <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-border/50">
        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <BarChart2 className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm">{message}</p>
        </div>
    </div>
  );

  const getOccupancyColor = (percentage: number) => {
    if (percentage > 100) return "bg-purple-500";
    if (percentage >= 81) return "bg-green-500";
    if (percentage >= 51) return "bg-yellow-500";
    if (percentage > 20) return "bg-orange-500";
    return "bg-red-500";
  };
  
  const showCoordinatorChart = currentUser.isAdmin && selectedCoordinatorId === 'all';
  const showCoordinatorEffectivenessChart = currentUser.isAdmin && selectedCoordinatorId === 'all';

  const getLocaleForDateFns = () => {
    switch (currentLocale) {
      case 'pl': return pl;
      case 'uk': return uk;
      case 'es': return es;
      default: return undefined;
    }
  }

  const formatMonthTick = (tickItem: string) => {
    const date = parseISO(tickItem);
    if (!isValid(date)) return tickItem;
    return format(date, 'LLLL', { locale: getLocaleForDateFns() });
  }
  
  const penaltyChart = useMemo(() => (
    <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{tDismissed('penaltiesByMonth')}</CardTitle>
            <div className="flex gap-2">
                <Select value={penaltyChartYear} onValueChange={setPenaltyChartYear}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                        {availablePenaltyYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={penaltyChartMonth} onValueChange={setPenaltyChartMonth}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{tDismissed('allMonths')}</SelectItem>
                        {Array.from({length: 12}, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {format(new Date(2000, i), 'LLLL', { locale: getLocaleForDateFns() })}
                          </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent>
            {penaltyStats.length > 0 ? (
                <ChartContainer config={{}} className="h-64 w-full">
                    <ResponsiveContainer>
                        <BarChart data={penaltyStats} margin={isMobile ? { top: 20, right: 0, bottom: 5, left: 0 } : { top: 20, right: 20, bottom: 5, left: 0 }}>
                        <defs>
                            <linearGradient id="chart-penalties-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.1}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={isMobile ? 2 : 8} tickFormatter={formatMonthTick} />
                        <Tooltip cursor={false} content={<ChartTooltipContent />} />
                        <Bar dataKey="totalPenalties" name={translations('totalPenalties')} radius={[4, 4, 0, 0]} fill="url(#chart-penalties-gradient)" barSize={15}>
                            <LabelList 
                                dataKey="totalPenalties" 
                                position="top" 
                                offset={8}
                                className="fill-foreground font-semibold"
                                formatter={(value: number) => `${value} zł`}
                            />
                        </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            ) : (
                <NoDataState message={tDismissed('noPenaltyData')} />
            )}
        </CardContent>
    </Card>
  ), [penaltyStats, penaltyChartYear, penaltyChartMonth, availablePenaltyYears, isMobile, translations, tDismissed, getLocaleForDateFns, formatMonthTick]);

  const checkoutStatsChart = useMemo(() => (
    <Card className="lg:col-span-2 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
                <BarChartHorizontal className="h-6 w-6 text-primary" />
                <CardTitle>{translations('checkoutStats')}</CardTitle>
            </div>
            <div className="flex gap-2">
                <Select value={checkoutStatsYear} onValueChange={setCheckoutStatsYear}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder={translations('year')} />
                    </SelectTrigger>
                    <SelectContent>
                        {availableCheckoutYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={checkoutStatsMonth} onValueChange={setCheckoutStatsMonth}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder={translations('month')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{translations('allMonths')}</SelectItem>
                        {Array.from({length: 12}, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {format(new Date(2000, i), 'LLLL', { locale: getLocaleForDateFns() })}
                          </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent>
             {checkoutStats.some(d => d.checkedOut > 0 || d.upcoming > 0) ? (
                 <ChartContainer 
                    config={{
                        checkedOut: { label: translations('checkedOut'), color: "hsl(var(--destructive) / 0.7)" },
                        upcoming: { label: translations('upcoming'), color: "hsl(var(--primary))" }
                    }} 
                    className="h-80 w-full"
                >
                    <ResponsiveContainer>
                        <BarChart data={checkoutStats}>
                             <defs>
                                <linearGradient id="chart-checked-out-gradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.1}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                            <XAxis 
                                dataKey="month" 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={isMobile ? 2 : 8} 
                                tickFormatter={formatMonthTick}
                             />
                            <YAxis allowDecimals={false} />
                            <Tooltip cursor={false} content={<ChartTooltipContent />} />
                            <Bar dataKey="checkedOut" stackId="a" radius={[0, 0, 4, 4]} fill="url(#chart-checked-out-gradient)" barSize={25} />
                            <Bar dataKey="upcoming" stackId="a" radius={[4, 4, 0, 0]} fill="var(--color-upcoming)" barSize={25} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            ) : (
                <NoDataState message={translations('noCheckoutData')} />
            )}
        </CardContent>
    </Card>
  ), [checkoutStats, checkoutStatsYear, checkoutStatsMonth, availableCheckoutYears, isMobile, translations, getLocaleForDateFns, formatMonthTick]);
  
  const calculateChartHeight = (itemCount: number) => {
    const minHeight = 150;
    const heightPerItem = isMobile ? 30 : 35;
    const calculatedHeight = (isMobile ? 40 : 60) + (itemCount * heightPerItem); 
    return Math.max(minHeight, calculatedHeight);
  };

  const CoordinatorFilter = () => (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Filtry Główne</CardTitle>
        <CardDescription>Wybierz koordynatora, aby filtrować dane w całej aplikacji.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="coordinator-filter">Koordynator</Label>
            <Select value={selectedCoordinatorId} onValueChange={setSelectedCoordinatorId}>
              <SelectTrigger id="coordinator-filter">
                <SelectValue placeholder='Wszyscy Koordynatorzy' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszyscy Koordynatorzy</SelectItem>
                {settings?.coordinators.map(c => (
                  <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  const statsContent = useMemo(() => {
    if (!stats || !kpiData) return null;
    return (
     <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {kpiData.map((kpi) => (
            <Card key={kpi.title} onClick={kpi.onClick} className={cn(kpi.onClick && "cursor-pointer hover:bg-muted/50", "shadow-lg")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                {kpi.icon}
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                {kpi.description && <p className="text-xs text-muted-foreground">{kpi.description}</p>}
                </CardContent>
            </Card>
            ))}
        </div>
        
        <div className="grid gap-6 lg:grid-cols-2">
            {showCoordinatorChart && (
              <Card className="shadow-lg">
              <CardHeader className='pb-2'>
                  <CardTitle className="text-lg">Pracownicy wg koordynatora</CardTitle>
              </CardHeader>
              <CardContent>
                  {stats.employeesPerCoordinator.length > 0 ? (
                      <ChartContainer config={{}} className="w-full" style={{ height: calculateChartHeight(stats.employeesPerCoordinator.length) }}>
                      <ResponsiveContainer>
                          <BarChart 
                              data={stats.employeesPerCoordinator}
                              layout="vertical"
                              margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                              onMouseMove={(state) => {
                                  if (state.isTooltipActive) {
                                      setActiveBar(state.activePayload?.[0].payload.coordinator);
                                  } else {
                                      setActiveBar(null);
                                  }
                              }}
                              barSize={15}
                          >
                           <defs>
                                <linearGradient id="chart-coordinator-gradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                                </linearGradient>
                            </defs>
                          <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                          <YAxis 
                              dataKey="coordinator" 
                              type="category"
                              tickLine={false} 
                              axisLine={false} 
                              tickMargin={8} 
                              width={150}
                              className="text-xs"
                              interval={0}
                          />
                          <XAxis 
                              type="number" 
                              allowDecimals={false} 
                              tickLine={false} 
                              axisLine={false}
                          />
                          <Tooltip cursor={false} content={<ChartTooltipContent />} />
                          <Bar dataKey="employees" radius={[0, 4, 4, 0]} fill="url(#chart-coordinator-gradient)">
                              <LabelList dataKey="employees" position="right" offset={8} className="fill-foreground text-xs" />
                          </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                      </ChartContainer>
                  ) : (
                      <NoDataState message={'Brak danych do wyświetlenia na wykresie'} />
                  )}
              </CardContent>
              </Card>
            )}
            <Card className="shadow-lg">
            <CardHeader className='pb-2'>
                <CardTitle className="text-lg">Pracownicy wg narodowości</CardTitle>
            </CardHeader>
            <CardContent>
                {stats.employeesByNationality.length > 0 ? (
                    <ChartContainer config={{}} className="w-full" style={{ height: calculateChartHeight(stats.employeesByNationality.length) }}>
                    <ResponsiveContainer>
                        <BarChart 
                            data={stats.employeesByNationality} 
                            layout="vertical"
                            margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                            onMouseMove={(state) => {
                                if (state.isTooltipActive) {
                                    setActiveBar(state.activePayload?.[0].payload.nationality);
                                } else {
                                    setActiveBar(null);
                                }
                            }}
                            barSize={15}
                        >
                       <defs>
                            <linearGradient id="chart-nationality-gradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50"/>
                        <YAxis 
                            dataKey="nationality" 
                            type="category"
                            tickLine={false} 
                            axisLine={false} 
                            tickMargin={8}
                            width={150}
                            className="text-xs"
                            interval={0}
                        />
                        <XAxis 
                            type="number"
                            allowDecimals={false} 
                            tickLine={false} 
                            axisLine={false}
                        />
                        <Tooltip cursor={false} content={<ChartTooltipContent />} />
                        <Bar dataKey="employees" radius={[0, 4, 4, 0]} fill="url(#chart-nationality-gradient)">
                            <LabelList dataKey="employees" position="right" offset={8} className="fill-foreground text-xs" />
                        </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    </ChartContainer>
                ) : (
                    <NoDataState message={'Brak danych do wyświetlenia na wykresie'} />
                )}
            </CardContent>
            </Card>
        </div>
    </div>
  )}, [stats, kpiData, currentUser, showCoordinatorChart, showCoordinatorEffectivenessChart, translations, checkoutStatsChart, penaltyChart, setActiveBar, calculateChartHeight, selectedCoordinatorId, setSelectedCoordinatorId, settings]);

  const housingContent = useMemo(() => {
    if (!stats) return null;
    return (
        <Card>
            <CardHeader>
                <CardTitle>Przegląd zakwaterowania</CardTitle>
                <CardDescription>Poniżej znajduje się lista wszystkich mieszkań i ich obłożenie.</CardDescription>
                <div className="pt-2">
                    <Input 
                        placeholder="Szukaj po adresie..." 
                        value={housingSearch}
                        onChange={(e) => setHousingSearch(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[60vh]">
                    <div className="space-y-4 pr-6">
                        {sortedAndFilteredHousingStats.length > 0 ? sortedAndFilteredHousingStats.map((address) => {
                            const occupancyPercentage = address.capacity > 0 ? (address.occupantCount / address.capacity) * 100 : 0;
                            return (
                                <Card key={address.name} onClick={() => handleAddressClick(address)} className="cursor-pointer hover:shadow-md transition-shadow">
                                    <CardHeader>
                                        <CardTitle className="text-lg">{address.name}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Obłożenie</span>
                                            <span className="font-bold">{address.occupantCount} / {address.capacity > 0 ? address.capacity : 'N/A'}</span>
                                        </div>
                                        <div className="mt-2">
                                            {address.capacity > 0 ? (
                                                <Progress value={occupancyPercentage > 100 ? 100 : occupancyPercentage} className={cn("h-2", getOccupancyColor(occupancyPercentage))} />
                                            ) : (
                                                <div className="h-2 bg-muted rounded-full" />
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        }) : (
                            <p className="text-center text-muted-foreground py-10">Brak adresów pasujących do wyszukiwania.</p>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    )
  }, [stats, sortedAndFilteredHousingStats, housingSearch, translations, handleAddressClick, getOccupancyColor]);

  const MobileHousingCard = ({ address }: { address: HousingStat }) => {
    const occupancyPercentage = address.capacity > 0 ? (address.occupantCount / address.capacity) * 100 : 0;

    return (
      <Card className="glassmorphism-card shadow-lg" onClick={() => handleAddressClick(address)}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base truncate">{address.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className='flex items-center gap-2'>
              {address.capacity > 0 ? (
                  <>
                      <Progress value={occupancyPercentage > 100 ? 100 : occupancyPercentage} className={cn("h-2 w-full", getOccupancyColor(occupancyPercentage))} />
                      <span className='text-sm font-bold text-muted-foreground'>{Math.round(occupancyPercentage)}%</span>
                  </>
              ) : (
                  <span className='text-xs text-muted-foreground'></span>
              )}
            </div>
        </CardContent>
      </Card>
    );
  };

  const mobileContent = useMemo(() => {
    if (!stats || !mobileKpiData) return null;
    return (
    <div className="px-2 py-4 space-y-4 min-h-full">
      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 gap-4">
          {currentUser.isAdmin && <CoordinatorFilter />}
          {mobileKpiData.map((kpi) => (
            <Card key={kpi.title} onClick={kpi.onClick} className="text-center glassmorphism-card shadow-lg">
              <CardHeader className="p-4">
                <CardTitle className="text-base">{kpi.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-4xl font-bold">{kpi.value}</div>
                {kpi.description && <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>}
              </CardContent>
            </Card>
          ))}
          {currentUser.isAdmin && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>{tDismissed('penaltiesByMonth')}</CardTitle>
                <div className="flex gap-2">
                  <Select value={penaltyChartYear} onValueChange={setPenaltyChartYear}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePenaltyYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {penaltyStats.length > 0 ? (
                  <ChartContainer config={{}} className="h-64 w-full">
                    <ResponsiveContainer>
                      <BarChart data={penaltyStats} margin={{ top: 20, right: 0, bottom: 5, left: 0 }}>
                        <defs>
                          <linearGradient id="chart-penalties-gradient-mobile" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatMonthTick} />
                        <Tooltip cursor={false} content={<ChartTooltipContent />} />
                        <Bar dataKey="totalPenalties" name={translations('totalPenalties')} radius={[4, 4, 0, 0]} fill="url(#chart-penalties-gradient-mobile)" barSize={20}>
                          <LabelList 
                            dataKey="totalPenalties" 
                            position="top" 
                            offset={8}
                            className="fill-foreground font-semibold text-xs"
                            formatter={(value: number) => `${value} zł`}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <NoDataState message={tDismissed('noPenaltyData')} />
                )}
              </CardContent>
            </Card>
          )}
          {showCoordinatorChart && (
            <Card className="shadow-lg">
              <CardHeader className='pb-2'>
                <CardTitle className="text-base">{translations('employeesPerCoordinator')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="w-full" style={{ height: calculateChartHeight(stats.employeesPerCoordinator.length) }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.employeesPerCoordinator} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }} barSize={15}>
                      <defs>
                        <linearGradient id="chart-coordinator-gradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                      <YAxis dataKey="coordinator" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} className="text-xs" interval={0} />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar dataKey="employees" radius={[0, 4, 4, 0]} fill="url(#chart-coordinator-gradient)">
                        <LabelList dataKey="employees" position="right" offset={8} className="fill-foreground text-xs" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
          <Card className="shadow-lg">
            <CardHeader className='pb-2'>
              <CardTitle className="text-base">{translations('employeesByNationality')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="w-full" style={{ height: calculateChartHeight(stats.employeesByNationality.length) }}>
                <ResponsiveContainer>
                  <BarChart data={stats.employeesByNationality} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }} barSize={15}>
                    <defs>
                      <linearGradient id="chart-nationality-gradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50"/>
                    <YAxis dataKey="nationality" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} className="text-xs" interval={0} />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="employees" radius={[0, 4, 4, 0]} fill="url(#chart-nationality-gradient)">
                      <LabelList dataKey="employees" position="right" offset={8} className="fill-foreground text-xs" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader className='pb-2'>
              <CardTitle className="text-base">{translations('employeesByGender')}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.employeesByGender.length > 0 ? (
                <ChartContainer config={{}} className="w-full" style={{ height: calculateChartHeight(stats.employeesByGender.length) }}>
                  <ResponsiveContainer>
                    <BarChart 
                      data={stats.employeesByGender} 
                      layout="vertical"
                      margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                      barSize={15}
                    >
                      <defs>
                        <linearGradient id="chart-gender-gradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50"/>
                      <YAxis 
                        dataKey="gender" 
                        type="category"
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={8}
                        width={120}
                        className="text-xs"
                        interval={0}
                      />
                      <XAxis 
                        type="number"
                        allowDecimals={false} 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <Tooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar dataKey="count" name={translations('employees')} radius={[0, 4, 4, 0]} fill="url(#chart-gender-gradient)">
                        <LabelList dataKey="count" position="right" offset={8} className="fill-foreground text-xs" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <NoDataState message={translations('noDataForChart')} />
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {activeTab === 'housing' && 
        (<div className="space-y-4">
          <Card className="glassmorphism-card shadow-lg">
            <CardHeader>
                <CardTitle>{translations('housingFund')}</CardTitle>
                <CardDescription>{translations('housingFundDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-2 w-full">
                     <Input 
                        placeholder="Szukaj po adresie..." 
                        value={housingSearch}
                        onChange={(e) => setHousingSearch(e.target.value)}
                    />
                </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-2">
            {sortedAndFilteredHousingStats.length > 0 ? sortedAndFilteredHousingStats.map((address, index) => (
              <MobileHousingCard key={`${address.name}-${index}`} address={address} />
            )) : (
                <p className="text-center text-muted-foreground py-10">Brak adresów pasujących do wyszukiwania.</p>
            )}
          </div>
        </div>)
      }
    </div>
  )}, [stats, activeTab, currentUser, allHousingAddresses, sortedAndFilteredHousingStats, tDismissed, penaltyChartYear, availablePenaltyYears, penaltyStats, translations, handleAddressClick, calculateChartHeight, showCoordinatorChart, mobileKpiData, formatMonthTick, getLocaleForDateFns, housingSearch]);
  
  const groupedRooms = useMemo(() => {
    if (!selectedAddress) return {};
    return selectedAddress.rooms.reduce((acc, room) => {
      const roomPrefix = room.roomNumber.split('.')[0];
      if (!acc[roomPrefix]) {
        acc[roomPrefix] = [];
      }
      acc[roomPrefix].push(room);
      return acc;
    }, {} as Record<string, RoomStat[]>);
  }, [selectedAddress]);
  
  if (!stats) return null;

  return (
    <>
    <div className="grid gap-6 p-4 sm:p-6">
      {isMobile ? mobileContent : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
             <div className="space-y-6">
                {currentUser.isAdmin && <CoordinatorFilter />}
                 <TabsList className="mb-4 grid w-full grid-cols-2">
                    <TabsTrigger value="stats">Podsumowanie</TabsTrigger>
                    <TabsTrigger value="housing">Zakwaterowanie</TabsTrigger>
                </TabsList>
            </div>
          <TabsContent value="stats">{statsContent}</TabsContent>
          <TabsContent value="housing">{housingContent}</TabsContent>
        </Tabs>
      )}
      </div>

      <Dialog open={isHousingDetailOpen} onOpenChange={setIsHousingDetailOpen}>
        <DialogContent className="max-w-3xl flex flex-col h-screen sm:h-[90vh]">
          {selectedAddress && (
            <>
              <DialogHeader>
                <Button variant="link" className="p-0 h-auto justify-start text-lg text-primary" onClick={() => {setIsHousingDetailOpen(false); setIsAddressResidentsModalOpen(true);}}>
                    {selectedAddress.name}
                </Button>
                <DialogDescription>{translations('housingFundDescription')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center py-4">
                      <div>
                          <p className="text-xs text-muted-foreground">{translations('occupied')}</p>
                          <p className="font-bold text-lg text-red-600">{selectedAddress.occupantCount}</p>
                      </div>
                      <div>
                          <p className="text-xs text-muted-foreground">{translations('available')}</p>
                          <p className="font-bold text-lg text-green-600">{isFinite(selectedAddress.available) ? selectedAddress.available : '∞'}</p>
                      </div>
                      <div>
                          <p className="text-xs text-muted-foreground">{translations('totalCapacity')}</p>
                          <p className="font-bold text-lg text-primary">{selectedAddress.capacity > 0 ? selectedAddress.capacity : ''}</p>
                      </div>
                  </div>
                  <Separator />
              </div>
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  <h4 className="font-medium text-sm text-primary">{translations('roomDetails')}</h4>
                  <ScrollArea className="flex-1 -mr-6 pr-6">
                      <div className="space-y-4">
                        {Object.entries(groupedRooms).map(([groupNumber, roomsInGroup]) => (
                        <Card key={groupNumber} className="shadow-sm">
                            <CardHeader className="p-3">
                            <CardTitle className="text-base">{translations('roomNumber')} {groupNumber}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 space-y-2">
                            {roomsInGroup.map((room) => (
                                <div key={room.roomNumber} onClick={() => handleRoomClick(room)} className="flex justify-between items-center cursor-pointer hover:bg-muted/50 p-2 rounded-md">
                                <span className="font-medium">{room.roomNumber}</span>
                                <div className={cn("flex items-center gap-2 font-bold", room.available > 0 ? 'text-green-600' : 'text-red-600')}>
                                    <span>{room.available}</span>
                                    <Bed className="h-4 w-4" />
                                </div>
                                </div>
                            ))}
                            </CardContent>
                        </Card>
                        ))}
                    </div>
                  </ScrollArea>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={isAddressResidentsModalOpen} onOpenChange={setIsAddressResidentsModalOpen}>
        <DialogContent className="max-w-md flex flex-col h-screen sm:h-[80vh]">
          {selectedAddress && (
            <>
              <DialogHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <DialogTitle className="text-primary">{selectedAddress.name}</DialogTitle>
                      <DialogDescription>{translations('residentsList')}</DialogDescription>
                    </div>
                    <UiTooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleCopy(selectedAddress.occupants, selectedAddress.name)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('copyList')}</p>
                      </TooltipContent>
                    </UiTooltip>
                  </div>
              </DialogHeader>
              <ScrollArea className="flex-1 -mr-6 pr-6">
                <div className="space-y-2">
                    {selectedAddress.occupants.length > 0 ? selectedAddress.occupants.map((occupant, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-md bg-muted/50 shadow-sm">
                        <UserIcon className="h-5 w-5 text-primary" />
                        <span className="font-medium text-sm">{occupant.fullName}</span>
                    </div>
                    )) : (
                    <p className='text-center text-muted-foreground p-4'>{translations('noResidents')}</p>
                    )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isRoomDetailOpen} onOpenChange={setIsRoomDetailOpen}>
        <DialogContent className="max-w-md flex flex-col h-screen sm:h-[80vh]">
          {selectedRoom && (
            <>
              <DialogHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <DialogTitle className="text-primary">{translations('roomNumber')} {selectedRoom.roomNumber}</DialogTitle>
                      <DialogDescription>{translations('residentsList')}</DialogDescription>
                    </div>
                    <UiTooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleCopy(selectedRoom.occupants, `${translations('roomNumber')} ${selectedRoom.roomNumber}`)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('copyList')}</p>
                      </TooltipContent>
                    </UiTooltip>
                  </div>
              </DialogHeader>
              <ScrollArea className="flex-1 -mr-6 pr-6">
                <div className="space-y-2">
                   {selectedRoom.occupants.length > 0 ? selectedRoom.occupants.map((occupant, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded-md bg-muted/50 shadow-sm">
                          <UserIcon className="h-5 w-5 text-primary" />
                          <span className="font-medium text-sm">{occupant.fullName}</span>
                      </div>
                   )) : (
                      <p className='text-center text-muted-foreground p-4'>{translations('noResidents')}</p>
                   )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isUpcomingCheckoutsModalOpen} onOpenChange={setIsUpcomingCheckoutsModalOpen}>
        <DialogContent className="flex flex-col h-screen sm:h-[90vh] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{translations('upcomingCheckouts')}</DialogTitle>
            <DialogDescription>{translations('inNext30Days')}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 -mr-6 pr-6">
            <div className="space-y-2 p-1">
              {upcomingCheckoutsEmployees.length > 0 ? (
                upcomingCheckoutsEmployees.map(employee => (
                  <Card 
                    key={employee.id} 
                    className="p-4 cursor-pointer hover:bg-muted/50 shadow-sm"
                    onClick={() => {
                      handleEditEmployeeClick(employee);
                      setIsUpcomingCheckoutsModalOpen(false);
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold">{employee.fullName}</span>
                      <span className="text-sm text-primary font-bold whitespace-nowrap">{employee.checkOutDate}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <p>{employee.coordinatorId}</p>
                      <p>{employee.zaklad}</p>
                      <p>{employee.address || ''} {employee.roomNumber ? `, ${translations('roomNumber')} ${employee.roomNumber}` : ''}</p>
                    </div>
                  </Card>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground py-4">{t('dashboard.noDataForChart')}</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}