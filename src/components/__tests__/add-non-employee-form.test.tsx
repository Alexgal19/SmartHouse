import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddNonEmployeeForm } from '../add-non-employee-form';
import type { Settings, SessionData } from '@/types';

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

// Mock useMainLayout (wizard uses allEmployees, allNonEmployees, allBokResidents)
jest.mock('../main-layout', () => ({
  useMainLayout: () => ({
    allEmployees: [],
    allNonEmployees: [],
    allBokResidents: [],
    handleDismissNonEmployee: jest.fn(),
  }),
}));

// Mock wizard-utils OcrCameraButton to avoid webcam dependency
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
  paymentTypesNZ: ['Miesięczny'],
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
  nonEmployee: null,
  currentUser: mockCurrentUser,
};

// Helper: fill step 0 (Osoba) required fields to allow proceeding
function fillStep0() {
  fireEvent.change(screen.getByPlaceholderText('Kowalski'), { target: { value: 'Kowalski' } });
  fireEvent.change(screen.getByPlaceholderText('Jan'), { target: { value: 'Jan' } });
  // Select coordinator via Combobox (buttons have empty accessible name, use array index)
  const comboboxes = screen.getAllByRole('combobox');
  fireEvent.click(comboboxes[0]); // coordinator
  fireEvent.click(screen.getByText('Jan Kowalski'));
  // Select nationality via Combobox
  fireEvent.click(comboboxes[1]); // nationality
  fireEvent.click(screen.getByText('Polska'));
}

describe('AddNonEmployeeForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders step 0 with person fields', () => {
    render(<AddNonEmployeeForm {...defaultProps} />);
    expect(screen.getByText('Dane osoby')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Kowalski')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Jan')).toBeInTheDocument();
  });

  it('Dalej button is disabled when required step 0 fields are empty', () => {
    render(<AddNonEmployeeForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Dalej/i })).toBeDisabled();
  });

  it('Dalej button is enabled when step 0 fields are filled', () => {
    render(<AddNonEmployeeForm {...defaultProps} />);
    fillStep0();
    expect(screen.getByRole('button', { name: /Dalej/i })).toBeEnabled();
  });

  it('Anuluj button on step 0 calls onOpenChange(false)', () => {
    const onOpenChange = jest.fn();
    render(<AddNonEmployeeForm {...defaultProps} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Anuluj/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});