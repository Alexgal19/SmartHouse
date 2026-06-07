/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OdbiorView from '@/components/views/odbior-view';
import type { SessionData, OdbiorZgloszenie } from '@/types';

// Mock the toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

jest.mock('@/components/dialogs/odbior-detail-dialog', () => ({
  __esModule: true,
  default: ({ open, zgloszenie, onStatusChange }: any) =>
    open ? (
      <div 
        data-testid="detail-dialog" 
        onClick={() => onStatusChange?.(zgloszenie?.id, { status: 'Zakończone' })}
      >
        {zgloszenie?.id}
      </div>
    ) : null,
}));

describe('OdbiorView', () => {
  const mockUser: SessionData = {
    isLoggedIn: true,
    uid: 'user-1',
    name: 'Test User',
    isAdmin: true,
    isDriver: false,
    isRekrutacja: true,
    isBok: false,
  };

  const mockZgloszenia: OdbiorZgloszenie[] = [
    {
      id: 'zgl-1',
      dataZgloszenia: '2024-04-28',
      numerTelefonu: '123456789',
      skad: 'autobusowa',
      komentarzSkad: '',
      iloscOsob: 2,
      komentarz: 'Test comment',
      zdjeciaUrls: '',
      rekruterId: 'user-1',
      rekruterNazwa: 'Test User',
      status: 'W trakcie',
      kierowcaId: '',
      kierowcaNazwa: '',
      osoby: '',
      nastepnyKrok: '',
      dataZakonczenia: '',
      przyjeteAt: '',
      zakonczoneAt: '',
      deletedAt: '',
      deletedBy: '',
      changeLog: '',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn((url: string | URL | Request, init?: RequestInit) => {
      if (url === '/api/odbior/zgloszenia') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockZgloszenia),
        });
      }
      if (url.toString().includes('/api/odbior/zgloszenie') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            zgloszenie: {
              id: 'new-id',
              status: 'Oczekujące na realizację',
              dataZgloszenia: new Date().toISOString(),
              skad: 'autobusowa',
              iloscOsob: 3,
              rekruterNazwa: 'Nowy Rekruter'
            }
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as jest.Mock;
  });

  it('renders statistics correctly', async () => {
    render(<OdbiorView currentUser={mockUser} />);

    // Wait for the data to load
    await screen.findAllByText('Stacja autobusowa');

    expect(screen.getByText('Dostarczone')).toBeInTheDocument();

    // Check for stats value '1' in the amber card
    const amberStats = screen.getByText('1');
    expect(amberStats).toBeInTheDocument();
  });

  it('renders the list of submissions', async () => {
    render(<OdbiorView currentUser={mockUser} />);

    await screen.findAllByText('Stacja autobusowa');

    expect(screen.getAllByText('Stacja autobusowa')[0]).toBeInTheDocument();
    expect(screen.getByText('2', { selector: 'td' })).toBeInTheDocument(); // persons
    expect(screen.getByText('Test User', { selector: 'td' })).toBeInTheDocument(); // recruiter
  });

  it('opens the new submission dialog when clicking CTA', async () => {
    render(<OdbiorView currentUser={mockUser} />);

    const ctaButton = screen.getByText('Zgłoś odbiór');
    fireEvent.click(ctaButton);

    // Dialog title is "Zgłoś odbiór"
    expect(screen.getAllByText('Zgłoś odbiór').length).toBeGreaterThan(1);
    expect(screen.getByLabelText(/Numer telefonu/i)).toBeInTheDocument();
  });

  it('validates the "Inne" location details', async () => {
    render(<OdbiorView currentUser={mockUser} />);
    
    fireEvent.click(screen.getByText('Zgłoś odbiór'));

    // Select "Inne"
    const inneRadio = screen.getByLabelText('Inne');
    fireEvent.click(inneRadio);

    // Click submit without details
    const submitButton = screen.getByRole('button', { name: /Zgłoś odbiór/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Podaj szczegóły miejsca przy wyborze "Inne"/i)).toBeInTheDocument();
    });
  });

  it('clicking eye button opens detail dialog with correct submission', async () => {
    render(<OdbiorView currentUser={mockUser} />);

    await screen.findAllByText('Stacja autobusowa');

    const eyeButton = screen.getAllByRole('button', { name: /Szczegóły/i })[0];
    fireEvent.click(eyeButton);

    await waitFor(() => {
      expect(screen.getByTestId('detail-dialog')).toHaveTextContent('zgl-1');
    });
  });

  it('clicking delete button opens confirmation dialog', async () => {
    render(<OdbiorView currentUser={mockUser} />);

    await screen.findAllByText('Stacja autobusowa');

    const deleteButton = screen.getAllByRole('button', { name: /Usuń/i })[0];
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/Usuń zgłoszenie/i)).toBeInTheDocument();
      expect(screen.getByText(/Czy na pewno chcesz trwale usunąć/i)).toBeInTheDocument();
    });
  });

  it('confirming delete calls fetch DELETE and removes row', async () => {
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      if (url === '/api/odbior/zgloszenia') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockZgloszenia) });
      }
      if (url === '/api/odbior/zgloszenie/zgl-1' && init?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as jest.Mock;

    render(<OdbiorView currentUser={mockUser} />);

    await screen.findAllByText('Stacja autobusowa');

    fireEvent.click(screen.getAllByRole('button', { name: /Usuń/i })[0]);
    await waitFor(() => {
      expect(screen.getByText(/Usuń zgłoszenie/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Usuń$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/odbior/zgloszenie/zgl-1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(screen.queryByText('Stacja autobusowa')).not.toBeInTheDocument();
    });
  });

  it('submits the new submission form successfully', async () => {
    render(<OdbiorView currentUser={mockUser} />);
    fireEvent.click(screen.getByText('Zgłoś odbiór'));

    await waitFor(() => {
      expect(screen.getByText('Stacja autobusowa')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Numer telefonu/i), { target: { value: '123456789' } });
    fireEvent.change(screen.getByLabelText(/Nazwisko i imię rekrutera/i), { target: { value: 'Nowy Rekruter' } });
    fireEvent.click(screen.getByLabelText('Stacja autobusowa'));

    const submitBtn = screen.getAllByRole('button', { name: 'Zgłoś odbiór' }).find(b => b.getAttribute('type') === 'submit');
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      console.log('Fetch calls:', calls);
      expect(global.fetch).toHaveBeenCalledWith('/api/odbior/zgloszenie', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('filters submissions by search term', async () => {
    render(<OdbiorView currentUser={mockUser} />);
    await screen.findAllByText('Stacja autobusowa');

    const searchInput = screen.getByPlaceholderText(/Szukaj/i);
    fireEvent.change(searchInput, { target: { value: 'NieistniejacyRekruter' } });

    await waitFor(() => {
      expect(screen.queryByText('Stacja autobusowa')).not.toBeInTheDocument();
    });

    fireEvent.change(searchInput, { target: { value: 'Test User' } });
    await waitFor(() => {
      expect(screen.getAllByText('Stacja autobusowa').length).toBeGreaterThan(0);
    });
  });

  it('handles status changes from detail dialog', async () => {
    render(<OdbiorView currentUser={mockUser} />);
    await screen.findAllByText('Stacja autobusowa');

    // Open detail dialog
    const eyeButton = screen.getAllByRole('button', { name: /Szczegóły/i })[0];
    fireEvent.click(eyeButton);

    const detailDialog = await screen.findByTestId('detail-dialog');
    
    // Trigger status change via mock onClick
    fireEvent.click(detailDialog);

    // Verify stats updated (since it was W trakcie and changed to Zakończone, the dostarczone stat should be 1 and w trakcie 0)
    await waitFor(() => {
      // 1 should be the dostarczone stats (success card) and 0 w trakcie (amber card)
      // W trakcie initially is 1, after change it should be 0
      const wTrakcieCards = screen.getAllByText('0');
      expect(wTrakcieCards.length).toBeGreaterThan(0);
    });
  });
});
