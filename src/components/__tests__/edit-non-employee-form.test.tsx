import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditNonEmployeeForm } from '@/components/forms/edit-non-employee-form';
import type { NonEmployee, Settings, SessionData } from '@/types';

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
    handleDismissNonEmployee: jest.fn(),
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
  paymentTypesNZ: ['Gotówka', 'Przelew'],
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

const mockNonEmployee: NonEmployee = {
  id: 'ne-1',
  firstName: 'Maria',
  lastName: 'Wiśniewska',
  fullName: 'Maria Wiśniewska',
  coordinatorId: 'coord-1',
  nationality: 'Polska',
  gender: 'Kobieta',
  address: 'Testowa 1',
  roomNumber: '101',
  checkInDate: '2024-01-01',
  checkOutDate: null,
  status: 'active' as const,
  paymentType: 'Gotówka',
  paymentAmount: 500,
} as unknown as NonEmployee;

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  onOpenChange: jest.fn(),
  onSave: jest.fn(),
  settings: mockSettings,
  nonEmployee: mockNonEmployee,
  currentUser: mockCurrentUser,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EditNonEmployeeForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen=false', () => {
    render(<EditNonEmployeeForm {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('renders dialog when isOpen=true', () => {
    render(<EditNonEmployeeForm {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeTruthy();
  });

  it('shows non-employee first and last name when provided', () => {
    render(<EditNonEmployeeForm {...defaultProps} />);

    const firstNameInput = screen.getByDisplayValue('Maria');
    const lastNameInput = screen.getByDisplayValue('Wiśniewska');

    expect(firstNameInput).toBeTruthy();
    expect(lastNameInput).toBeTruthy();
  });

  it('Cancel button calls onOpenChange(false)', () => {
    const onOpenChange = jest.fn();
    render(<EditNonEmployeeForm {...defaultProps} onOpenChange={onOpenChange} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Save button is present in the form', () => {
    render(<EditNonEmployeeForm {...defaultProps} />);

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeTruthy();
  });
});
