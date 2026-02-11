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
};

const defaultProps = {
  isOpen: true,
  onOpenChange: jest.fn(),
  onSave: jest.fn(),
  settings: mockSettings,
  nonEmployee: null,
  currentUser: mockCurrentUser,
};

describe('AddNonEmployeeForm', () => {
  it('renders the form with required fields', () => {
    render(<AddNonEmployeeForm {...defaultProps} />);

    expect(screen.getByText('Dodaj nowego mieszkańca (NZ)')).toBeInTheDocument();
    expect(screen.getByLabelText('Nazwisko')).toBeInTheDocument();
    expect(screen.getByLabelText('Imię')).toBeInTheDocument();
    expect(screen.getByLabelText('Koordynator')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<AddNonEmployeeForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: 'Zapisz' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Imię jest wymagane.')).toBeInTheDocument();
      expect(screen.getByText('Nazwisko jest wymagane.')).toBeInTheDocument();
      expect(screen.getByText('Koordynator jest wymagany.')).toBeInTheDocument();
      expect(screen.getByText('Miejscowość jest wymagana.')).toBeInTheDocument();
      expect(screen.getByText('Adres jest wymagany.')).toBeInTheDocument();
      expect(screen.getByText('Pokój jest wymagany.')).toBeInTheDocument();
      expect(screen.getByText("Narodowość jest wymagana.")).toBeInTheDocument();
      expect(screen.getByText("Płeć jest wymagana.")).toBeInTheDocument();
    });
  });

  it('validates room number is required', async () => {
    render(<AddNonEmployeeForm {...defaultProps} />);

    // Fill some fields but leave room empty
    fireEvent.change(screen.getByLabelText('Nazwisko'), { target: { value: 'Kowalski' } });
    fireEvent.change(screen.getByLabelText('Imię'), { target: { value: 'Jan' } });
    
    fireEvent.click(screen.getByText('Wybierz koordynatora'));
    fireEvent.click(screen.getByText('Jan Kowalski'));

    fireEvent.click(screen.getByText('Wybierz miejscowość'));
    fireEvent.click(screen.getByRole('option', { name: 'Warszawa' }));

    fireEvent.click(screen.getByText('Wybierz adres'));
    const option = await screen.findByRole('option', { name: 'Testowa 1' });
    fireEvent.click(option);

    const submitButton = screen.getByRole('button', { name: 'Zapisz' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Pokój jest wymagany.')).toBeInTheDocument();
    });
  });
});