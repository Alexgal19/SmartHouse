import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ZapotrzebowaniaView from '@/components/views/zapotrzebowania-view';
import type { SessionData, CandidateDemand } from '@/types';

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/lib/actions', () => ({
  getCandidateDemandsAction: jest.fn(),
  acknowledgeCandidateDemandAction: jest.fn(),
  deliverCandidateDemandAction: jest.fn(),
  deleteCandidateDemandAction: jest.fn(),
}));

import {
  getCandidateDemandsAction,
  acknowledgeCandidateDemandAction,
  deliverCandidateDemandAction,
  deleteCandidateDemandAction,
} from '@/lib/actions';

const mockGetDemands = getCandidateDemandsAction as jest.Mock;
const mockAckDemand = acknowledgeCandidateDemandAction as jest.Mock;
const mockDeliverDemand = deliverCandidateDemandAction as jest.Mock;
const mockDeleteDemand = deleteCandidateDemandAction as jest.Mock;

const mockAdmin: SessionData = {
  isLoggedIn: true,
  uid: 'user-1',
  name: 'Admin',
  isAdmin: true,
  isDriver: false,
  isRekrutacja: true,
  isBok: false,
};

const mockDriver: SessionData = {
  isLoggedIn: true,
  uid: 'user-2',
  name: 'Kierowca',
  isAdmin: false,
  isDriver: true,
  isRekrutacja: false,
  isBok: false,
};

const mockRekrutacja: SessionData = {
  isLoggedIn: true,
  uid: 'user-3',
  name: 'Rekruter',
  isAdmin: false,
  isDriver: false,
  isRekrutacja: true,
  isBok: false,
};

const makeDemand = (overrides: Partial<CandidateDemand> = {}): CandidateDemand => ({
  id: 'dem-1',
  candidateId: 'cand-1',
  candidateFirstName: 'Jan',
  candidateLastName: 'Kowalski',
  requestedBy: 'Admin',
  requestedAt: '2026-05-24T10:00:00.000Z',
  status: 'pending',
  retryCount: 0,
  estimatedDeliveryTime: '14:00',
  pickupAddress: 'JUGOWICE ( HOTEL A )',
  roomNumber: '101',
  ...overrides,
});

