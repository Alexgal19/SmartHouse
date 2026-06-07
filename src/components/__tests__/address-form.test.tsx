/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AddressForm } from '@/components/forms/address-form';
import type { Address, Settings } from '@/types';

// Mock useLanguage
jest.mock('@/lib/i18n', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
    language: 'pl',
  }),
}));

// Mock Dialog (Radix UI causes issues in JSDOM)
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Select
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: { children: React.ReactNode; onValueChange?: (v: string) => void; value?: string }) =>
    <div data-testid="select" data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value, onClick }: { children: React.ReactNode; value: string; onClick?: () => void }) =>
    <div data-value={value} onClick={onClick}>{children}</div>,
}));

// Mock ScrollArea
jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Form components
jest.mock('@/components/ui/form', () => ({
  Form: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormField: ({ render, name, control }: any) => {
    const field = {
      onChange: jest.fn(),
      onBlur: jest.fn(),
      value: '',
      name,
      ref: jest.fn(),
    };
    return render({ field, fieldState: {}, formState: {} });
  },
  FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormLabel: ({ children, className }: { children: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
  FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormMessage: ({ children }: { children?: React.ReactNode }) => children ? <span>{children}</span> : null,
}));

const mockSettings: Settings = {
  id: 'global-settings',
  coordinators: [
    { uid: 'coord-1', name: 'Jan Kowalski', isAdmin: false, departments: [] },
    { uid: 'coord-2', name: 'Anna Nowak', isAdmin: false, departments: [] },
  ],
  localities: ['Warszawa', 'Kraków'],
  departments: [],
  nationalities: [],
  genders: [],
  addresses: [],
  paymentTypesNZ: [],
  statuses: [],
  bokRoles: [],
  bokReturnOptions: [],
  bokStatuses: [],
};

const mockAddress: Address = {
  id: 'addr-1',
  locality: 'Warszawa',
  name: 'ul. Testowa 1',
  coordinatorIds: ['coord-1'],
  rooms: [
    { id: 'room-1', name: 'Pokój 1', capacity: 3, isActive: true },
  ],
  isActive: true,
};

const defaultProps = {
  isOpen: true,
  onOpenChange: jest.fn(),
  onSave: jest.fn(),
  settings: mockSettings,
  address: null,
};

describe('AddressForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form fields in add mode (address=null)', async () => {
    await act(async () => {
      render(<AddressForm {...defaultProps} address={null} />);
    });

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    // Locality select
    const selects = screen.getAllByTestId('select');
    expect(selects.length).toBeGreaterThan(0);
    // Name input
    expect(screen.getByPlaceholderText('address.streetExample')).toBeInTheDocument();
    // Save button
    expect(screen.getByText('common.save')).toBeInTheDocument();
    // Cancel button
    expect(screen.getByText('common.cancel')).toBeInTheDocument();
  });

  it('renders with pre-filled data in edit mode (address provided)', async () => {
    await act(async () => {
      render(<AddressForm {...defaultProps} address={mockAddress} />);
    });

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    // The name input should exist
    const nameInput = screen.getByPlaceholderText('address.streetExample');
    expect(nameInput).toBeInTheDocument();
    // Edit mode title key used
    expect(screen.getByText('address.editAddress')).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = jest.fn();
    await act(async () => {
      render(<AddressForm {...defaultProps} onOpenChange={onOpenChange} />);
    });

    const cancelButton = screen.getByText('common.cancel');
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders the add coordinator button', async () => {
    await act(async () => {
      render(<AddressForm {...defaultProps} address={null} />);
    });

    expect(screen.getByText('address.addCoordinator')).toBeInTheDocument();
  });

  it('renders the add room button and clicking it adds a room row', async () => {
    await act(async () => {
      render(<AddressForm {...defaultProps} address={null} />);
    });

    const addRoomButton = screen.getByText('address.addRoom');
    expect(addRoomButton).toBeInTheDocument();

    // Before clicking: no room name inputs
    expect(screen.queryAllByPlaceholderText('address.roomName')).toHaveLength(0);

    await act(async () => {
      fireEvent.click(addRoomButton);
    });

    // After clicking: one room row should appear
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('address.roomName').length).toBeGreaterThan(0);
    });
  });

  it('does not render when isOpen=false', async () => {
    await act(async () => {
      render(<AddressForm {...defaultProps} isOpen={false} />);
    });

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });
});
