/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import EntityView, { formatDate, isBokResident, isEmployee } from '@/components/views/entity-view';
import type { Employee, Settings, NonEmployee, SessionData, AddressHistory, BokResident } from '@/types';
import { useMainLayout } from '@/components/layouts/main-layout';

// ─── Mutable search params for tab switching ────────────────────────────────
const mockSearchParams = new URLSearchParams('tab=active');
const mockPush = jest.fn((url: string) => {
  const query = url.split('?')[1] || '';
  const newParams = new URLSearchParams(query);
  Array.from(mockSearchParams.keys()).forEach((k) => mockSearchParams.delete(k));
  newParams.forEach((v, k) => mockSearchParams.set(k, v));
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/dashboard/employees',
  useSearchParams: () => mockSearchParams,
}));

// ─── Mock shadcn/ui components ──────────────────────────────────────────────
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

jest.mock('@/components/ui/tabs', () => {
  const { createContext, Children, useContext } = jest.requireActual('react') as typeof import('react');
  const TabsCtx = createContext<{ onValueChange?: (v: string) => void }>({});

  function Tabs({ children, value, onValueChange }: any) {
    return (
      <TabsCtx.Provider value={{ onValueChange }}>
        <div data-testid="tabs" data-value={value}>
          {Children.toArray(children).map((child: any) => {
            if (child?.type?.displayName === 'TabsContent' || child?.type?.name === 'TabsContent') {
              return child?.props?.value === value ? child : null;
            }
            return child;
          })}
        </div>
      </TabsCtx.Provider>
    );
  }

  function TabsList({ children }: any) {
    return <div data-testid="tabs-list">{children}</div>;
  }

  function TabsTrigger({ children, value, disabled }: any) {
    const { onValueChange } = useContext(TabsCtx);
    return (
      <button type="button" data-testid={`tab-trigger-${value}`} onClick={() => onValueChange?.(value)} disabled={disabled}>
        {children}
      </button>
    );
  }

  const TabsContent = React.forwardRef(({ children, value, className }: any, _ref: any) => (
    <div data-testid={`tabs-content-${value}`} className={className}>{children}</div>
  ));
  TabsContent.displayName = 'TabsContent';

  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: any) => (
    asChild ? <div data-testid="dropdown-trigger">{children}</div> : <button type="button" data-testid="dropdown-trigger">{children}</button>
  ),
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content" role="menu">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className, onSelect }: any) => (
    <div role="menuitem" className={className} onClick={onClick} data-onselect={onSelect ? 'yes' : 'no'}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
}));

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) => <div data-testid="alert-dialog" data-open={open}>{children}</div>,
  AlertDialogTrigger: ({ children, asChild }: any) => (
    asChild ? <span data-testid="alert-dialog-trigger">{children}</span> : <button type="button" data-testid="alert-dialog-trigger">{children}</button>
  ),
  AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div data-testid="alert-dialog-header">{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div data-testid="alert-dialog-title">{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div data-testid="alert-dialog-description">{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div data-testid="alert-dialog-footer">{children}</div>,
  AlertDialogAction: ({ children, onClick }: any) => <button type="button" data-testid="alert-dialog-action" onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children, onClick }: any) => <button type="button" data-testid="alert-dialog-cancel" onClick={onClick}>{children}</button>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}));

jest.mock('@/components/ui/table', () => ({
  Table: ({ children, className }: any) => <table className={className}>{children}</table>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableRow: ({ children, onClick, className, style }: any) => <tr onClick={onClick} className={className} style={style}>{children}</tr>,
  TableHead: ({ children, className }: any) => <th className={className}>{children}</th>,
  TableCell: ({ children, onClick, className, colSpan }: any) => <td onClick={onClick} className={className} colSpan={colSpan}>{children}</td>,
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, onClick, className }: any) => <div data-testid="card" onClick={onClick} className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <div data-testid="card-title" className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div data-testid="card-content" className={className}>{children}</div>,
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button type="button" data-variant={variant} data-size={size} className={className} onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className }: any) => (
    <input value={value} onChange={onChange} placeholder={placeholder} className={className} />
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>{children}</span>
  ),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, id, className }: any) => <div id={id} className={className}>{children}</div>,
  ScrollBar: ({ orientation }: any) => <div data-testid="scroll-bar" data-orientation={orientation} />,
}));

