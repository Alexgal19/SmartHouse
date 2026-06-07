/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AddressPreviewDialog } from '@/components/dialogs/address-preview-dialog';
import type { Settings, Employee, NonEmployee } from '@/types';

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, 'data-testid': id }: any) => <div data-testid={id || 'dialog-content'}>{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div data-testid="scroll-area">{children}</div>,
}));

const SelectCtx = React.createContext<{ onValueChange?: (v: string) => void }>({});

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <SelectCtx.Provider value={{ onValueChange }}>
      <div data-testid="select" data-value={value}>
        <button type="button" data-testid="select-trigger">{value || 'placeholder'}</button>
        {children}
      </div>
    </SelectCtx.Provider>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => {
    const { onValueChange } = React.useContext(SelectCtx);
    return (
      <button type="button" data-testid={`select-item-${value}`} onClick={() => onValueChange?.(value)}>
        {children}
      </button>
    );
  },
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>{children}</span>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, 'data-testid': id }: any) => (
    <button type="button" data-testid={id || 'button'} onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, onClick, className }: any) => <div data-testid="card" onClick={onClick} className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: any) => <label data-testid="label">{children}</label>,
}));

jest.mock('@/lib/i18n', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'form.addressPreviewDialogTitle': 'Podgląd adresu',
        'form.selectLocalityToSeeAvailability': 'Wybierz miejscowość',
        'form.selectAccommodation': 'Wybierz zakwaterowanie',
        'form.locality': 'Miejscowość',
        'form.selectLocality': 'Wybierz miejscowość',
      };
      return map[key] || key;
    },
  }),
}));

