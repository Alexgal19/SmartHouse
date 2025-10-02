// This file mocks a Firebase service layer.
// In a real app, this would contain server-side functions
// to interact with Firestore using the Firebase Admin SDK.

import type { Employee, Settings } from '@/types';
import { add, sub } from 'date-fns';

let mockEmployees: Employee[] = [
  { id: 'emp-001', fullName: 'Jan Kowalski', coordinatorId: 'coord-1', nationality: 'Polska', address: 'ul. Słoneczna 1, Warszawa', roomNumber: '1A', zaklad: 'Produkcja A', checkInDate: new Date('2023-01-15'), checkOutDate: null, status: 'active', contractEndDate: new Date('2024-12-31') },
  { id: 'emp-002', fullName: 'Anna Nowak', coordinatorId: 'coord-2', nationality: 'Polska', address: 'ul. Słoneczna 1, Warszawa', roomNumber: '1B', zaklad: 'Logistyka', checkInDate: new Date('2023-03-20'), checkOutDate: null, status: 'active', contractEndDate: new Date('2025-03-19') },
  { id: 'emp-003', fullName: 'Petro Ivanenko', coordinatorId: 'coord-1', nationality: 'Ukraina', address: 'ul. Leśna 2, Kraków', roomNumber: '1', zaklad: 'Produkcja B', checkInDate: new Date('2023-05-10'), checkOutDate: null, status: 'active', contractEndDate: sub(new Date(), { days: 5 }) },
  { id: 'emp-004', fullName: 'Olena Kovalchuk', coordinatorId: 'coord-1', nationality: 'Ukraina', address: 'ul. Leśna 2, Kraków', roomNumber: '2', zaklad: 'Produkcja A', checkInDate: new Date('2023-05-10'), checkOutDate: null, status: 'active', contractEndDate: add(new Date(), { days: 60 }) },
  { id: 'emp-005', fullName: 'Maria Rodriguez', coordinatorId: 'coord-3', nationality: 'Hiszpania', address: 'ul. Wrocławska 5, Poznań', roomNumber: 'A1', zaklad: 'Jakość', checkInDate: new Date('2022-11-01'), checkOutDate: null, status: 'active', contractEndDate: add(new Date(), { days: 120 }) },
  { id: 'emp-006', fullName: 'Carlos Garcia', coordinatorId: 'coord-3', nationality: 'Hiszpania', address: 'ul. Wrocławska 5, Poznań', roomNumber: 'A2', zaklad: 'Logistyka', checkInDate: new Date('2022-11-01'), checkOutDate: null, status: 'active', contractEndDate: add(new Date(), { days: 5 }) },
  { id: 'emp-007', fullName: 'Svitlana Shevchenko', coordinatorId: 'coord-2', nationality: 'Ukraina', address: 'ul. Słoneczna 1, Warszawa', roomNumber: '2A', zaklad: 'Produkcja B', checkInDate: new Date('2024-02-01'), checkOutDate: null, status: 'active', contractEndDate: add(new Date(), { days: 8 }) },
  { id: 'emp-008', fullName: 'Andrzej Wiśniewski', coordinatorId: 'coord-2', nationality: 'Polska', address: 'ul. Leśna 2, Kraków', roomNumber: '3', zaklad: 'Jakość', checkInDate: new Date('2024-04-10'), checkOutDate: null, status: 'active', contractEndDate: add(new Date(), { days: 300 }) },
  { id: 'emp-009', fullName: 'John Smith', coordinatorId: 'coord-4', nationality: 'USA', address: 'ul. Słoneczna 1, Warszawa', roomNumber: '3A', zaklad: 'Administracja', checkInDate: new Date('2024-01-01'), checkOutDate: new Date('2024-05-30'), status: 'dismissed' },
  { id: 'emp-010', fullName: 'Katarzyna Zielińska', coordinatorId: 'coord-1', nationality: 'Polska', address: 'ul. Polna 10, Gdańsk', roomNumber: '1', zaklad: 'Produkcja A', checkInDate: new Date('2023-08-01'), checkOutDate: new Date('2024-06-15'), status: 'dismissed' }
];

let mockSettings: Settings = {
  id: 'global-settings',
  addresses: [
    { id: 'addr-1', name: 'ul. Słoneczna 1, Warszawa', capacity: 10 },
    { id: 'addr-2', name: 'ul. Leśna 2, Kraków', capacity: 8 },
    { id: 'addr-3', name: 'ul. Wrocławska 5, Poznań', capacity: 12 },
    { id: 'addr-4', name: 'ul. Polna 10, Gdańsk', capacity: 6 },
  ],
  nationalities: ['Polska', 'Ukraina', 'Hiszpania', 'USA', 'Niemcy'],
  departments: ['Produkcja A', 'Produkcja B', 'Logistyka', 'Jakość', 'Administracja'],
  coordinators: [
    { uid: 'coord-1', name: 'Marek Mostowiak' },
    { uid: 'coord-2', name: 'Ewa Malinowska' },
    { uid: 'coord-3', name: 'Juan Martinez' },
    { uid: 'coord-4', name: 'Emily White' },
  ],
};

const simulateDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function getEmployees(): Promise<Employee[]> {
  await simulateDelay(500);
  return JSON.parse(JSON.stringify(mockEmployees.map(e => ({...e, checkInDate: e.checkInDate.toISOString(), checkOutDate: e.checkOutDate?.toISOString() ?? null, contractEndDate: e.contractEndDate?.toISOString() ?? null })))).map((e:any) => ({...e, checkInDate: new Date(e.checkInDate), checkOutDate: e.checkOutDate ? new Date(e.checkOutDate) : null, contractEndDate: e.contractEndDate ? new Date(e.contractEndDate) : null}));
}

export async function getSettings(): Promise<Settings> {
  await simulateDelay(200);
  return JSON.parse(JSON.stringify(mockSettings));
}

export async function addEmployee(employeeData: Omit<Employee, 'id' | 'status'>): Promise<Employee> {
  await simulateDelay(300);
  const newEmployee: Employee = {
    ...employeeData,
    id: `emp-${Math.random().toString(36).substr(2, 9)}`,
    status: 'active',
  };
  mockEmployees.push(newEmployee);
  return JSON.parse(JSON.stringify(newEmployee));
}

export async function updateEmployee(employeeId: string, employeeData: Partial<Employee>): Promise<Employee> {
  await simulateDelay(300);
  let updatedEmployee: Employee | undefined;
  mockEmployees = mockEmployees.map(emp => {
    if (emp.id === employeeId) {
      updatedEmployee = { ...emp, ...employeeData };
      return updatedEmployee;
    }
    return emp;
  });
  if (!updatedEmployee) {
    throw new Error("Employee not found");
  }
  return JSON.parse(JSON.stringify(updatedEmployee));
}

export async function updateSettings(newSettings: Partial<Settings>): Promise<Settings> {
    await simulateDelay(400);
    mockSettings = { ...mockSettings, ...newSettings };
    return JSON.parse(JSON.stringify(mockSettings));
}
