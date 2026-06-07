import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddBokResidentForm } from '@/components/forms/add-bok-resident-form';
import type { Settings, SessionData, BokResident } from '@/types';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/i18n', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'pl', dateLocale: undefined }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/components/layouts/main-layout', () => ({
  useMainLayout: () => ({
    allEmployees: [],
    allNonEmployees: [],
    allBokResidents: [],
  }),
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
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value }: { children: React.ReactNode; value?: string }) =>
    <div data-testid="select" data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) =>
    <div data-value={value}>{children}</div>,
}));

jest.mock('react-webcam', () => {
  const ReactActual = jest.requireActual('react');
  const Mock = ReactActual.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) => (
      <div data-testid="webcam" ref={ref} />
    )
  );
  Mock.displayName = 'WebcamMock';
  return {
    __esModule: true,
    default: Mock,
  };
});

jest.mock('@/ai/flows/extract-passport-data-flow', () => ({
  extractPassportData: jest.fn(),
}));

// Mock wizard-utils — stub OcrCameraButton and other heavy components
jest.mock('@/components/wizard-utils', () => ({
  WizardStepIndicator: ({ steps, current }: { steps: string[]; current: number }) => (
    <div data-testid="step-indicator" data-current={current}>
      {steps.map((s, i) => <span key={i}>{s}</span>)}
    </div>
  ),
  WizardDateInput: ({ onChange }: { onChange: (d: Date | null) => void }) => (
    <input data-testid="wizard-date-input" onChange={() => onChange(new Date())} />
  ),
  OcrCameraButton: () => null,
  WizardAddressPicker: () => <div data-testid="address-picker" />,
  WizardGenderPicker: ({ genders, onChange }: { genders: string[]; value: string; onChange: (g: string) => void }) => (
    <div data-testid="gender-picker">
      {genders.map(g => (
        <button key={g} type="button" onClick={() => onChange(g)}>{g}</button>
      ))}
    </div>
  ),
  buildAddressItems: () => [],
}));

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockSettings: Settings = {
  id: 'global-settings',
  coordinators: [{ uid: 'coord-1', name: 'Jan Kowalski', isAdmin: false, departments: [] }],
  localities: ['Warszawa'],
  departments: [],
  nationalities: ['Polska'],
  genders: ['Mężczyzna', 'Kobieta'],
  addresses: [{
    id: 'addr-1',
    locality: 'MIESZKANIA TYMCZASOWE',
    name: 'Testowa 1',
    coordinatorIds: ['coord-1'],
    rooms: [{ id: 'r1', name: '101', capacity: 2, isActive: true }],
    isActive: true,
  }],
  paymentTypesNZ: [],
  statuses: [],
  bokRoles: ['Rola1'],
  bokReturnOptions: ['Tak', 'Nie'],
  bokStatuses: [],
} as unknown as Settings;

const mockCurrentUser: SessionData = {
  isLoggedIn: true,
  uid: 'coord-1',
  name: 'Jan Kowalski',
  isAdmin: true,
  isDriver: false,
  isRekrutacja: false,
  isBok: true,
} as unknown as SessionData;

const mockResident: BokResident = {
  id: 'bok-1',
  firstName: 'Piotr',
  lastName: 'Zając',
  fullName: 'Piotr Zając',
  nationality: 'Polska',
  gender: 'Mężczyzna',
  address: 'Testowa 1',
  roomNumber: '101',
  checkInDate: '2024-01-01',
  checkOutDate: null,
  status: 'active',
} as unknown as BokResident;

const defaultProps = {
  isOpen: true,
  onOpenChange: jest.fn(),
  onSave: jest.fn(),
  settings: mockSettings,
  resident: null as BokResident | null,
  currentUser: mockCurrentUser,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AddBokResidentForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when isOpen=false', () => {
    render(<AddBokResidentForm {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('renders wizard when isOpen=true and resident=null', () => {
    render(<AddBokResidentForm {...defaultProps} resident={null} />);
    expect(screen.getByTestId('dialog')).toBeTruthy();
    // Wizard step indicator should be rendered
    expect(screen.getByTestId('step-indicator')).toBeTruthy();
  });

  it('renders edit form when resident is provided', () => {
    render(<AddBokResidentForm {...defaultProps} resident={mockResident} />);
    expect(screen.getByTestId('dialog')).toBeTruthy();
    // Edit form shows firstName/lastName inputs pre-filled
    expect(screen.getByDisplayValue('Piotr')).toBeTruthy();
    expect(screen.getByDisplayValue('Zając')).toBeTruthy();
  });

  it('Cancel/close button calls onOpenChange(false)', () => {
    const onOpenChange = jest.fn();
    render(<AddBokResidentForm {...defaultProps} resident={null} onOpenChange={onOpenChange} />);
    // On step 0, back/cancel button should call onOpenChange(false)
    const cancelBtn = screen.getByRole('button', { name: /common\.cancel/i });
    fireEvent.click(cancelBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
