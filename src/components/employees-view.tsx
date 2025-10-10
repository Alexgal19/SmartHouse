
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Employee, Settings, Coordinator, NonEmployee } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, X, SlidersHorizontal, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter, DialogClose } from './ui/dialog';
import { Label } from './ui/label';
import { getEmployees } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';


interface EmployeesViewProps {
  employees: Employee[];
  nonEmployees: NonEmployee[];
  settings: Settings;
  onAddEmployee: () => void;
  onEditEmployee: (employee: Employee) => void;
  onDismissEmployee: (employeeId: string) => Promise<boolean>;
  onRestoreEmployee: (employeeId: string) => Promise<boolean>;
  onBulkDelete: (status: 'active' | 'dismissed') => Promise<boolean>;
  currentUser: Coordinator;
  onAddNonEmployee: () => void;
  onEditNonEmployee: (nonEmployee: NonEmployee) => void;
  onDeleteNonEmployee: (id: string) => void;
}

const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
        // Add time to treat it as local date, avoiding timezone shifts
        return format(new Date(dateString + 'T00:00:00'), 'dd-MM-yyyy');
    } catch {
        return 'Invalid Date';
    }
}

const EmployeeActions = ({
  employee,
  onEdit,
  onDismiss,
  onRestore,
  isDismissedTab,
}: {
  employee: Employee;
  onEdit: (employee: Employee) => void;
  onDismiss: (employeeId: string) => void;
  onRestore: (employeeId: string) => void;
  isDismissedTab: boolean;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="h-8 w-8 p-0">
        <span className="sr-only">Otwórz menu</span>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => onEdit(employee)}>Edytuj</DropdownMenuItem>
      {isDismissedTab ? (
        <DropdownMenuItem onClick={() => onRestore(employee.id)}>Przywróć</DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={() => onDismiss(employee.id)}>Zwolnij</DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

const EmployeeTable = ({
  employees,
  settings,
  onEdit,
  onDismiss,
  onRestore,
  isDismissedTab,
}: {
  employees: Employee[];
  settings: Settings;
  onEdit: (employee: Employee) => void;
  onDismiss: (employeeId: string) => void;
  onRestore: (employeeId: string) => void;
  isDismissedTab: boolean;
}) => {
  const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || 'N/A';
  
  return (
    <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>Narodowość</TableHead>
              <TableHead>Płeć</TableHead>
              <TableHead>Koordynator</TableHead>
              <TableHead>Adres</TableHead>
              <TableHead>Stara adresa</TableHead>
              <TableHead>Data zameldowania</TableHead>
              <TableHead>Data wymeldowania</TableHead>
              <TableHead>Data zgłoszenia wyjazdu</TableHead>
              <TableHead>Umowa od</TableHead>
              <TableHead>Umowa do</TableHead>
              <TableHead><span className="sr-only">Akcje</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length > 0 ? (
              employees.map((employee) => (
                <TableRow key={employee.id} onClick={() => onEdit(employee)} className="cursor-pointer">
                  <TableCell className="font-medium">{employee.fullName}</TableCell>
                  <TableCell>{employee.nationality}</TableCell>
                  <TableCell>{employee.gender}</TableCell>
                  <TableCell>{getCoordinatorName(employee.coordinatorId)}</TableCell>
                  <TableCell>{employee.address}</TableCell>
                  <TableCell>{employee.oldAddress || 'N/A'}</TableCell>
                  <TableCell>{formatDate(employee.checkInDate)}</TableCell>
                  <TableCell>{formatDate(employee.checkOutDate)}</TableCell>
                  <TableCell>{formatDate(employee.departureReportDate)}</TableCell>
                  <TableCell>{formatDate(employee.contractStartDate)}</TableCell>
                  <TableCell>{formatDate(employee.contractEndDate)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <EmployeeActions {...{ employee, onEdit, onDismiss, onRestore, isDismissedTab }} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={12} className="text-center">Brak pracowników do wyświetlenia.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
    </div>
  );
};


const EmployeeCardList = ({
    employees,
    settings,
    onEdit,
    onDismiss,
    onRestore,
    isDismissedTab,
  }: {
    employees: Employee[];
    settings: Settings;
    onEdit: (employee: Employee) => void;
    onDismiss: (employeeId: string) => void;
    onRestore: (employeeId: string) => void;
    isDismissedTab: boolean;
  }) => {
    const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || 'N/A';
    
    return (
        <div className="space-y-4">
             {employees.length > 0 ? (
                employees.map((employee) => (
                    <Card key={employee.id} onClick={() => onEdit(employee)} className="cursor-pointer">
                        <CardHeader className="flex flex-row items-start justify-between pb-4">
                           <div>
                             <CardTitle className="text-lg">{employee.fullName}</CardTitle>
                             <CardDescription>{getCoordinatorName(employee.coordinatorId)}</CardDescription>
                           </div>
                           <div onClick={(e) => e.stopPropagation()}>
                                <EmployeeActions {...{ employee, onEdit, onDismiss, onRestore, isDismissedTab }} />
                           </div>
                        </CardHeader>
                        <CardContent className="text-base space-y-2">
                            <p><span className="font-semibold text-muted-foreground">Adres:</span> {employee.address}</p>
                            <p><span className="font-semibold text-muted-foreground">Pokój:</span> {employee.roomNumber}</p>
                            <p><span className="font-semibold text-muted-foreground">Narodowość:</span> {employee.nationality}</p>
                            <p><span className="font-semibold text-muted-foreground">Umowa do:</span> {formatDate(employee.contractEndDate)}</p>
                        </CardContent>
                    </Card>
                ))
             ) : (
                <div className="text-center text-muted-foreground py-8">Brak pracowników do wyświetlenia.</div>
             )}
        </div>
    )
}

const NonEmployeeTable = ({
  nonEmployees,
  onEdit,
  onDelete,
}: {
  nonEmployees: NonEmployee[];
  onEdit: (nonEmployee: NonEmployee) => void;
  onDelete: (id: string) => void;
}) => {
  return (
    <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>Adres</TableHead>
              <TableHead>Numer pokoju</TableHead>
              <TableHead>Data zameldowania</TableHead>
              <TableHead>Data wymeldowania</TableHead>
              <TableHead><span className="sr-only">Akcje</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nonEmployees.length > 0 ? (
              nonEmployees.map((person) => (
                <TableRow key={person.id} onClick={() => onEdit(person)} className="cursor-pointer">
                  <TableCell className="font-medium">{person.fullName}</TableCell>
                  <TableCell>{person.address}</TableCell>
                  <TableCell>{person.roomNumber}</TableCell>
                  <TableCell>{formatDate(person.checkInDate)}</TableCell>
                  <TableCell>{formatDate(person.checkOutDate)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Otwórz menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(person)}>Edytuj</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(person.id)} className="text-destructive">Usuń</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center">Brak mieszkańców (NZ) do wyświetlenia.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
    </div>
  );
};

const NonEmployeeCardList = ({
    nonEmployees,
    onEdit,
    onDelete,
  }: {
    nonEmployees: NonEmployee[];
    onEdit: (nonEmployee: NonEmployee) => void;
    onDelete: (id: string) => void;
  }) => {
    return (
        <div className="space-y-4">
             {nonEmployees.length > 0 ? (
                nonEmployees.map((person) => (
                    <Card key={person.id} onClick={() => onEdit(person)} className="cursor-pointer">
                        <CardHeader className="flex flex-row items-start justify-between pb-4">
                           <div>
                             <CardTitle className="text-lg">{person.fullName}</CardTitle>
                             <CardDescription>{person.address}, pokój {person.roomNumber}</CardDescription>
                           </div>
                           <div onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Otwórz menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEdit(person)}>Edytuj</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(person.id)} className="text-destructive">Usuń</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                           </div>
                        </CardHeader>
                        <CardContent className="text-base space-y-2">
                           <p><span className="font-semibold text-muted-foreground">Zameldowanie:</span> {formatDate(person.checkInDate)}</p>
                           <p><span className="font-semibold text-muted-foreground">Wymeldowanie:</span> {formatDate(person.checkOutDate)}</p>
                        </CardContent>
                    </Card>
                ))
             ) : (
                <div className="text-center text-muted-foreground py-8">Brak mieszkańców (NZ) do wyświetlenia.</div>
             )}
        </div>
    )
}


const FilterDialog = ({
    isOpen,
    onOpenChange,
    settings,
    filters,
    onFilterChange,
    onReset
} : {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    settings: Settings;
    filters: Record<string, string>;
    onFilterChange: (key: string, value: string) => void;
    onReset: () => void;
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Filtruj</DialogTitle>
                    <DialogDescription>
                        Zawęź listę, aby znaleźć to, czego szukasz.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                  <div className="grid gap-4 p-4">
                      <div className="space-y-2">
                        <Label>Koordynator</Label>
                        <Select value={filters.coordinatorFilter} onValueChange={(v) => onFilterChange('coordinatorFilter', v)}>
                        <SelectTrigger><SelectValue placeholder="Filtruj wg koordynatora" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszyscy koordynatorzy</SelectItem>
                            {settings.coordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label>Adres</Label>
                        <Select value={filters.addressFilter} onValueChange={(v) => onFilterChange('addressFilter', v)}>
                        <SelectTrigger><SelectValue placeholder="Filtruj wg adresu" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie adresy</SelectItem>
                            {settings.addresses.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label>Zakład</Label>
                        <Select value={filters.departmentFilter} onValueChange={(v) => onFilterChange('departmentFilter', v)}>
                        <SelectTrigger><SelectValue placeholder="Filtruj wg zakładu" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie zakłady</SelectItem>
                            {settings.departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label>Narodowość</Label>
                        <Select value={filters.nationalityFilter} onValueChange={(v) => onFilterChange('nationalityFilter', v)}>
                        <SelectTrigger><SelectValue placeholder="Filtruj wg narodowości" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie narodowości</SelectItem>
                            {settings.nationalities.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                  </div>
                </ScrollArea>
                <DialogFooter className="flex-row !justify-between">
                     <Button variant="ghost" onClick={onReset}>Wyczyść wszystko</Button>
                    <Button onClick={() => onOpenChange(false)}>Zastosuj</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const PAGE_SIZE = 50;

export default function EmployeesView({
  employees: initialEmployees,
  nonEmployees,
  settings,
  onAddEmployee,
  onEditEmployee,
  onDismissEmployee,
  onRestoreEmployee,
  onBulkDelete,
  currentUser,
  onAddNonEmployee,
  onEditNonEmployee,
  onDeleteNonEmployee,
}: EmployeesViewProps) {
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [dismissedEmployees, setDismissedEmployees] = useState<Employee[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'dismissed'>('active');

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
      coordinatorFilter: 'all',
      addressFilter: 'all',
      departmentFilter: 'all',
      nationalityFilter: 'all'
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const {isMobile, isMounted} = useIsMobile();
  const { toast } = useToast();

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({...prev, [key]: value}));
    setPage(1); // Reset to first page on filter change
  }
  
  const fetchPageData = useCallback(async () => {
    setIsLoading(true);
    try {
        const filtersForApi: Record<string, string> = {};
        if (filters.coordinatorFilter !== 'all') filtersForApi.coordinatorId = filters.coordinatorFilter;
        if (filters.addressFilter !== 'all') filtersForApi.address = filters.addressFilter;
        if (filters.departmentFilter !== 'all') filtersForApi.zaklad = filters.departmentFilter;
        if (filters.nationalityFilter !== 'all') filtersForApi.nationality = filters.nationalityFilter;
        
      const { employees: fetchedEmployees, total: fetchedTotal } = await getEmployees({
        page,
        limit: PAGE_SIZE,
        filters: filtersForApi,
        searchTerm,
        status: activeTab,
      });

      if (activeTab === 'active') {
        setActiveEmployees(fetchedEmployees);
      } else {
        setDismissedEmployees(fetchedEmployees);
      }
      setTotal(fetchedTotal);

    } catch (error) {
        toast({
            variant: "destructive",
            title: "Błąd ładowania pracowników",
            description: `Nie udało się pobrać danych. Spróbuj ponownie.`,
        });
    } finally {
      setIsLoading(false);
    }
  }, [page, activeTab, filters, searchTerm, toast]);
  
  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);
  
  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
        setPage(1);
        fetchPageData();
    }, 500); // 500ms delay

    return () => {
      clearTimeout(handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);


  const filteredNonEmployees = useMemo(() => {
    if (!nonEmployees) return [];
    return nonEmployees.filter(person => {
      const searchMatch = searchTerm === '' || person.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const addressMatch = filters.addressFilter === 'all' || person.address === filters.addressFilter;
      return searchMatch && addressMatch;
    });
  }, [nonEmployees, searchTerm, filters]);
  
  const resetFilters = () => {
    setSearchTerm('');
    setFilters({
      coordinatorFilter: 'all',
      addressFilter: 'all',
      departmentFilter: 'all',
      nationalityFilter: 'all'
    });
    setPage(1);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'active' | 'dismissed');
    setPage(1);
  }

  const hasActiveFilters = searchTerm !== '' || Object.values(filters).some(v => v !== 'all');
  
  const EmployeeListComponent = isMobile ? EmployeeCardList : EmployeeTable;
  const NonEmployeeListComponent = isMobile ? NonEmployeeCardList : NonEmployeeTable;

  const handleAction = async (action: 'dismiss' | 'restore', employeeId: string) => {
    let success = false;
    if (action === 'dismiss') {
        success = await onDismissEmployee(employeeId);
    } else {
        success = await onRestoreEmployee(employeeId);
    }
    if (success) {
        fetchPageData(); // Refetch current page after action
    }
  };
  
  const handleBulkAction = async () => {
    const success = await onBulkDelete(activeTab);
    if(success) {
        fetchPageData();
    }
  }

  const Pagination = () => {
    const pageCount = Math.ceil(total / PAGE_SIZE);
    if (pageCount <= 1) return null;
    
    return (
         <div className="flex items-center justify-end space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">
                Strona {page} z {pageCount} ({total} rekordów)
            </div>
            <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}> <ChevronsLeft className="h-4 w-4" /> </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}> <ChevronLeft className="h-4 w-4" /> </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pageCount, p+1))} disabled={page === pageCount}> <ChevronRight className="h-4 w-4" /> </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(pageCount)} disabled={page === pageCount}> <ChevronsRight className="h-4 w-4" /> </Button>
            </div>
        </div>
    )
  }

  const renderEmployeeContent = (list: Employee[], isDismissed: boolean) => {
    if (isLoading) {
      return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
    }
    return (
        <>
            {currentUser.isAdmin && list && list.length > 0 && (
                <div className="flex justify-end mb-4">
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Usuń wszystkich ({total})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Czy na pewno chcesz usunąć wszystkich {isDismissed ? 'zwolnionych' : 'aktywnych'} pracowników?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Tej operacji nie można cofnąć. Spowoduje to trwałe usunięcie {total} rekordów pracowników z arkusza Google.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBulkAction} className="bg-destructive hover:bg-destructive/90">
                                    Tak, usuń wszystkich
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
            <EmployeeListComponent
                employees={list}
                settings={settings}
                onEdit={onEditEmployee}
                onDismiss={(id) => handleAction('dismiss', id)}
                onRestore={(id) => handleAction('restore', id)}
                isDismissedTab={isDismissed}
            />
            <Pagination />
        </>
    );
  };

  const renderNonEmployeeContent = (list: NonEmployee[]) => {
    if (!isMounted) {
      return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
    }
    return <NonEmployeeListComponent nonEmployees={list || []} onEdit={onEditNonEmployee} onDelete={onDeleteNonEmployee} />
  }


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
            <CardTitle>Zarządzanie mieszkańcami</CardTitle>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size={isMobile ? "icon" : "default"}>
                        <PlusCircle className={isMobile ? "h-5 w-5" : "mr-2 h-4 w-4"} />
                        <span className="hidden sm:inline">Dodaj</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={onAddEmployee}>Dodaj pracownika</DropdownMenuItem>
                    <DropdownMenuItem onClick={onAddNonEmployee}>Dodaj mieszkańca (NZ)</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        <div className="mt-4">
            <div className="flex items-center gap-2">
                 <Input
                    placeholder="Szukaj po nazwisku..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                />
                 <Button variant="outline" size="icon" onClick={() => setIsFilterOpen(true)}>
                    <SlidersHorizontal className="h-4 w-4"/>
                </Button>
                {hasActiveFilters && (
                     <Button variant="ghost" size="icon" onClick={resetFilters} className="text-muted-foreground">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Aktywni ({activeTab === 'active' ? total : ''})</TabsTrigger>
            <TabsTrigger value="dismissed">Zwolnieni ({activeTab === 'dismissed' ? total : ''})</TabsTrigger>
            <TabsTrigger value="non-employees">NZ ({filteredNonEmployees.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">
             <ScrollArea className="h-[55vh]">
                {renderEmployeeContent(activeEmployees, false)}
             </ScrollArea>
          </TabsContent>
          <TabsContent value="dismissed" className="mt-4">
            <ScrollArea className="h-[55vh]">
                {renderEmployeeContent(dismissedEmployees, true)}
            </ScrollArea>
          </TabsContent>
           <TabsContent value="non-employees" className="mt-4">
            <ScrollArea className="h-[55vh]">
                {renderNonEmployeeContent(filteredNonEmployees)}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
       <FilterDialog 
          isOpen={isFilterOpen}
          onOpenChange={setIsFilterOpen}
          settings={settings}
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={resetFilters}
      />
    </Card>
  );
}
