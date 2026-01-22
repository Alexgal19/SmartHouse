import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddEmployeeForm } from '../add-employee-form';
import type { Settings, SessionData } from '@/types';

// Mock the main layout
jest.mock('../main-layout', () => ({
  useMainLayout: () => ({
    handleDismissEmployee: jest.fn(),
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
      rooms: [{ id: 'room-1', name: '101', capacity: 2 }],
    },
  ],
  paymentTypesNZ: [],
  bokStatuses: [],
};

const mockCurrentUser: SessionData = {
  isLoggedIn: true,
  uid: 'coord-1',
  name: 'Jan Kowalski',
  isAdmin: false,
};

const defaultProps = {
  isOpen: true,
  onOpenChange: jest.fn(),
  onSave: jest.fn(),
  settings: mockSettings,
  employee: null,
  currentUser: mockCurrentUser,
};

describe('AddEmployeeForm', () => {
  it('renders the form with required fields', () => {
    render(<AddEmployeeForm {...defaultProps} />);

    expect(screen.getByText('Dodaj nowego pracownika')).toBeInTheDocument();
    expect(screen.getByLabelText('Nazwisko')).toBeInTheDocument();
    expect(screen.getByLabelText('Imię')).toBeInTheDocument();
    expect(screen.getByLabelText('Koordynator')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<AddEmployeeForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: 'Zapisz' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Imię jest wymagane.')).toBeInTheDocument();
      expect(screen.getByText('Nazwisko jest wymagane.')).toBeInTheDocument();
      expect(screen.getByText('Koordynator jest wymagany.')).toBeInTheDocument();
    });
  });

  it('validates room number when address is not own', async () => {
    render(<AddEmployeeForm {...defaultProps} />);

    // Fill required fields
    fireEvent.change(screen.getByLabelText('Nazwisko'), { target: { value: 'Kowalski' } });
    fireEvent.change(screen.getByLabelText('Imię'), { target: { value: 'Jan' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Koordynator/i }), { target: { value: 'coord-1' } });

    // Select locality and address
    const localityCombobox = screen.getByRole('combobox', { name: /Miejscowość/i });
    fireEvent.change(localityCombobox, { target: { value: 'Warszawa' } });

    const addressSelect = screen.getByRole('combobox', { name: /Adres/i });
    fireEvent.change(addressSelect, { target: { value: 'Testowa 1' } });

    // Leave room empty
    const submitButton = screen.getByRole('button', { name: 'Zapisz' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Pokój jest wymagany.')).toBeInTheDocument();
    });
  });

  it('validates own address when selected', async () => {
    render(<AddEmployeeForm {...defaultProps} />);

    // Fill required fields
    fireEvent.change(screen.getByLabelText('Nazwisko'), { target: { value: 'Kowalski' } });
    fireEvent.change(screen.getByLabelText('Imię'), { target: { value: 'Jan' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Koordynator/i }), { target: { value: 'coord-1' } });

    // Select own address
    const addressSelect = screen.getByRole('combobox', { name: /Adres/i });
    fireEvent.change(addressSelect, { target: { value: 'Własne mieszkanie' } });

    // Leave own address empty
    const submitButton = screen.getByRole('button', { name: 'Zapisz' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Adres własny jest wymagany, jeśli wybrano tę opcję.')).toBeInTheDocument();
    });
  });

  it('validates deduction entry date when deductions are present', async () => {
    render(<AddEmployeeForm {...defaultProps} />);

    // Fill required fields
    fireEvent.change(screen.getByLabelText('Nazwisko'), { target: { value: 'Kowalski' } });
    fireEvent.change(screen.getByLabelText('Imię'), { target: { value: 'Jan' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Koordynator/i }), { target: { value: 'coord-1' } });

    // Add deduction
    const depositReturnSelect = screen.getByRole('combobox', { name: /Zwrot kaucji/i });
    fireEvent.change(depositReturnSelect, { target: { value: 'Nie' } });

    // Leave deduction entry date empty
    const submitButton = screen.getByRole('button', { name: 'Zapisz' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Data jest wymagana, jeśli wprowadzono potrącenia lub kaucja nie jest zwracana.')).toBeInTheDocument();
    });
  });
});