jest.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
  SkeletonTable: ({ rowCount, colCount }: any) => <div data-testid="skeleton-table" data-rows={rowCount} data-cols={colCount} />,
  SkeletonCardList: ({ count }: any) => <div data-testid="skeleton-card-list" data-count={count} />,
}));

jest.mock('@/components/ui/filterable-header', () => ({
  FilterableHeader: ({ label, field, onSort, sortBy, sortOrder }: any) => (
    <th data-field={field} data-sortby={sortBy} data-sortorder={sortOrder} onClick={() => onSort?.(field)}>
      {label}
    </th>
  ),
}));

jest.mock('@/components/dialogs/bok-stats-drill-down-dialog', () => ({
  BokStatsDrillDownDialog: ({ isOpen, title, yesList, noList }: any) => (
    isOpen ? (
      <div data-testid="bok-stats-dialog">
        <div data-testid="bok-stats-title">{title}</div>
        <div data-testid="bok-stats-yes-count">{yesList.length}</div>
        <div data-testid="bok-stats-no-count">{noList.length}</div>
      </div>
    ) : null
  ),
}));

jest.mock('lucide-react', () => ({
  MoreHorizontal: () => <span data-testid="icon-more-horizontal" />,
  PlusCircle: () => <span data-testid="icon-plus-circle" />,
  ChevronsLeft: () => <span data-testid="icon-chevrons-left" />,
  ChevronLeft: () => <span data-testid="icon-chevron-left" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  ChevronsRight: () => <span data-testid="icon-chevrons-right" />,
  Users: () => <span data-testid="icon-users" />,
  UserX: () => <span data-testid="icon-user-x" />,
  LayoutGrid: () => <span data-testid="icon-layout-grid" />,
  List: () => <span data-testid="icon-list" />,
  Trash2: () => <span data-testid="icon-trash2" />,
  History: () => <span data-testid="icon-history" />,
  Download: () => <span data-testid="icon-download" />,
  Briefcase: () => <span data-testid="icon-briefcase" />,
}));

jest.mock('xlsx', () => ({
  utils: {
    json_to_sheet: jest.fn(),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  writeFile: jest.fn(),
}));

jest.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => ({ isMobile: false, isMounted: true }),
}));

jest.mock('@/hooks/use-view-persistence', () => ({
  useViewPersistence: jest.fn(),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

jest.mock('@/lib/i18n', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        'entity.title': 'Pracownicy',
        'entity.searchBySurname': 'Szukaj po nazwisku',
        'common.add': 'Dodaj',
        'entity.addEmployee': 'Dodaj pracownika',
        'entity.addResident': 'Dodaj mieszkańca NZ',
        'entity.addBokResident': 'Dodaj rezydenta BOK',
        'common.edit': 'Edytuj',
        'common.restore': 'Przywróć',
        'entity.dismiss': 'Zwolnij',
        'entity.deletePermanently': 'Usuń na stałe',
        'entity.confirmDeleteTitle': 'Potwierdź usunięcie',
        'entity.confirmDeleteDesc': 'Czy na pewno chcesz usunąć {name}?',
        'entity.confirmDelete': 'Usuń',
        'common.cancel': 'Anuluj',
        'entity.page': 'Strona {current} z {total}',
        'entity.openMenu': 'Otwórz menu',
        'col.lastName': 'Nazwisko',
        'col.firstName': 'Imię',
        'col.coordinator': 'Koordynator',
        'col.department': 'Zakład',
        'col.address': 'Adres',
        'col.room': 'Pokój',
        'col.checkIn': 'Zameldowanie',
        'col.checkOut': 'Wymeldowanie',
        'col.actions': 'Akcje',
        'col.passport': 'Paszport',
        'col.hasPermit': 'Zezwolenie',
        'col.hasPesel': 'PESEL',
        'common.noData': 'Brak danych',
        'common.yes': 'Tak',
        'common.no': 'Nie',
        'common.none': 'Brak',
        'entity.exportExcel': 'Eksportuj Excel ({count})',
        'entity.ownHousing': 'Własne mieszkanie ({address})',
        'entity.ownHousingNoData': 'Własne mieszkanie (brak danych)',
        'entity.bokResidentLabel': 'Rezydent BOK',
        'entity.nonEmployeeLabel': 'Mieszkaniec NZ',
        'entity.addressLabel': 'Adres: ',
        'entity.room': 'pok.',
        'entity.nationalityLabel': 'Narodowość: ',
        'entity.checkInLabel': 'Zameldowanie: ',
        'entity.periodLabel': 'Okres: ',
        'tab.active': 'Aktywni',
        'tab.dismissed': 'Zwolnieni',
        'tab.nonEmployees': 'Mieszkańcy NZ',
        'tab.history': 'Historia',
        'tab.bok': 'BOK',
        'tab.bokActive': 'Aktywni BOK',
        'tab.bokDismissed': 'Zwolnieni BOK',
        'stats.hasPermit': 'Zezwolenie',
        'stats.hasPesel': 'PESEL',
        'stats.yes': 'Tak',
        'stats.no': 'Nie',
        'history.confirmDeleteTitle': 'Usuń historię',
        'history.confirmDeleteDesc': 'Czy usunąć {name} z {address}?',
        'entity.filterByDepartment': 'Filtruj zakład',
        'entity.allDepartments': 'Wszystkie zakłady',
      };
      let text = map[key] ?? key;
      if (params) {
        text = Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), text);
      }
      return text;
    },
  }),
}));

