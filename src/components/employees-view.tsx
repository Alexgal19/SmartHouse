
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
import { format, isPast, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter, DialogClose } from './ui/dialog';
import { Label } from './ui/label';
import { getEmployees } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';

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

const ITEMS_PER_PAGE = 20;

const formatDate = (dateString?: string | null) => {
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
}) => {
  const t = useTranslations('EmployeesView');
  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">{t('openMenu')}</span>
            <MoreHorizontal className="h-4 w-4" />
        </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(employee)}>{t('edit')}</DropdownMenuItem>
        {isDismissedTab ? (
            <DropdownMenuItem onClick={() => onRestore(employee.id)}>{t('restore')}</DropdownMenuItem>
        ) : (
            <DropdownMenuItem onClick={() => onDismiss(employee.id)}>{t('dismiss')}</DropdownMenuItem>
        )}
        </DropdownMenuContent>
    </DropdownMenu>
  )
};

const PaginationControls = ({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (page: number) => void }) => {
    const t = useTranslations('EmployeesView');
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center space-x-2 py-4">
            <Button variant="outline" size="icon" onClick={() => onPageChange(1)} disabled={currentPage === 1}>
                <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
                {t('page', {current: currentPage, total: totalPages})}
            </span>
            <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages}>
                <ChevronsRight className="h-4 w-4" />
            </Button>
        </div>
    );
};


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
  const t = useTranslations('EmployeesView.columns');
  return (
    <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fullName')}</TableHead>
              <TableHead>{t('nationality')}</TableHead>
              <TableHead>{t('gender')}</TableHead>
              <TableHead>{t('coordinator')}</TableHead>
              <TableHead>{t('address')}</TableHead>
              <TableHead>{t('oldAddress')}</TableHead>
              <TableHead>{t('checkInDate')}</TableHead>
              <TableHead>{t('checkOutDate')}</TableHead>
              <TableHead>{t('departureReportDate')}</TableHead>
              <TableHead>{t('contractFrom')}</TableHead>
              <TableHead>{t('contractTo')}</TableHead>
              <TableHead><span className="sr-only">{t('actions')}</span></TableHead>
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
                <TableCell colSpan={12} className="text-center">{useTranslations('EmployeesView')('noEmployees')}</TableCell>
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
    const t = useTranslations('EmployeesView');
    
    return (
        <div className="space-y-4">
             {employees.length > 0 ? (
                employees.map((employee) => (
                    <Card key={employee.id} onClick={() => onEdit(employee)} className="cursor-pointer animate-in fade-in-0 duration-300">
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
                            <p><span className="font-semibold text-muted-foreground">{t('card.address')}</span> {employee.address}</p>
                            <p><span className="font-semibold text-muted-foreground">{t('card.room')}</span> {employee.roomNumber}</p>
                            <p><span className="font-semibold text-muted-foreground">{t('card.nationality')}</span> {employee.nationality}</p>
                            <p><span className="font-semibold text-muted-foreground">{t('card.contractTo')}</span> {formatDate(employee.contractEndDate)}</p>
                        </CardContent>
                    </Card>
                ))
             ) : (
                <div className="text-center text-muted-foreground py-8">{t('noEmployees')}</div>
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
  const t = useTranslations('EmployeesView');
  const tCol = useTranslations('EmployeesView.columns');
  return (
    <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tCol('fullName')}</TableHead>
              <TableHead>{tCol('address')}</TableHead>
              <TableHead>{t('card.room')}</TableHead>
              <TableHead>{tCol('checkInDate')}</TableHead>
              <TableHead>{tCol('checkOutDate')}</TableHead>
              <TableHead><span className="sr-only">{tCol('actions')}</span></TableHead>
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
                          <span className="sr-only">{t('openMenu')}</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(person)}>{t('edit')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(person.id)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center">{t('noNonEmployees')}</TableCell>
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
    const t = useTranslations('EmployeesView');
    return (
        <div className="space-y-4">
             {nonEmployees.length > 0 ? (
                nonEmployees.map((person) => (
                    <Card key={person.id} onClick={() => onEdit(person)} className="cursor-pointer animate-in fade-in-0 duration-300">
                        <CardHeader className="flex flex-row items-start justify-between pb-4">
                           <div>
                             <CardTitle className="text-lg">{person.fullName}</CardTitle>
                             <CardDescription>{person.address}, {t('card.room')} {person.roomNumber}</CardDescription>
                           </div>
                           <div onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">{t('openMenu')}</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEdit(person)}>{t('edit')}</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(person.id)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                           </div>
                        </CardHeader>
                        <CardContent className="text-base space-y-2">
                           <p><span className="font-semibold text-muted-foreground">{t('card.checkIn')}</span> {formatDate(person.checkInDate)}</p>
                           <p><span className="font-semibold text-muted-foreground">{t('card.checkOut')}</span> {formatDate(person.checkOutDate)}</p>
                        </CardContent>
                    </Card>
                ))
             ) : (
                <div className="text-center text-muted-foreground py-8">{t('noNonEmployees')}</div>
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
    const t = useTranslations('EmployeesView.filterDialog');
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>
                        {t('description')}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                  <div className="grid gap-4 p-4">
                      <div className="space-y-2">
                        <Label>{t('coordinator')}</Label>
                        <Select value={filters.coordinatorFilter} onValueChange={(v) => onFilterChange('coordinatorFilter', v)}>
                        <SelectTrigger><SelectValue placeholder={t('coordinatorPlaceholder')} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('allCoordinators')}</SelectItem>
                            {settings.coordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label>{t('address')}</Label>
                        <Select value={filters.addressFilter} onValueChange={(v) => onFilterChange('addressFilter', v)}>
                        <SelectTrigger><SelectValue placeholder={t('addressPlaceholder')} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('allAddresses')}</SelectItem>
                            {settings.addresses.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label>{t('department')}</Label>
                        <Select value={filters.departmentFilter} onValueChange={(v) => onFilterChange('departmentFilter', v)}>
                        <SelectTrigger><SelectValue placeholder={t('departmentPlaceholder')} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('allDepartments')}</SelectItem>
                            {settings.departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label>{t('nationality')}</Label>
                        <Select value={filters.nationalityFilter} onValueChange={(v) => onFilterChange('nationalityFilter', v)}>
                        <SelectTrigger><SelectValue placeholder={t('nationalityPlaceholder')} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('allNationalities')}</SelectItem>
                            {settings.nationalities.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                  </div>
                </ScrollArea>
                <DialogFooter className="flex-row !justify-between">
                     <Button variant="ghost" onClick={onReset}>{useTranslations('EmployeesView')('clearFilters')}</Button>
                    <Button onClick={() => onOpenChange(false)}>{t('apply')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function EmployeesView({
  employees,
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
  const t = useTranslations('EmployeesView');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
      coordinatorFilter: 'all',
      addressFilter: 'all',
      departmentFilter: 'all',
      nationalityFilter: 'all'
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const {isMobile, isMounted} = useIsMobile();
  const [activeTab, setActiveTab] = useState('active');
  const [pagination, setPagination] = useState({
      active: 1,
      dismissed: 1,
      'non-employees': 1,
  });

  const handlePageChange = (tab: 'active' | 'dismissed' | 'non-employees', page: number) => {
      setPagination(prev => ({...prev, [tab]: page}));
  };
  
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({...prev, [key]: value}));
    // Reset pagination on filter change
    setPagination({ active: 1, dismissed: 1, 'non-employees': 1 });
  }
  
  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const searchMatch = searchTerm === '' || employee.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const coordinatorMatch = filters.coordinatorFilter === 'all' || employee.coordinatorId === filters.coordinatorFilter;
      const addressMatch = filters.addressFilter === 'all' || employee.address === filters.addressFilter;
      const departmentMatch = filters.departmentFilter === 'all' || employee.zaklad === filters.departmentFilter;
      const nationalityMatch = filters.nationalityFilter === 'all' || employee.nationality === filters.nationalityFilter;
      return searchMatch && coordinatorMatch && addressMatch && departmentMatch && nationalityMatch;
    });
  }, [employees, searchTerm, filters]);
  
  const activeEmployees = useMemo(() => 
    filteredEmployees.filter(e => {
        const isCheckedOut = e.checkOutDate ? isPast(parseISO(e.checkOutDate)) : false;
        return e.status === 'active' && !isCheckedOut;
    }), 
  [filteredEmployees]);

  const dismissedEmployees = useMemo(() => 
      filteredEmployees.filter(e => {
          const isCheckedOut = e.checkOutDate ? isPast(parseISO(e.checkOutDate)) : false;
          return e.status === 'dismissed' || isCheckedOut;
      }), 
  [filteredEmployees]);

  const filteredNonEmployees = useMemo(() => {
    if (!nonEmployees) return [];
    return nonEmployees.filter(person => {
      const searchMatch = searchTerm === '' || person.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const addressMatch = filters.addressFilter === 'all' || person.address === filters.addressFilter;
      return searchMatch && addressMatch;
    });
  }, [nonEmployees, searchTerm, filters]);

  const paginatedData = useMemo(() => {
    const activeTotalPages = Math.ceil(activeEmployees.length / ITEMS_PER_PAGE);
    const dismissedTotalPages = Math.ceil(dismissedEmployees.length / ITEMS_PER_PAGE);
    const nonEmployeesTotalPages = Math.ceil(filteredNonEmployees.length / ITEMS_PER_PAGE);

    const activePage = Math.min(pagination.active, activeTotalPages) || 1;
    const dismissedPage = Math.min(pagination.dismissed, dismissedTotalPages) || 1;
    const nonEmployeesPage = Math.min(pagination['non-employees'], nonEmployeesTotalPages) || 1;
    
    if (pagination.active !== activePage || pagination.dismissed !== dismissedPage || pagination['non-employees'] !== nonEmployeesPage) {
        setTimeout(() => setPagination({ active: activePage, dismissed: dismissedPage, 'non-employees': nonEmployeesPage }), 0);
    }

    return {
        active: activeEmployees.slice((activePage - 1) * ITEMS_PER_PAGE, activePage * ITEMS_PER_PAGE),
        dismissed: dismissedEmployees.slice((dismissedPage - 1) * ITEMS_PER_PAGE, dismissedPage * ITEMS_PER_PAGE),
        'non-employees': filteredNonEmployees.slice((nonEmployeesPage - 1) * ITEMS_PER_PAGE, nonEmployeesPage * ITEMS_PER_PAGE),
        activeTotalPages,
        dismissedTotalPages,
        nonEmployeesTotalPages,
    };
}, [activeEmployees, dismissedEmployees, filteredNonEmployees, pagination]);
  
  const resetFilters = () => {
    setSearchTerm('');
    setFilters({
      coordinatorFilter: 'all',
      addressFilter: 'all',
      departmentFilter: 'all',
      nationalityFilter: 'all'
    });
     setPagination({ active: 1, dismissed: 1, 'non-employees': 1 });
  };

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
  };
  
  const handleBulkAction = async (status : 'active' | 'dismissed') => {
    await onBulkDelete(status);
  }

  const renderEmployeeContent = (list: Employee[], isDismissedTab: boolean) => {
    const safeList = list || [];
    const totalPages = isDismissedTab ? paginatedData.dismissedTotalPages : paginatedData.activeTotalPages;
    const currentPage = isDismissedTab ? pagination.dismissed : pagination.active;
    const onPageChange = (page: number) => handlePageChange(isDismissedTab ? 'dismissed' : 'active', page);

    if (!isMounted) {
        return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
    }
    return (
        <>
            {currentUser.isAdmin && safeList.length > 0 && (
                <div className="flex justify-end mb-4">
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('deleteAll', {count: safeList.length})}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('confirmDeleteAllTitle', {status: isDismissedTab ? 'zwolnionych' : 'aktywnych'})}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('confirmDeleteAllDescription', {count: safeList.length})}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleBulkAction(isDismissedTab ? 'dismissed' : 'active')} className="bg-destructive hover:bg-destructive/90">
                                    {t('yesDeleteAll')}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
            <ScrollArea className="h-[55vh] overflow-x-auto">
                <EmployeeListComponent
                    employees={isDismissedTab ? paginatedData.dismissed : paginatedData.active}
                    settings={settings}
                    onEdit={onEditEmployee}
                    onDismiss={(id) => handleAction('dismiss', id)}
                    onRestore={(id) => handleAction('restore', id)}
                    isDismissedTab={isDismissedTab}
                />
            </ScrollArea>
             <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
        </>
    );
  };

  const renderNonEmployeeContent = (list: NonEmployee[]) => {
    const totalPages = paginatedData.nonEmployeesTotalPages;
    const currentPage = pagination['non-employees'];
    const onPageChange = (page: number) => handlePageChange('non-employees', page);

    if (!isMounted) {
      return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
    }
    return (
      <>
        <ScrollArea className="h-[55vh] overflow-x-auto">
          <NonEmployeeListComponent nonEmployees={paginatedData['non-employees']} onEdit={onEditNonEmployee} onDelete={onDeleteNonEmployee} />
        </ScrollArea>
        <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      </>
    );
  }


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
            <CardTitle>{t('title')}</CardTitle>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size={isMobile ? "icon" : "default"}>
                        <PlusCircle className={isMobile ? "h-5 w-5" : "mr-2 h-4 w-4"} />
                        <span className="hidden sm:inline">{t('add')}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={onAddEmployee}>{t('addEmployee')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={onAddNonEmployee}>{t('addNonEmployee')}</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        <div className="mt-4">
            <div className="flex items-center gap-2">
                 <Input
                    placeholder={t('searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPagination({ active: 1, dismissed: 1, 'non-employees': 1 });
                    }}
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
        <Tabs defaultValue="active" onValueChange={(v) => setActiveTab(v)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">{t('activeTab', {count: activeEmployees.length})}</TabsTrigger>
            <TabsTrigger value="dismissed">{t('dismissedTab', {count: dismissedEmployees.length})}</TabsTrigger>
            <TabsTrigger value="non-employees">{t('nonEmployeesTab', {count: filteredNonEmployees.length})}</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4 data-[state=active]:animate-in data-[state=active]:fade-in-0">
                {renderEmployeeContent(activeEmployees, false)}
          </TabsContent>
          <TabsContent value="dismissed" className="mt-4 data-[state=active]:animate-in data-[state=active]:fade-in-0">
                {renderEmployeeContent(dismissedEmployees, true)}
          </TabsContent>
           <TabsContent value="non-employees" className="mt-4 data-[state=active]:animate-in data-[state=active]:fade-in-0">
                {renderNonEmployeeContent(filteredNonEmployees)}
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

    