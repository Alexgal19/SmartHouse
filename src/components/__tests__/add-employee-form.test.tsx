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

// Mock Tabs to avoid JSDOM issues with Radix UI
jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    
    // Select Coordinator
    fireEvent.click(screen.getByText('Wybierz koordynatora'));
    fireEvent.click(screen.getByText('Jan Kowalski'));

    // Select Locality
    fireEvent.click(screen.getByText('Wybierz miejscowość'));
    fireEvent.click(screen.getByText('Warszawa'));

    // Select Address
    fireEvent.click(screen.getByText('Wybierz adres'));
    fireEvent.click(await screen.findByRole('option', { name: 'Testowa 1' }));

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
    
    // Select Coordinator
    fireEvent.click(screen.getByText('Wybierz koordynatora'));
    fireEvent.click(screen.getByText('Jan Kowalski'));

    // We can't easily select "Own Address" from the dropdown because "Własne mieszkanie" isn't in the mocked addresses.
    // We need to add "Własne mieszkanie" to the mock settings or mocked addresses.
    // For now, let's assume we can select an address that implies own address if we could mock it differently.
    // Or we can rely on the fact that if we select an address containing "własne mieszkanie", it triggers the logic.
    // But our mock settings addresses don't have it.
    // Let's modify the test to mock an address that is "Własne mieszkanie".
  });

  // Since we cannot easily modify the address list in the component without prop injection (which we are doing via settings),
  // we should update the test to use a modified settings prop for this specific test case.
});

describe('AddEmployeeForm with Own Address', () => {
    const ownAddressSettings = {
        ...mockSettings,
        addresses: [
            ...mockSettings.addresses,
            {
                id: 'addr-own',
                locality: 'Warszawa',
                name: 'Własne mieszkanie',
                coordinatorIds: ['coord-1'],
                rooms: [{ id: 'room-own', name: '1', capacity: 1, isActive: true }],
                isActive: true,
            }
        ]
    };

    it('validates own address when selected', async () => {
        render(<AddEmployeeForm {...defaultProps} settings={ownAddressSettings} />);
    
        // Fill required fields
        fireEvent.change(screen.getByLabelText('Nazwisko'), { target: { value: 'Kowalski' } });
        fireEvent.change(screen.getByLabelText('Imię'), { target: { value: 'Jan' } });
        
        // Select Coordinator
        fireEvent.click(screen.getByText('Wybierz koordynatora'));
        fireEvent.click(screen.getByText('Jan Kowalski'));

        // Select Locality
        fireEvent.click(screen.getByText('Wybierz miejscowość'));
        fireEvent.click(screen.getByText('Warszawa'));

        // Select Own Address
            fireEvent.click(screen.getByText('Wybierz adres'));
            fireEvent.click(await screen.findByRole('option', { name: 'Własne mieszkanie' }));
        
            // Leave own address empty
        const submitButton = screen.getByRole('button', { name: 'Zapisz' });
        fireEvent.click(submitButton);
    
        await waitFor(() => {
          expect(screen.getByText('Adres własny jest wymagany, jeśli wybrano tę opcję.')).toBeInTheDocument();
        });
      });
});

describe('AddEmployeeForm Deductions', () => {
  it('validates deduction entry date when deductions are present', async () => {
    render(<AddEmployeeForm {...defaultProps} />);

    // Fill required fields
    fireEvent.change(screen.getByLabelText('Nazwisko'), { target: { value: 'Kowalski' } });
    fireEvent.change(screen.getByLabelText('Imię'), { target: { value: 'Jan' } });
    
    // Select Coordinator
    fireEvent.click(screen.getByText('Wybierz koordynatora'));
    fireEvent.click(screen.getByText('Jan Kowalski'));

    // Go to Finance tab (content is always visible with mock, but we click for realism in flow if it mattered)
    // const financeTab = screen.getByRole('button', { name: 'Finanse i potrącenia' });
    // fireEvent.click(financeTab);
    
    // Wait for tab content to appear - wait for the label "Zwrot kaucji"
    await screen.findByText('Zwrot kaucji');
    
    const comboboxes = screen.getAllByRole('combobox');
    const depositReturnSelect = comboboxes.find(el => el.textContent?.includes('Status zwrotu kaucji'));
    
    if (!depositReturnSelect) {
        throw new Error('Deposit return select not found');
    }

    fireEvent.click(depositReturnSelect);
    fireEvent.click(screen.getByRole('option', { name: 'Nie' }));

    // Leave deduction entry date empty
    const submitButton = screen.getByRole('button', { name: 'Zapisz' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Data jest wymagana, jeśli wprowadzono potrącenia lub kaucja nie jest zwracana.')).toBeInTheDocument();
    });
  });
});