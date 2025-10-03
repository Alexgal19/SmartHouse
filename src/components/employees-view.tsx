"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { Employee, Settings } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, X, SlidersHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';

interface EmployeesViewProps {
  employees: Employee[];
  settings: Settings;
  onAddEmployee: () => void;
  onEditEmployee: (employee: Employee) => void;
  onDismissEmployee: (employeeId: string) => void;
  onRestoreEmployee: (employeeId: string) => void;
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
                  <TableCell>{format(employee.checkInDate, 'dd-MM-yyyy')}</TableCell>
                  <TableCell>{employee.checkOutDate ? format(employee.checkOutDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
                  <TableCell>{employee.departureReportDate ? format(employee.departureReportDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
                  <TableCell>{employee.contractStartDate ? format(employee.contractStartDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
                  <TableCell>{employee.contractEndDate ? format(employee.contractEndDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
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
        <div className="space-y-3">
             {employees.length > 0 ? (
                employees.map((employee) => (
                    <Card key={employee.id} onClick={() => onEdit(employee)} className="cursor-pointer">
                        <CardHeader className="flex flex-row items-start justify-between pb-2">
                           <div>
                             <CardTitle className="text-base">{employee.fullName}</CardTitle>
                             <CardDescription className="text-xs">{getCoordinatorName(employee.coordinatorId)}</CardDescription>
                           </div>
                           <div onClick={(e) => e.stopPropagation()}>
                                <EmployeeActions {...{ employee, onEdit, onDismiss, onRestore, isDismissedTab }} />
                           </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                            <p><span className="font-semibold text-muted-foreground">Adres:</span> {employee.address}</p>
                            <p><span className="font-semibold text-muted-foreground">Narodowość:</span> {employee.nationality}</p>
                            <p><span className="font-semibold text-muted-foreground">Umowa do:</span> {employee.contractEndDate ? format(employee.contractEndDate, 'dd-MM-yyyy') : 'N/A'}</p>
                        </CardContent>
                    </Card>
                ))
             ) : (
                <div className="text-center text-muted-foreground py-8">Brak pracowników do wyświetlenia.</div>
             )}
        </div>
    )
}


export default function EmployeesView({
  employees,
  settings,
  onAddEmployee,
  onEditEmployee,
  onDismissEmployee,
  onRestoreEmployee
}: EmployeesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [coordinatorFilter, setCoordinatorFilter] = useState('all');
  const [addressFilter, setAddressFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [nationalityFilter, setNationalityFilter] = useState('all');
  const {isMobile, isMounted} = useIsMobile();

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const searchMatch = searchTerm === '' || employee.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const coordinatorMatch = coordinatorFilter === 'all' || employee.coordinatorId === coordinatorFilter;
      const addressMatch = addressFilter === 'all' || employee.address === addressFilter;
      const departmentMatch = departmentFilter === 'all' || employee.zaklad === departmentFilter;
      const nationalityMatch = nationalityFilter === 'all' || employee.nationality === nationalityFilter;

      return searchMatch && coordinatorMatch && addressMatch && departmentMatch && nationalityMatch;
    });
  }, [employees, searchTerm, coordinatorFilter, addressFilter, departmentFilter, nationalityFilter]);

  const activeEmployees = useMemo(() => filteredEmployees.filter(e => e.status === 'active'), [filteredEmployees]);
  const dismissedEmployees = useMemo(() => filteredEmployees.filter(e => e.status === 'dismissed'), [filteredEmployees]);
  
  const resetFilters = () => {
    setSearchTerm('');
    setCoordinatorFilter('all');
    setAddressFilter('all');
    setDepartmentFilter('all');
    setNationalityFilter('all');
  };

  const hasActiveFilters = searchTerm !== '' || coordinatorFilter !== 'all' || addressFilter !== 'all' || departmentFilter !== 'all' || nationalityFilter !== 'all';
  
  const EmployeeListComponent = isMobile ? EmployeeCardList : EmployeeTable;

  const renderContent = (list: Employee[], isDismissed: boolean) => {
    if (!isMounted) {
      return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
    }
    return (
      <EmployeeListComponent
        employees={list}
        settings={settings}
        onEdit={onEditEmployee}
        onDismiss={onDismissEmployee}
        onRestore={onRestoreEmployee}
        isDismissedTab={isDismissed}
      />
    );
  };


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
            <CardTitle>Zarządzanie pracownikami</CardTitle>
            <div className="flex items-center gap-2">
                <Button onClick={onAddEmployee} size={isMobile ? "icon" : "default"}>
                  <PlusCircle className={isMobile ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                  <span className="hidden sm:inline">Dodaj</span>
                </Button>
            </div>
        </div>
        <div className="mt-4">
            <Collapsible>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-4">
                         <Input
                            placeholder="Szukaj..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full max-w-xs"
                        />
                        <CollapsibleTrigger asChild>
                             <Button variant="outline" size="sm" className="gap-2">
                                <SlidersHorizontal className="h-4 w-4"/>
                                <span className="hidden sm:inline">Filtry</span>
                            </Button>
                        </CollapsibleTrigger>
                        {hasActiveFilters && (
                             <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground gap-2">
                                <X className="h-4 w-4" />
                                <span className="hidden sm:inline">Wyczyść</span>
                            </Button>
                        )}
                    </div>
                </div>
                <CollapsibleContent className="mt-4 animate-in fade-in-0">
                   <div className="p-4 border rounded-lg bg-muted/50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Select value={coordinatorFilter} onValueChange={setCoordinatorFilter}>
                            <SelectTrigger><SelectValue placeholder="Filtruj wg koordynatora" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Wszyscy koordynatorzy</SelectItem>
                                {settings.coordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                            </SelectContent>
                            </Select>
                            
                            <Select value={addressFilter} onValueChange={setAddressFilter}>
                            <SelectTrigger><SelectValue placeholder="Filtruj wg adresu" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Wszystkie adresy</SelectItem>
                                {settings.addresses.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                            </SelectContent>
                            </Select>
                            
                            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                            <SelectTrigger><SelectValue placeholder="Filtruj wg zakładu" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Wszystkie zakłady</SelectItem>
                                {settings.departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                            </Select>

                            <Select value={nationalityFilter} onValueChange={setNationalityFilter}>
                            <SelectTrigger><SelectValue placeholder="Filtruj wg narodowości" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Wszystkie narodowości</SelectItem>
                                {settings.nationalities.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                            </Select>
                        </div>
                   </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Aktywni ({activeEmployees.length})</TabsTrigger>
            <TabsTrigger value="dismissed">Zwolnieni ({dismissedEmployees.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active">
             <ScrollArea className="h-[50vh]">
                {renderContent(activeEmployees, false)}
             </ScrollArea>
          </TabsContent>
          <TabsContent value="dismissed">
            <ScrollArea className="h-[50vh]">
                {renderContent(dismissedEmployees, true)}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