jest.mock('@/components/layouts/main-layout', () => ({
  useMainLayout: jest.fn(),
}));

// ─── Mock data factories ─────────────────────────────────────────────────────

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'e1',
  firstName: 'Jan',
  lastName: 'Kowalski',
  fullName: 'Jan Kowalski',
  coordinatorId: 'coord1',
  nationality: 'PL',
  gender: 'M',
  address: 'Adres 1',
  roomNumber: '101',
  zaklad: 'Zakład A',
  checkInDate: '2024-01-01',
  checkOutDate: '2024-12-31',
  contractStartDate: '2024-01-01',
  contractEndDate: '2024-12-31',
  departureReportDate: null,
  comments: '',
  status: 'active',
  depositReturned: null,
  depositReturnAmount: null,
  deductionRegulation: null,
  deductionNo4Months: null,
  deductionNo30Days: null,
  deductionReason: undefined,
  deductionEntryDate: null,
  ...overrides,
});

const makeNonEmployee = (overrides: Partial<NonEmployee> = {}): NonEmployee => ({
  id: 'n1',
  firstName: 'Piotr',
  lastName: 'Zieliński',
  fullName: 'Piotr Zieliński',
  coordinatorId: 'coord1',
  nationality: 'UA',
  gender: 'M',
  address: 'Adres 2',
  roomNumber: '201',
  checkInDate: '2024-03-01',
  checkOutDate: '2024-10-31',
  departureReportDate: null,
  comments: '',
  status: 'active',
  paymentType: 'Miesięczny',
  paymentAmount: 500,
  ...overrides,
});

const makeBokResident = (overrides: Partial<BokResident> = {}): BokResident => ({
  id: 'b1',
  firstName: 'Anna',
  lastName: 'Nowak',
  fullName: 'Anna Nowak',
  nationality: 'UA',
  locality: 'Warszawa',
  address: 'Adres BOK',
  roomNumber: '301',
  gender: 'F',
  passportNumber: 'AB123456',
  checkInDate: '2024-05-01',
  checkOutDate: '2024-11-01',
  comments: '',
  status: 'active',
  hasPermit: true,
  hasPesel: false,
  ...overrides,
});

const makeAddressHistory = (overrides: Partial<AddressHistory> = {}): AddressHistory => ({
  id: 'h1',
  employeeId: 'e1',
  employeeFirstName: 'Jan',
  employeeLastName: 'Kowalski',
  coordinatorName: 'Kowalski',
  department: 'Zakład A',
  address: 'Adres 1',
  checkInDate: '2024-01-01',
  checkOutDate: '2024-12-31',
  ...overrides,
});

