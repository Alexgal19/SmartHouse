import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditEmployeeForm } from '@/components/forms/edit-employee-form';
import type { Employee, Settings, SessionData } from '@/types';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/i18n', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'pl',
    dateLocale: undefined,
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/components/layouts/main-layout', () => ({
  useMainLayout: () => ({
    handleDismissEmployee: jest.fn(),
    allEmployees: [],
    allNonEmployees: [],
    allBokResidents: [],
  }),
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) =>
    <button type="button" data-value={value}>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/calendar', () => ({
  Calendar: () => <div data-testid="calendar" />,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/combobox', () => ({
  Combobox: ({
    onChange,
    options,
    value,
    placeholder,
  }: {
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    value: string;
    placeholder?: string;
  }) => (
    <select data-testid="combobox" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  ),
}));

jest.mock('@/components/dialogs/address-preview-dialog', () => ({
  AddressPreviewDialog: () => null,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }) => <div data-testid="select" data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}));

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockSettings: Settings = {
  id: 'global-settings',
  coordinators: [
    { uid: 'coord-1', name: 'Jan Kowalski', isAdmin: false, departments: ['Dział A'] },
  ],
  localities: ['Warszawa'],
  departments: ['Dział A'],
  nationalities: ['Polska'],
  genders: ['Mężczyzna', 'Kobieta'],
  addresses: [
    {
      id: 'addr-1',
      locality: 'Warszawa',
      name: 'Testowa 1',
      coordinatorIds: ['coord-1'],
      rooms: [{ id: 'r1', name: '101', capacity: 2, isActive: true }],
      isActive: true,
    },
  ],
  paymentTypesNZ: [],
  statuses: [],
  bokRoles: [],
  bokReturnOptions: [],
  bokStatuses: [],
} as unknown as Settings;

const mockCurrentUser: SessionData = {
  isLoggedIn: true,
  uid: 'coord-1',
  name: 'Jan Kowalski',
  isAdmin: true,
  isDriver: false,
  isRekrutacja: false,
  isBok: false,
} as unknown as SessionData;

const mockEmployee: Employee = {
  id: 'emp-1',
  firstName: 'Adam',
  lastName: 'Nowak',
  fullName: 'Adam Nowak',
  coordinatorId: 'coord-1',
  nationality: 'Polska',
  gender: 'Mężczyzna',
  address: 'Testowa 1',
  roomNumber: '101',
  zaklad: 'Dział A',
  checkInDate: '2024-01-01',
  checkOutDate: null,
  contractStartDate: '2024-01-01',
  contractEndDate: '2024-12-31',
  status: 'active',
  depositReturned: null,
  depositReturnAmount: null,
  deductionRegulation: null,
  deductionNo4Months: null,
  deductionNo30Days: null,
  deductionReason: undefined,
} as unknown as Employee;

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  onOpenChange: jest.fn(),
  onSave: jest.fn(),
  settings: mockSettings,
  employee: mockEmployee,
  currentUser: mockCurrentUser,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EditEmployeeForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen=false', () => {
    render(<EditEmployeeForm {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('renders dialog when isOpen=true with employee data', () => {
    render(<EditEmployeeForm {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeTruthy();
  });

  it('shows employee name fields populated with existing data', () => {
    render(<EditEmployeeForm {...defaultProps} />);

    const firstNameInput = screen.getByDisplayValue('Adam');
    const lastNameInput = screen.getByDisplayValue('Nowak');

    expect(firstNameInput).toBeTruthy();
    expect(lastNameInput).toBeTruthy();
  });

  it('Cancel button calls onOpenChange(false)', () => {
    const onOpenChange = jest.fn();
    render(<EditEmployeeForm {...defaultProps} onOpenChange={onOpenChange} />);

    // Find a button with "cancel" translation key text
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders Save button', () => {
    render(<EditEmployeeForm {...defaultProps} />);

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeTruthy();
  });
});
