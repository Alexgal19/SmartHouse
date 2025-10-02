"use client";

import React, { useState, useMemo } from 'react';
import type { Employee, Settings } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

interface EmployeesViewProps {
  employees: Employee[];
  settings: Settings;
  onAddEmployee: () => void;
  onEditEmployee: (employee: Employee) => void;
  onDismissEmployee: (employeeId: string) => void;
  onRestoreEmployee: (employeeId: string) => void;
}

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Imię i nazwisko</TableHead>
          <TableHead>Koordynator</TableHead>
          <TableHead>Adres</TableHead>
          <TableHead>Stara adresa</TableHead>
          <TableHead>Data zameldowania</TableHead>
          <TableHead>Data wymeldowania</TableHead>
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
              <TableCell>{getCoordinatorName(employee.coordinatorId)}</TableCell>
              <TableCell>{employee.address}</TableCell>
              <TableCell>{employee.oldAddress || 'N/A'}</TableCell>
              <TableCell>{format(employee.checkInDate, 'dd-MM-yyyy')}</TableCell>
              <TableCell>{employee.checkOutDate ? format(employee.checkOutDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
              <TableCell>{employee.contractStartDate ? format(employee.contractStartDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
              <TableCell>{employee.contractEndDate ? format(employee.contractEndDate, 'dd-MM-yyyy') : 'N/A'}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
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
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={9} className="text-center">Brak pracowników do wyświetlenia.</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};


export default function EmployeesView({
  employees,
  settings,
  onAddEmployee,
  onEditEmployee,
  onDismissEmployee,
  onRestoreEmployee
}: EmployeesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee =>
      employee.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (settings.coordinators.find(c => c.uid === employee.coordinatorId)?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm, settings.coordinators]);

  const activeEmployees = useMemo(() => filteredEmployees.filter(e => e.status === 'active'), [filteredEmployees]);
  const dismissedEmployees = useMemo(() => filteredEmployees.filter(e => e.status === 'dismissed'), [filteredEmployees]);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
            <CardTitle>Zarządzanie pracownikami</CardTitle>
            <div className="flex items-center gap-2">
                <Input
                    placeholder="Szukaj pracownika..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-[250px] lg:w-[300px]"
                />
                <Button onClick={onAddEmployee}><PlusCircle className="mr-2 h-4 w-4" /> Dodaj</Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Aktywni ({activeEmployees.length})</TabsTrigger>
            <TabsTrigger value="dismissed">Zwolnieni ({dismissedEmployees.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active">
            <EmployeeTable
              employees={activeEmployees}
              settings={settings}
              onEdit={onEditEmployee}
              onDismiss={onDismissEmployee}
              onRestore={onRestoreEmployee}
              isDismissedTab={false}
            />
          </TabsContent>
          <TabsContent value="dismissed">
            <EmployeeTable
              employees={dismissedEmployees}
              settings={settings}
              onEdit={onEditEmployee}
              onDismiss={onDismissEmployee}
              onRestore={onRestoreEmployee}
              isDismissedTab={true}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