const mockSettings: Settings = {
  id: 'global-settings',
  addresses: [],
  nationalities: [],
  departments: ['Zakład A', 'Zakład B'],
  coordinators: [
    { uid: 'coord1', name: 'Kowalski', isAdmin: false, departments: ['Zakład A'] },
    { uid: 'coord2', name: 'Nowak', isAdmin: false, departments: ['Zakład B'] },
  ],
  genders: [],
  localities: [],
  paymentTypesNZ: [],
  statuses: [],
  bokRoles: [],
  bokReturnOptions: [],
  bokStatuses: [],
};

const adminUser: SessionData = {
  isLoggedIn: true,
  uid: 'admin-1',
  name: 'Admin',
  isAdmin: true,
  isDriver: false,
  isRekrutacja: false,
  isBok: false,
};

const bokUser: SessionData = {
  isLoggedIn: true,
  uid: 'bok-1',
  name: 'BOK User',
  isAdmin: false,
  isDriver: false,
  isRekrutacja: false,
  isBok: true,
};

const coordinatorUser: SessionData = {
  isLoggedIn: true,
  uid: 'coord1',
  name: 'Kowalski',
  isAdmin: false,
  isDriver: false,
  isRekrutacja: false,
  isBok: false,
};

const driverUser: SessionData = {
  isLoggedIn: true,
  uid: 'driver-1',
  name: 'Driver',
  isAdmin: false,
  isDriver: true,
  isRekrutacja: false,
  isBok: false,
};

// ─── Helper to reset search params ──────────────────────────────────────────

function resetSearchParams(query = 'tab=active') {
  Array.from(mockSearchParams.keys()).forEach((k) => mockSearchParams.delete(k));
  new URLSearchParams(query).forEach((v, k) => mockSearchParams.set(k, v));
}

