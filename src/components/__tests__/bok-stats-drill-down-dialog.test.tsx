/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BokStatsDrillDownDialog } from '@/components/dialogs/bok-stats-drill-down-dialog';
import type { BokResident } from '@/types';

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    open ? <div data-testid="dialog">{children}</div> : null
  ),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('@/lib/i18n', () => ({
  useLanguage: () => ({ t: (key: string) => (key === 'common.noData' ? 'Brak danych' : key) }),
}));

const mockResidents: BokResident[] = [
  {
    id: '1',
    firstName: 'Jan',
    lastName: 'Kowalski',
    fullName: 'Jan Kowalski',
    nationality: 'Polska',
    gender: 'M',
    address: 'ul. Kwiatowa 1',
    roomNumber: '101',
    hasPermit: true,
    hasPesel: true,
    status: 'active',
    checkInDate: '2024-01-01',
    checkOutDate: '2024-12-31',
  },
  {
    id: '2',
    firstName: 'Anna',
    lastName: 'Nowak',
    fullName: 'Anna Nowak',
    nationality: 'Polska',
    gender: 'K',
    address: 'ul. Leśna 2',
    roomNumber: '202',
    hasPermit: false,
    hasPesel: true,
    status: 'active',
    checkInDate: '2024-02-01',
    checkOutDate: '2024-11-30',
  },
];

function setup(props: Partial<React.ComponentProps<typeof BokStatsDrillDownDialog>> = {}) {
  const defaultProps = {
    isOpen: true,
    onOpenChange: jest.fn(),
    title: 'Statystyki BOK',
    yesLabel: 'Tak',
    noLabel: 'Nie',
    yesList: [] as BokResident[],
    noList: [] as BokResident[],
  };
  return render(<BokStatsDrillDownDialog {...defaultProps} {...props} />);
}

describe('BokStatsDrillDownDialog', () => {
  it('does not render when closed', () => {
    setup({ isOpen: false });
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders title and labels when open', () => {
    setup({ isOpen: true, yesList: mockResidents, noList: mockResidents });
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Statystyki BOK');
    expect(screen.getByText('Tak (2)')).toBeInTheDocument();
    expect(screen.getByText('Nie (2)')).toBeInTheDocument();
  });

  it('shows noData message for empty yes list', () => {
    setup({ yesList: [], noList: mockResidents });
    expect(screen.getByText('Brak danych')).toBeInTheDocument();
  });

  it('shows noData message for empty no list', () => {
    setup({ yesList: mockResidents, noList: [] });
    const noDataTexts = screen.getAllByText('Brak danych');
    expect(noDataTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders resident names in yes list', () => {
    setup({ yesList: mockResidents, noList: [] });
    expect(screen.getByText('Kowalski Jan')).toBeInTheDocument();
    expect(screen.getByText('Nowak Anna')).toBeInTheDocument();
  });

  it('renders resident names in no list', () => {
    setup({ yesList: [], noList: mockResidents });
    expect(screen.getByText('Kowalski Jan')).toBeInTheDocument();
    expect(screen.getByText('Nowak Anna')).toBeInTheDocument();
  });

  it('renders address and room when present', () => {
    setup({ yesList: mockResidents.slice(0, 1), noList: [] });
    expect(screen.getByText(/ul\. Kwiatowa 1/)).toBeInTheDocument();
    expect(screen.getByText(/101/)).toBeInTheDocument();
  });

  it('does not render address line when both address and room are missing', () => {
    const residentWithoutAddress: BokResident = {
      ...mockResidents[0],
      address: '',
      roomNumber: '',
    };
    setup({ yesList: [residentWithoutAddress], noList: [] });
    expect(screen.queryByText(/ul\. Kwiatowa 1/)).not.toBeInTheDocument();
  });
});
