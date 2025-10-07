
"use client";

import type { Employee, Settings, HousingAddress, Coordinator, Room } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, LabelList, Cell } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { useMemo, useState } from "react";
import { Building, UserMinus, Users, Home, BedDouble, ChevronRight, ChevronDown, UserCheck } from "lucide-react";
import { isWithinInterval, format, getYear, getMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "./ui/scroll-area";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface DashboardViewProps {
  employees: Employee[];
  settings: Settings;
  onEditEmployee: (employee: Employee) => void;
  currentUser: Coordinator;
  selectedCoordinatorId: string;
  onSelectCoordinator: (id: string) => void;
}


// New component for detailed housing view
const HousingDetailView = ({
  address,
  employees,
  onEmployeeClick,
  highlightAvailable,
}: {
  address: HousingAddress;
  employees: Employee[];
  onEmployeeClick: (employee: Employee) => void;
  highlightAvailable: boolean;
}) => {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  const rooms = useMemo(() => {
    const roomMap = new Map<string, { occupants: Employee[], capacity: number }>();
    
    // Initialize with all rooms from settings
    address.rooms.forEach(room => {
        roomMap.set(room.name, { occupants: [], capacity: room.capacity });
    });

    // Populate with employees
    employees.forEach(employee => {
      if (employee.address === address.name) {
        if (!roomMap.has(employee.roomNumber)) {
          // Add room if not in settings, assume capacity is number of occupants
          roomMap.set(employee.roomNumber, { occupants: [], capacity: 0 });
        }
        const roomData = roomMap.get(employee.roomNumber)!;
        roomData.occupants.push(employee);
        if (roomData.capacity === 0) { // Dynamically set capacity for rooms not in settings
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

  }, [employees, address]);

  if (selectedRoom) {
    const roomData = rooms.find(r => r.roomNumber === selectedRoom);
    const occupants = roomData?.occupants || [];
    return (
      <div>
        <Button variant="ghost" onClick={() => setSelectedRoom(null)} className="mb-4">
          &larr; Wróć do pokoi
        </Button>
        <DialogHeader>
          <DialogTitle>Pracownicy w pokoju {selectedRoom}</DialogTitle>
          <DialogDescription>{address.name}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] mt-4">
          {occupants.length > 0 ? (
            occupants.map(employee => (
            <Card key={employee.id} onClick={() => onEmployeeClick(employee)} className="mb-3 cursor-pointer hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">{employee.fullName}</CardTitle>
                <CardDescription>{employee.nationality}</CardDescription>
              </CardHeader>
            </Card>
          ))
          ) : (
             <p className="text-center text-muted-foreground pt-8">Brak pracowników w tym pokoju.</p>
          )}
        </ScrollArea>
      </div>
    );
  }

  return (
    <div>
       <DialogHeader>
          <DialogTitle>{address.name}</DialogTitle>
          <DialogDescription>Wybierz pokój, aby zobaczyć mieszkańców</DialogDescription>
        </DialogHeader>
      <ScrollArea className="h-[60vh] mt-4">
        <div className="space-y-3">
          {rooms.map(({ roomNumber, occupants, available }) => {
            const hasAvailability = available > 0;
            return (
                <Card key={roomNumber} onClick={() => setSelectedRoom(roomNumber)} className={cn("cursor-pointer hover:bg-muted/50 transition-colors", highlightAvailable && hasAvailability && "bg-green-100 dark:bg-green-900/30 border-green-500")}>
                <CardHeader className="flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BedDouble className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Pokój {roomNumber}</CardTitle>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant={highlightAvailable && hasAvailability ? 'default' : 'secondary'} className={cn(highlightAvailable && hasAvailability && 'bg-green-600')}>{occupants.length} / {occupants.length + available}</Badge>
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


export default function DashboardView({ employees, settings, onEditEmployee, currentUser, selectedCoordinatorId, onSelectCoordinator }: DashboardViewProps) {
  const [isHousingDialogOpen, setIsHousingDialogOpen] = useState(false);
  const [isCheckoutsDialogOpen, setIsCheckoutsDialogOpen] = useState(false);
  const [housingSearchTerm, setHousingSearchTerm] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<HousingAddress | null>(null);
  const [isAllEmployeesDialogOpen, setIsAllEmployeesDialogOpen] = useState(false);
  const [highlightAvailableForAddressId, setHighlightAvailableForAddressId] = useState<string | null>(null);
  
  const [departureYear, setDepartureYear] = useState<string>(String(new Date().getFullYear()));
  const [departureMonth, setDepartureMonth] = useState<string>('all');


  const { isMobile } = useIsMobile();
  
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);
  const apartmentsInUse = useMemo(() => [...new Set(activeEmployees.map(e => e.address))].length, [activeEmployees]);
  
  const upcomingCheckoutsList = useMemo(() => {
    const today = new Date();
    const next30Days = { start: today, end: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) };
    return activeEmployees
      .filter(e => e.contractEndDate && isWithinInterval(e.contractEndDate, next30Days))
      .sort((a, b) => a.contractEndDate!.getTime() - b.contractEndDate!.getTime());
  }, [activeEmployees]);
  
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
    { title: "Wszyscy pracownicy", value: activeEmployees.length, icon: Users, color: "text-blue-400" },
    { title: "Używane mieszkania", value: apartmentsInUse, icon: Building, color: "text-orange-400" },
  ];

  const housingOverview = useMemo(() => {
    let addressesToShow = settings.addresses;

    if (currentUser.isAdmin && selectedCoordinatorId !== 'all') {
        const coordinatorAddresses = new Set(
            activeEmployees
                .filter(e => e.coordinatorId === selectedCoordinatorId)
                .map(e => e.address)
        );
        addressesToShow = settings.addresses.filter(addr => coordinatorAddresses.has(addr.name));
    }

    const baseOverview = addressesToShow.map(address => {
      const occupied = activeEmployees.filter(e => e.address === address.name).length;
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
  }, [settings.addresses, activeEmployees, housingSearchTerm, currentUser.isAdmin, selectedCoordinatorId]);
  
  const employeesForSelectedAddress = useMemo(() => {
    if (!selectedAddress) return [];
    return activeEmployees.filter(e => e.address === selectedAddress.name);
  }, [activeEmployees, selectedAddress]);

  const aggregateData = (key: 'coordinatorId' | 'nationality' | 'zaklad') => {
    const counts = activeEmployees.reduce((acc, employee) => {
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

  const departureYears = useMemo(() => {
    const years = new Set(employees.filter(e => e.checkOutDate).map(e => String(getYear(e.checkOutDate!))));
    return Array.from(years).sort((a,b) => Number(b) - Number(a));
  }, [employees]);

  const departuresByMonth = useMemo(() => {
    const departures = employees.filter(e => 
      e.checkOutDate && 
      getYear(e.checkOutDate) === Number(departureYear) &&
      (departureMonth === 'all' || getMonth(e.checkOutDate) === Number(departureMonth))
    );
    
    const counts = departures.reduce((acc, employee) => {
      let key;
      if (departureMonth === 'all') {
         key = format(employee.checkOutDate!, 'yyyy-MM');
      } else {
         key = format(employee.checkOutDate!, 'dd');
      }
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .map(([key, value]) => {
          let name;
          if (departureMonth === 'all') {
            name = format(new Date(key), 'MMM', { locale: pl });
          } else {
            const date = new Date(Number(departureYear), Number(departureMonth), Number(key));
            name = format(date, 'dd MMM', { locale: pl });
          }
          return { name, value };
      })
      .sort((a, b) => {
          if (departureMonth === 'all') {
            return new Date(a.name + ' 1, 2000').getTime() - new Date(b.name + ' 1, 2000').getTime();
          }
          return new Date(a.name).getTime() - new Date(b.name).getTime();
      });
  }, [employees, departureYear, departureMonth]);


  const employeesByCoordinator = useMemo(() => aggregateData('coordinatorId'), [activeEmployees, settings.coordinators]);
  const employeesByNationality = useMemo(() => aggregateData('nationality'), [activeEmployees]);
  const employeesByDepartment = useMemo(() => aggregateData('zaklad'), [activeEmployees]);

 const chartConfig = {
    value: { label: "Pracownicy" },
  };
  
  const chartColors = [
    { from: 'hsl(var(--chart-1))', to: 'hsl(var(--chart-2))', id: 'grad1' },
    { from: 'hsl(var(--chart-2))', to: 'hsl(var(--chart-3))', id: 'grad2' },
    { from: 'hsl(var(--chart-3))', to: 'hsl(var(--chart-4))', id: 'grad4' },
    { from: 'hsl(var(--chart-4))', to: 'hsl(var(--chart-5))', id: 'grad5' },
    { from: 'hsl(var(--chart-5))', to: 'hsl(var(--chart-1))', id: 'grad5' },
  ];

  const ChartComponent = ({ data, title, labelY }: { data: {name: string, value: number}[], title: string, labelY?: string }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pl-0 sm:pl-2">
        <ChartContainer config={{value: {label: labelY || "Pracownicy"}}} className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 20, right: 20, left: isMobile ? -20 : -10, bottom: isMobile ? 15 : 5 }} barSize={isMobile ? 25 : 50}>
               <defs>
                {chartColors.map((color, index) => (
                  <linearGradient id={color.id} x1="0" y1="0" x2="0" y2="1" key={index}>
                    <stop offset="5%" stopColor={color.from} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={color.to} stopOpacity={0.8}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
              <XAxis 
                dataKey="name" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={10} 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                interval={0}
                angle={isMobile ? -35 : 0}
                dy={isMobile ? 10 : 0}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip 
                cursor={{ fill: 'hsl(var(--accent) / 0.1)' }} 
                content={({ active, payload, label }) => active && payload && payload.length && (
                    <div className="bg-background/95 p-3 rounded-lg border shadow-lg">
                        <p className="font-bold text-foreground">{label}</p>
                        <p className="text-sm text-primary">{`${payload[0].value} ${labelY || 'pracowników'}`}</p>
                    </div>
                )}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} >
                <LabelList dataKey="value" position="top" offset={10} className="fill-foreground font-semibold" />
                 {data.map((entry, index) => {
                    const color = chartColors[index % chartColors.length];
                    return <Cell key={`cell-${index}`} fill={`url(#${color.id})`} />
                 })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
        {currentUser.isAdmin && (
            <Card>
                <CardHeader>
                    <CardTitle>Filtr Koordynatora</CardTitle>
                    <CardDescription>Wybierz koordynatora, aby wyświetlić jego dane.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Select value={selectedCoordinatorId} onValueChange={onSelectCoordinator}>
                        <SelectTrigger className="w-full sm:w-72">
                            <div className="flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Wybierz koordynatora" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszyscy Koordynatorzy</SelectItem>
                            {settings.coordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
        )}
        <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Podsumowanie</TabsTrigger>
                <TabsTrigger value="housing">Zakwaterowanie</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="mt-6">
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {kpiData.map(kpi => (
                        <Card key={kpi.title}>
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
                                <Card className="cursor-pointer hover:border-primary transition-colors">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Nadchodzące wykwaterowania (30 dni)</CardTitle>
                                        <UserMinus className="h-4 w-4 text-muted-foreground text-red-400" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{upcomingCheckoutsCount}</div>
                                    </CardContent>
                                </Card>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
                                <DialogHeader>
                                    <DialogTitle>Pracownicy z nadchodzącym terminem wykwaterowania</DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="h-full">
                                <div className="pr-4">
                                    {upcomingCheckoutsList.length > 0 ? (
                                        upcomingCheckoutsList.map(employee => (
                                            <Card key={employee.id} onClick={() => handleEmployeeClick(employee)} className="mb-3 cursor-pointer">
                                                <CardHeader>
                                                    <CardTitle className="text-base">{employee.fullName}</CardTitle>
                                                    <CardDescription>{getCoordinatorName(employee.coordinatorId)}</CardDescription>
                                                </CardHeader>
                                                <CardContent className="text-sm space-y-1">
                                                    <p><span className="font-semibold">Adres:</span> {employee.address}</p>
                                                    <p><span className="font-semibold">Data wyjazdu:</span> {employee.contractEndDate ? format(employee.contractEndDate, 'dd-MM-yyyy') : 'N/A'}</p>
                                                </CardContent>
                                            </Card>
                                        ))
                                    ) : (
                                        <p className="text-center text-muted-foreground py-8">Brak pracowników z nadchodzącym terminem wyjazdu.</p>
                                    )}
                                </div>
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                    </div>
                    {!isMobile && (
                      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                          <ChartComponent data={employeesByCoordinator} title="Pracownicy wg koordynatora" />
                          <ChartComponent data={employeesByNationality} title="Pracownicy wg narodowości" />
                          <ChartComponent data={employeesByDepartment} title="Pracownicy wg zakładu" />
                          <Card>
                              <CardHeader>
                                  <CardTitle>Statystyka wyjazdów</CardTitle>
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
                                              <SelectItem value="all">Wszystkie miesiące</SelectItem>
                                              {Array.from({length: 12}).map((_, i) => (
                                                  <SelectItem key={i} value={String(i)}>{format(new Date(2000, i), 'LLLL', {locale: pl})}</SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                  </div>
                              </CardHeader>
                              <CardContent className="pl-0 sm:pl-2">
                                  <ChartContainer config={{value: {label: "Wyjazdy"}}} className="h-64 w-full">
                                  <ResponsiveContainer>
                                      <BarChart data={departuresByMonth} margin={{ top: 20, right: 20, left: isMobile ? -20 : -10, bottom: isMobile ? 15 : 5 }} barSize={isMobile ? 25 : 50}>
                                      <defs>
                                          {chartColors.map((color, index) => (
                                          <linearGradient id={color.id} x1="0" y1="0" x2="0" y2="1" key={index}>
                                              <stop offset="5%" stopColor={color.from} stopOpacity={0.8}/>
                                              <stop offset="95%" stopColor={color.to} stopOpacity={0.8}/>
                                          </linearGradient>
                                          ))}
                                      </defs>
                                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                                      <XAxis 
                                          dataKey="name" 
                                          tickLine={false} 
                                          axisLine={false} 
                                          tickMargin={10} 
                                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                                          interval={0}
                                          angle={isMobile ? -35 : 0}
                                          dy={isMobile ? 10 : 0}
                                      />
                                      <YAxis tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                                      <Tooltip 
                                          cursor={{ fill: 'hsl(var(--accent) / 0.1)' }} 
                                          content={({ active, payload, label }) => active && payload && payload.length && (
                                              <div className="bg-background/95 p-3 rounded-lg border shadow-lg">
                                                  <p className="font-bold text-foreground">{label}</p>
                                                  <p className="text-sm text-primary">{`${payload[0].value} wyjazdów`}</p>
                                              </div>
                                          )}
                                      />
                                      <Bar dataKey="value" radius={[8, 8, 0, 0]} >
                                          <LabelList dataKey="value" position="top" offset={10} className="fill-foreground font-semibold" />
                                          {departuresByMonth.map((entry, index) => {
                                              const color = chartColors[index % chartColors.length];
                                              return <Cell key={`cell-${index}`} fill={`url(#${color.id})`} />
                                          })}
                                      </Bar>
                                      </BarChart>
                                  </ResponsiveContainer>
                                  </ChartContainer>
                              </CardContent>
                          </Card>
                          </div>
                      )}
                </div>
            </TabsContent>
            <TabsContent value="housing" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Przegląd zakwaterowania</CardTitle>
                        <CardDescription>Poniżej znajduje się lista wszystkich mieszkań i ich obłożenie.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-1 mb-4">
                            <Input
                                placeholder="Szukaj po adresie..."
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
                                            className="text-base truncate hover:underline"
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
                                            <span className="text-blue-500">Pojemność: <span className="font-bold text-foreground">{house.capacity}</span></span>
                                            <span className="text-red-500">Zajęte: <span className="font-bold text-foreground">{house.occupied}</span></span>
                                            <span onClick={(e) => handleAvailableClick(e, house)} className="text-green-500 cursor-pointer hover:underline">Wolne: <span className="font-bold text-foreground">{house.available}</span></span>
                                        </div>
                                    </CardContent>
                                    </Card>
                                ))
                            ) : (
                                <p className="text-center text-muted-foreground py-8">Brak adresów pasujących do wyszukiwania.</p>
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
                      employees={employees}
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
                        <DialogTitle>Wszyscy pracownicy</DialogTitle>
                        <DialogDescription>{selectedAddress.name}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh] mt-4">
                        {employeesForSelectedAddress.map(employee => (
                           <Card key={employee.id} onClick={() => handleEmployeeClick(employee)} className="mb-3 cursor-pointer hover:bg-muted/50">
                             <CardHeader>
                               <CardTitle className="text-base">{employee.fullName}</CardTitle>
                               <CardDescription>Pokój: {employee.roomNumber} / {employee.nationality}</CardDescription>
                             </CardHeader>
                           </Card>
                        ))}
                    </ScrollArea>
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

    

    