function setupMainLayout(overrides: any = {}) {
  const defaults = {
    allEmployees: [makeEmployee()],
    allNonEmployees: [makeNonEmployee()],
    allBokResidents: [makeBokResident()],
    addressHistory: [makeAddressHistory()],
    settings: mockSettings,
    odbiorEntries: [],
    handleRestoreEmployee: jest.fn(),
    handleRestoreNonEmployee: jest.fn(),
    handleRestoreBokResident: jest.fn(),
    handleDeleteEmployee: jest.fn(),
    handleEditEmployeeClick: jest.fn(),
    handleEditNonEmployeeClick: jest.fn(),
    handleEditBokResidentClick: jest.fn(),
    handleAddEmployeeClick: jest.fn(),
    handleAddNonEmployeeClick: jest.fn(),
    handleAddBokResidentClick: jest.fn(),
    handleDeleteNonEmployee: jest.fn(),
    handleDeleteBokResident: jest.fn(),
    handleDeleteAddressHistory: jest.fn(),
  };
  (useMainLayout as jest.Mock).mockReturnValue({ ...defaults, ...overrides });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('EntityView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSearchParams('tab=active');
  });

  // 1. Loading skeleton
  it('renders loading skeleton when data is missing', () => {
    setupMainLayout({ settings: null, allEmployees: null, allNonEmployees: null, addressHistory: null });
    render(<EntityView currentUser={adminUser} />);
    expect(screen.getByTestId('skeleton-table')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-card-list')).toBeInTheDocument();
  });

  // 2. Active tab renders by default
  it('renders active tab with employee table by default', () => {
    setupMainLayout();
    render(<EntityView currentUser={adminUser} />);
    expect(screen.getByTestId('tabs-content-active')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(2); // header + at least 1 data row
  });

  // 3. Pagination controls when more than 20 items
  it('renders pagination controls when more than 20 items', () => {
    const manyEmployees = Array.from({ length: 21 }, (_, i) =>
      makeEmployee({
        id: `e-${i}`,
        firstName: `Employee ${i}`,
        lastName: `Last ${i}`,
        fullName: `Employee ${i} Last ${i}`,
        status: 'active',
      })
    );
    setupMainLayout({ allEmployees: manyEmployees });
    render(<EntityView currentUser={adminUser} />);
    expect(screen.getByText('Strona 1 z 2')).toBeInTheDocument();
    expect(screen.getByTestId('icon-chevrons-left')).toBeInTheDocument();
    expect(screen.getByTestId('icon-chevron-right')).toBeInTheDocument();
  });

  // 4. Search input renders and typing updates local search
  it('search input renders and typing updates local search', () => {
    setupMainLayout();
    render(<EntityView currentUser={adminUser} />);
    const searchInput = screen.getByPlaceholderText('Szukaj po nazwisku');
    expect(searchInput).toBeInTheDocument();
    fireEvent.change(searchInput, { target: { value: 'Kowalski' } });
    expect(searchInput).toHaveValue('Kowalski');
  });

  // 5. Export button disabled when count=0
  it('export button is disabled when count is 0', () => {
    setupMainLayout({ allEmployees: [] });
    render(<EntityView currentUser={adminUser} />);
    const exportBtn = screen.getByText('Eksportuj Excel (0)');
    expect(exportBtn).toBeDisabled();
  });

  // 6. EntityActions dropdown shows edit/delete for active employee
  it('EntityActions dropdown shows edit and delete options for active employee', () => {
    setupMainLayout();
    render(<EntityView currentUser={adminUser} />);
    const table = screen.getByRole('table');
    const dropdown = within(table).getByTestId('dropdown-content');
    expect(within(dropdown).getByText('Edytuj')).toBeInTheDocument();
    expect(within(dropdown).getByText('Zwolnij')).toBeInTheDocument();
    expect(within(dropdown).getByText('Usuń na stałe')).toBeInTheDocument();
  });

  // 7. EntityActions shows restore option for dismissed employee
  it('EntityActions shows restore option for dismissed employee', () => {
    resetSearchParams('tab=dismissed');
    setupMainLayout({
      allEmployees: [makeEmployee({ status: 'dismissed' })],
    });
    render(<EntityView currentUser={adminUser} />);
    const table = screen.getByRole('table');
    const dropdown = within(table).getByTestId('dropdown-content');
    expect(within(dropdown).getByText('Przywróć')).toBeInTheDocument();
  });

  // 8. Clicking table row triggers onEdit
  it('clicking table row triggers onEdit', () => {
    const handleEdit = jest.fn();
    setupMainLayout({ handleEditEmployeeClick: handleEdit });
    render(<EntityView currentUser={adminUser} />);
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(rows[1]); // first data row after header
    expect(handleEdit).toHaveBeenCalled();
  });

  // 9. BOK residents tab renders stats cards
  it('BOK residents tab renders stats cards with hasPermit and hasPesel counts', () => {
    resetSearchParams('tab=bok-residents');
    setupMainLayout({
      allBokResidents: [
        makeBokResident({ id: 'b1', hasPermit: true, hasPesel: true }),
        makeBokResident({ id: 'b2', hasPermit: false, hasPesel: false }),
      ],
    });
    render(<EntityView currentUser={bokUser} />);
    expect(screen.getByTestId('tabs-content-bok-residents')).toBeInTheDocument();
    // Stats cards should show counts (scope to tab content to avoid root Card)
    const bokContent = screen.getByTestId('tabs-content-bok-residents');
    const cards = within(bokContent).getAllByTestId('card').filter((c) => c.className.includes('cursor-pointer'));
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  // 10. Clicking BOK stats card opens drill-down dialog
  it('clicking BOK stats card opens drill-down dialog', async () => {
    resetSearchParams('tab=bok-residents');
    setupMainLayout({
      allBokResidents: [
        makeBokResident({ id: 'b1', hasPermit: true, hasPesel: true }),
        makeBokResident({ id: 'b2', hasPermit: false, hasPesel: false }),
      ],
    });
    render(<EntityView currentUser={bokUser} />);
    const bokContent = screen.getByTestId('tabs-content-bok-residents');
    const cards = within(bokContent).getAllByTestId('card').filter((c) => c.className.includes('cursor-pointer'));
    expect(cards.length).toBe(2);
    // Click the first stats card (hasPermit)
    fireEvent.click(cards[0]);
    await waitFor(() => {
      expect(screen.getByTestId('bok-stats-dialog')).toBeInTheDocument();
    });
    expect(screen.getByTestId('bok-stats-title')).toHaveTextContent('Zezwolenie');
  });

  // 11. formatDate helper
  describe('formatDate', () => {
    it('parses ISO date (yyyy-MM-dd)', () => {
      expect(formatDate('2024-01-15')).toBe('15-01-2024');
    });
    it('parses dd-MM-yyyy format', () => {
      expect(formatDate('15-01-2024')).toBe('15-01-2024');
    });
    it('returns N/A for null/undefined/empty', () => {
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate(undefined)).toBe('N/A');
      expect(formatDate('')).toBe('N/A');
    });
    it('returns Invalid Date for truly invalid input', () => {
      expect(formatDate('not-a-date')).toBe('Invalid Date');
    });
  });

  // 12. Type guards
  describe('type guards', () => {
    it('isBokResident returns true for BokResident and false for others', () => {
      const bok: BokResident = makeBokResident();
      const emp: Employee = makeEmployee();
      const ne: NonEmployee = makeNonEmployee();
      expect(isBokResident(bok)).toBe(true);
      expect(isBokResident(emp)).toBe(false);
      expect(isBokResident(ne)).toBe(false);
    });

    it('isEmployee returns true for Employee and false for others', () => {
      const bok: BokResident = makeBokResident();
      const emp: Employee = makeEmployee();
      const ne: NonEmployee = makeNonEmployee();
      expect(isEmployee(emp)).toBe(true);
      expect(isEmployee(bok)).toBe(false);
      expect(isEmployee(ne)).toBe(false);
    });
  });

  // 13. ControlPanel add button dropdown shows options based on user role
  describe('ControlPanel add button permissions', () => {
    it('shows all add options for admin', () => {
      setupMainLayout();
      render(<EntityView currentUser={adminUser} />);
      // The first dropdown-content is the ControlPanel add button
      const dropdowns = screen.getAllByTestId('dropdown-content');
      const addDropdown = dropdowns[0];
      expect(within(addDropdown).getByText('Dodaj pracownika')).toBeInTheDocument();
      expect(within(addDropdown).getByText('Dodaj mieszkańca NZ')).toBeInTheDocument();
      expect(within(addDropdown).getByText('Dodaj rezydenta BOK')).toBeInTheDocument();
    });

    it('shows employee and non-employee options for coordinator', () => {
      setupMainLayout();
      render(<EntityView currentUser={coordinatorUser} />);
      const dropdowns = screen.getAllByTestId('dropdown-content');
      const addDropdown = dropdowns[0];
      expect(within(addDropdown).getByText('Dodaj pracownika')).toBeInTheDocument();
      expect(within(addDropdown).getByText('Dodaj mieszkańca NZ')).toBeInTheDocument();
      expect(within(addDropdown).queryByText('Dodaj rezydenta BOK')).not.toBeInTheDocument();
    });

    it('shows only BOK resident option for driver', () => {
      setupMainLayout();
      render(<EntityView currentUser={driverUser} />);
      const dropdowns = screen.getAllByTestId('dropdown-content');
      const addDropdown = dropdowns[0];
      expect(within(addDropdown).queryByText('Dodaj pracownika')).not.toBeInTheDocument();
      expect(within(addDropdown).queryByText('Dodaj mieszkańca NZ')).not.toBeInTheDocument();
      expect(within(addDropdown).getByText('Dodaj rezydenta BOK')).toBeInTheDocument();
    });
  });

  // 14. View mode toggle buttons render on desktop
  it('view mode toggle buttons render on desktop', () => {
    setupMainLayout();
    render(<EntityView currentUser={adminUser} />);
    expect(screen.getByTestId('icon-list')).toBeInTheDocument();
    expect(screen.getByTestId('icon-layout-grid')).toBeInTheDocument();
  });

  // 15. History tab renders HistoryTable with history entries
  it('history tab renders HistoryTable with history entries', () => {
    resetSearchParams('tab=history');
    setupMainLayout({
      addressHistory: [
        makeAddressHistory({ id: 'h1', employeeLastName: 'Kowalski' }),
        makeAddressHistory({ id: 'h2', employeeLastName: 'Nowak' }),
      ],
    });
    render(<EntityView currentUser={adminUser} />);
    expect(screen.getByTestId('tabs-content-history')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(3); // header + 2 data rows
    const rowTexts = rows.map((r) => r.textContent);
    expect(rowTexts.some((t) => t?.includes('Kowalski'))).toBe(true);
    expect(rowTexts.some((t) => t?.includes('Nowak'))).toBe(true);
  });
});