describe('ZapotrzebowaniaView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading skeleton initially', () => {
    mockGetDemands.mockResolvedValue([]);
    render(<ZapotrzebowaniaView currentUser={mockAdmin} activeView="zapotrzebowania" />);
    expect(screen.getByTestId('zapotrzebowania-skeleton')).toBeInTheDocument();
  });

  it('shows empty state when there are no demands', async () => {
    mockGetDemands.mockResolvedValue([]);
    render(<ZapotrzebowaniaView currentUser={mockAdmin} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByText('Brak aktywnych zapotrzebowań.')).toBeInTheDocument();
    });
  });

  it('admin sees all action buttons on pending demand', async () => {
    mockGetDemands.mockResolvedValue([makeDemand()]);
    render(<ZapotrzebowaniaView currentUser={mockAdmin} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Akceptuj/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Usuń/i })).toBeInTheDocument();
    });
  });

  it('admin sees Dostarczone button on acknowledged demand', async () => {
    mockGetDemands.mockResolvedValue([makeDemand({ status: 'acknowledged' })]);
    render(<ZapotrzebowaniaView currentUser={mockAdmin} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Dostarczone/i })).toBeInTheDocument();
    });
  });

  it('admin can delete a demand', async () => {
    mockGetDemands.mockResolvedValue([makeDemand()]);
    mockDeleteDemand.mockResolvedValue({ success: true });
    render(<ZapotrzebowaniaView currentUser={mockAdmin} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Usuń/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Usuń/i }));
    await waitFor(() => {
      expect(mockDeleteDemand).toHaveBeenCalledWith('dem-1', 'user-1');
    });
  });

  it('renders pending demand with details', async () => {
    mockGetDemands.mockResolvedValue([makeDemand()]);
    render(<ZapotrzebowaniaView currentUser={mockAdmin} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByText(/Kowalski/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Jan/)).toBeInTheDocument();
    expect(screen.getByText(/JUGOWICE/)).toBeInTheDocument();
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('shows "Akceptuj" button for admin on pending demand', async () => {
    mockGetDemands.mockResolvedValue([makeDemand()]);
    render(<ZapotrzebowaniaView currentUser={mockAdmin} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Akceptuj/i })).toBeInTheDocument();
    });
  });

  it('shows "Akceptuj" button for driver on pending demand', async () => {
    mockGetDemands.mockResolvedValue([makeDemand()]);
    render(<ZapotrzebowaniaView currentUser={mockDriver} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Akceptuj/i })).toBeInTheDocument();
    });
  });

  it('hides "Akceptuj" button for rekrutacja on pending demand', async () => {
    mockGetDemands.mockResolvedValue([makeDemand()]);
    render(<ZapotrzebowaniaView currentUser={mockRekrutacja} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Akceptuj/i })).not.toBeInTheDocument();
    });
  });

  it('clicking "Akceptuj" calls acknowledgeCandidateDemandAction and updates status', async () => {
    mockGetDemands.mockResolvedValue([makeDemand()]);
    mockAckDemand.mockResolvedValue({ success: true });
    render(<ZapotrzebowaniaView currentUser={mockDriver} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Akceptuj/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Akceptuj/i }));
    await waitFor(() => {
      expect(mockAckDemand).toHaveBeenCalledWith('dem-1', 'Kierowca');
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sukces' }));
  });

  it('shows "Dostarczone" button for driver on acknowledged demand', async () => {
    mockGetDemands.mockResolvedValue([makeDemand({ status: 'acknowledged' })]);
    render(<ZapotrzebowaniaView currentUser={mockDriver} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Dostarczone/i })).toBeInTheDocument();
    });
  });

  it('hides "Dostarczone" button for non-driver', async () => {
    mockGetDemands.mockResolvedValue([makeDemand({ status: 'acknowledged' })]);
    render(<ZapotrzebowaniaView currentUser={mockAdmin} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Dostarczone/i })).not.toBeInTheDocument();
    });
  });

  it('clicking "Dostarczone" calls deliverCandidateDemandAction', async () => {
    mockGetDemands.mockResolvedValue([makeDemand({ status: 'acknowledged' })]);
    mockDeliverDemand.mockResolvedValue({ success: true });
    render(<ZapotrzebowaniaView currentUser={mockDriver} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Dostarczone/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Dostarczone/i }));
    await waitFor(() => {
      expect(mockDeliverDemand).toHaveBeenCalledWith('dem-1', 'Kierowca');
    });
  });

  it('shows "Usuń" button for rekrutacja', async () => {
    mockGetDemands.mockResolvedValue([makeDemand()]);
    render(<ZapotrzebowaniaView currentUser={mockRekrutacja} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Usuń/i })).toBeInTheDocument();
    });
  });

  it('hides "Usuń" button for non-rekrutacja', async () => {
    mockGetDemands.mockResolvedValue([makeDemand()]);
    render(<ZapotrzebowaniaView currentUser={mockDriver} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Usuń/i })).not.toBeInTheDocument();
    });
  });

  it('clicking "Usuń" calls deleteCandidateDemandAction', async () => {
    mockGetDemands.mockResolvedValue([makeDemand()]);
    mockDeleteDemand.mockResolvedValue({ success: true });
    render(<ZapotrzebowaniaView currentUser={mockRekrutacja} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Usuń/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Usuń/i }));
    await waitFor(() => {
      expect(mockDeleteDemand).toHaveBeenCalledWith('dem-1', 'user-3');
    });
  });

  it('toggles history section open/close', async () => {
    mockGetDemands.mockResolvedValue([
      makeDemand({ status: 'pending' }),
      makeDemand({ id: 'dem-2', status: 'delivered', candidateFirstName: 'Anna', candidateLastName: 'Nowak' }),
    ]);
    render(<ZapotrzebowaniaView currentUser={mockAdmin} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByText(/Kowalski/)).toBeInTheDocument();
    });
    // History initially closed
    expect(screen.queryByText(/Nowak/)).not.toBeInTheDocument();
    // Open history
    fireEvent.click(screen.getByRole('button', { name: /Historia/i }));
    await waitFor(() => {
      expect(screen.getByText(/Nowak/)).toBeInTheDocument();
    });
  });

  it('shows luggage info when hasLuggage is true', async () => {
    mockGetDemands.mockResolvedValue([makeDemand({ hasLuggage: true })]);
    render(<ZapotrzebowaniaView currentUser={mockAdmin} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByText(/Z bagażem\?/)).toBeInTheDocument();
      expect(screen.getByText(/Tak/)).toBeInTheDocument();
    });
  });

  it('shows luggage info when hasLuggage is false', async () => {
    mockGetDemands.mockResolvedValue([makeDemand({ hasLuggage: false })]);
    render(<ZapotrzebowaniaView currentUser={mockAdmin} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByText(/Z bagażem\?/)).toBeInTheDocument();
      expect(screen.getByText(/Nie/)).toBeInTheDocument();
    });
  });

  it('dispatches demands-updated event after accepting demand', async () => {
    mockGetDemands.mockResolvedValue([makeDemand()]);
    mockAckDemand.mockResolvedValue({ success: true });
    const eventSpy = jest.spyOn(window, 'dispatchEvent');
    render(<ZapotrzebowaniaView currentUser={mockDriver} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Akceptuj/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Akceptuj/i }));
    await waitFor(() => {
      expect(mockAckDemand).toHaveBeenCalledWith('dem-1', 'Kierowca');
    });
    expect(eventSpy).toHaveBeenCalledWith(expect.any(Event));
    const dispatchedEvent = eventSpy.mock.calls.find((call) => (call[0] as Event).type === 'demands-updated');
    expect(dispatchedEvent).toBeDefined();
    eventSpy.mockRestore();
  });

  it('dispatches demands-updated event after delivering demand', async () => {
    mockGetDemands.mockResolvedValue([makeDemand({ status: 'acknowledged' })]);
    mockDeliverDemand.mockResolvedValue({ success: true });
    const eventSpy = jest.spyOn(window, 'dispatchEvent');
    render(<ZapotrzebowaniaView currentUser={mockDriver} activeView="zapotrzebowania" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Dostarczone/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Dostarczone/i }));
    await waitFor(() => {
      expect(mockDeliverDemand).toHaveBeenCalledWith('dem-1', 'Kierowca');
    });
    expect(eventSpy).toHaveBeenCalledWith(expect.any(Event));
    const dispatchedEvent = eventSpy.mock.calls.find((call) => (call[0] as Event).type === 'demands-updated');
    expect(dispatchedEvent).toBeDefined();
    eventSpy.mockRestore();
  });
});
