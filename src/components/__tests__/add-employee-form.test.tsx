import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddEmployeeForm } from '../add-employee-form';
import type { Settings, SessionData } from '@/types';

// Mock the main layout
jest.mock('../main-layout', () => ({
  useMainLayout: () => ({
    handleDismissEmployee: jest.fn(),
    allEmployees: [],
    allNonEmployees: [],
    allBokResidents: [],
  }),
}));

// Mock useToast
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock extractPassportData
jest.mock('@/ai/flows/extract-passport-data-flow', () => ({
  extractPassportData: jest.fn(),
}));

// Mock Tabs to avoid JSDOM issues with Radix UI
jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock wizard-utils OcrCameraButton
jest.mock('../wizard-utils', () => {
  const original = jest.requireActual('../wizard-utils');
  return {
    ...original,
    OcrCameraButton: () => null,
  };
});

const mockSettings: Settings = {
  id: 'global-settings',
  coordinators: [
    { uid: 'coord-1', name: 'Jan Kowalski', isAdmin: false, departments: ['IT', 'HR'] },
  ],
  localities: ['Warszawa'],
  departments: ['IT', 'HR'],
  nationalities: ['Polska'],
  genders: ['Mężczyzna', 'Kobieta'],
  addresses: [
    {
      id: 'addr-1',
      locality: 'Warszawa',
      name: 'Testowa 1',
      coordinatorIds: ['coord-1'],
      rooms: [{ id: 'room-1', name: '101', capacity: 2, isActive: true }],
      isActive: true,
    },
  ],
  paymentTypesNZ: [],
  statuses: [],
  bokRoles: [],
  bokReturnOptions: [],
  bokStatuses: [],
};

const mockCurrentUser: SessionData = {
  isLoggedIn: true,
  uid: 'coord-1',
  name: 'Jan Kowalski',
  isAdmin: true,
  isDriver: false,
  isRekrutacja: false,
};

const defaultProps = {
  isOpen: true,
  onOpenChange: jest.fn(),
  onSave: jest.fn(),
  settings: mockSettings,
  employee: null,
  currentUser: mockCurrentUser,
};

// Helper: fill step 0 (Osoba) required fields
function fillStep0() {
  fireEvent.change(screen.getByPlaceholderText('Kowalski'), { target: { value: 'Kowalski' } });
  fireEvent.change(screen.getByPlaceholderText('Jan'), { target: { value: 'Jan' } });
  const comboboxes = screen.getAllByRole('combobox');
  fireEvent.click(comboboxes[0]); // coordinator
  fireEvent.click(screen.getByText('Jan Kowalski'));
  fireEvent.click(comboboxes[1]); // nationality
  fireEvent.click(screen.getByText('Polska'));
}

describe('AddEmployeeForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders step 0 with person fields', () => {
    render(<AddEmployeeForm {...defaultProps} />);
    expect(screen.getByText('Dane osoby')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Kowalski')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Jan')).toBeInTheDocument();
  });

  it('Dalej button is disabled when required step 0 fields are empty', () => {
    render(<AddEmployeeForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Dalej/i })).toBeDisabled();
  });

  it('Dalej button is enabled when step 0 fields are filled', () => {
    render(<AddEmployeeForm {...defaultProps} />);
    fillStep0();
    expect(screen.getByRole('button', { name: /Dalej/i })).toBeEnabled();
  });

  it('Anuluj button on step 0 calls onOpenChange(false)', () => {
    const onOpenChange = jest.fn();
    render(<AddEmployeeForm {...defaultProps} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Anuluj/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('AddEmployeeForm — step navigation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows step indicator with 5 steps', () => {
    render(<AddEmployeeForm {...defaultProps} />);
    // Step indicator shows step names
    expect(screen.getByText('Osoba')).toBeInTheDocument();
    expect(screen.getByText('Podsumowanie')).toBeInTheDocument();
  });
});