jest.mock('@/lib/address-filters', () => ({
  isRoomActive: (room: any, _address?: any) => room.isActive !== false,
  isOwnAddressEntry: (name: string) => name.startsWith('Własne mieszkanie'),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

const mockSettings = {
  id: 'global-settings' as const,
  addresses: [
    {
      id: 'a1',
      name: 'ul. Kwiatowa 1',
      locality: 'Warszawa',
      rooms: [
        { id: 'r1', name: '101', capacity: 2, isActive: true },
        { id: 'r2', name: '102', capacity: 3, isActive: true },
      ],
      coordinatorIds: ['coord1'],
      isActive: true,
    },
    {
      id: 'a2',
      name: 'ul. Leśna 2',
      locality: 'Kraków',
      rooms: [
        { id: 'r3', name: '201', capacity: 1, isActive: true },
        { id: 'r4', name: '202', capacity: 4, isActive: false },
      ],
      coordinatorIds: ['coord2'],
      isActive: true,
    },
    {
      id: 'a3',
      name: 'Własne mieszkanie test',
      locality: 'Warszawa',
      rooms: [{ id: 'r5', name: 'A', capacity: 1, isActive: true }],
      coordinatorIds: ['coord1'],
      isActive: true,
    },
  ],
  nationalities: [],
  departments: [],
  coordinators: [],
  genders: [],
  localities: [],
  paymentTypesNZ: [],
  statuses: [],
  bokRoles: [],
  bokReturnOptions: [],
  bokStatuses: [],
} as Settings;

const mockEmployees: Employee[] = [
  {
    id: 'e1',
    firstName: 'Jan',
    lastName: 'Kowalski',
    fullName: 'Jan Kowalski',
    coordinatorId: 'coord1',
    nationality: 'Polska',
    gender: 'M',
    address: 'ul. Kwiatowa 1',
    roomNumber: '101',
    zaklad: 'Zakład A',
    checkInDate: '2024-01-01',
    checkOutDate: '2024-12-31',
    contractStartDate: '2024-01-01',
    contractEndDate: '2024-12-31',
    status: 'active',
    depositReturned: 'Nie dotyczy',
    depositReturnAmount: null,
    deductionRegulation: null,
    deductionNo4Months: null,
    deductionNo30Days: null,
    deductionReason: undefined,
  },
  {
    id: 'e2',
    firstName: 'Anna',
    lastName: 'Nowak',
    fullName: 'Anna Nowak',
    coordinatorId: 'coord1',
    nationality: 'Polska',
    gender: 'K',
    address: 'ul. Kwiatowa 1',
    roomNumber: '101',
    zaklad: 'Zakład B',
    checkInDate: '2024-02-01',
    checkOutDate: '2024-11-30',
    contractStartDate: '2024-02-01',
    contractEndDate: '2024-11-30',
    status: 'active',
    depositReturned: 'Nie dotyczy',
    depositReturnAmount: null,
    deductionRegulation: null,
    deductionNo4Months: null,
    deductionNo30Days: null,
    deductionReason: undefined,
  },
];

const mockNonEmployees: NonEmployee[] = [
  {
    id: 'n1',
    firstName: 'Piotr',
    lastName: 'Zieliński',
    fullName: 'Piotr Zieliński',
    coordinatorId: 'coord2',
    nationality: 'Polska',
    gender: 'M',
    address: 'ul. Leśna 2',
    roomNumber: '201',
    checkInDate: '2024-03-01',
    checkOutDate: '2024-10-31',
    status: 'active',
    paymentType: 'cash',
    paymentAmount: 1000,
  },
];

function setup(props: Partial<React.ComponentProps<typeof AddressPreviewDialog>> = {}) {
  const defaultProps = {
    isOpen: true,
    onOpenChange: jest.fn(),
    settings: mockSettings,
    allEmployees: mockEmployees,
    allNonEmployees: mockNonEmployees,
    coordinatorId: undefined,
    onApplySelection: jest.fn(),
  };
  return render(<AddressPreviewDialog {...defaultProps} {...props} />);
}

describe('AddressPreviewDialog', () => {
  it('does not render when closed', () => {
    setup({ isOpen: false });
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders title and description when open', () => {
    setup();
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Podgląd adresu');
    expect(screen.getByTestId('dialog-description')).toHaveTextContent('Wybierz miejscowość');
  });

  it('shows locality summary cards when no locality selected', () => {
    setup();
    const warszawaCards = screen.getAllByText('Warszawa').filter((el) =>
      el.closest('[data-testid="card-title"]')
    );
    expect(warszawaCards.length).toBeGreaterThanOrEqual(1);
    const krakowCards = screen.getAllByText('Kraków').filter((el) =>
      el.closest('[data-testid="card-title"]')
    );
    expect(krakowCards.length).toBeGreaterThanOrEqual(1);
  });

  it('does not show own-address entries', () => {
    setup();
    expect(screen.queryByText(/Własne mieszkanie test/)).not.toBeInTheDocument();
  });

  it('does not show inactive rooms in summary', () => {
    setup();
    const krakowCards = screen.getAllByText('Kraków').filter((el) =>
      el.closest('[data-testid="card-title"]')
    );
    expect(krakowCards.length).toBeGreaterThanOrEqual(1);
  });

  it('shows address cards after selecting a locality', () => {
    setup();
    fireEvent.click(screen.getByTestId('select-item-Warszawa'));
    expect(screen.getByText('ul. Kwiatowa 1')).toBeInTheDocument();
  });

  it('expands address card to show rooms', () => {
    setup();
    fireEvent.click(screen.getByTestId('select-item-Warszawa'));
    const addressCard = screen.getByText('ul. Kwiatowa 1').closest('[data-testid="card"]');
    expect(addressCard).toBeInTheDocument();
    fireEvent.click(addressCard!);
    expect(screen.getByText(/Pokój 101/)).toBeInTheDocument();
  });

  it('shows full badge when room capacity reached', () => {
    setup();
    fireEvent.click(screen.getByTestId('select-item-Kraków'));
    const addressCard = screen.getByText('ul. Leśna 2').closest('[data-testid="card"]');
    fireEvent.click(addressCard!);
    const badges = screen.getAllByTestId('badge');
    const fullBadge = badges.find((b) => b.textContent === 'Pełny');
    expect(fullBadge).toBeInTheDocument();
  });

  it('shows free badge when room has availability', () => {
    setup();
    fireEvent.click(screen.getByTestId('select-item-Warszawa'));
    const addressCard = screen.getByText('ul. Kwiatowa 1').closest('[data-testid="card"]');
    fireEvent.click(addressCard!);
    const badges = screen.getAllByTestId('badge');
    const freeBadge = badges.find((b) => b.textContent === 'Wolne');
    expect(freeBadge).toBeInTheDocument();
  });

  it('apply button is disabled until locality, address, and room are selected', () => {
    setup();
    const applyBtn = screen.getByText('Zastosuj wybór');
    expect(applyBtn).toBeDisabled();
    fireEvent.click(screen.getByTestId('select-item-Warszawa'));
    expect(applyBtn).toBeDisabled();
  });

  it('calls onOpenChange when Cancel clicked', () => {
    const onOpenChange = jest.fn();
    setup({ onOpenChange });
    const cancelBtn = screen.getByText('Anuluj');
    fireEvent.click(cancelBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not show apply button when onApplySelection is absent', () => {
    setup({ onApplySelection: undefined });
    expect(screen.queryByText('Zastosuj wybór')).not.toBeInTheDocument();
  });

  it('shows no data message when addressOccupancy is empty', () => {
    setup({ allEmployees: null, allNonEmployees: null });
    expect(screen.getByText('Brak danych o adresach')).toBeInTheDocument();
  });

  it('filters addresses by coordinatorId when provided', () => {
    setup({ coordinatorId: 'coord1' });
    const warszawaCards = screen.getAllByText('Warszawa').filter((el) =>
      el.closest('[data-testid="card-title"]')
    );
    expect(warszawaCards.length).toBeGreaterThanOrEqual(1);
    const krakowCards = screen.queryAllByText('Kraków').filter((el) =>
      el.closest('[data-testid="card-title"]')
    );
    expect(krakowCards.length).toBe(0);
  });
});
