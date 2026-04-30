import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OdbiorView from '../odbior-view';
import type { SessionData, OdbiorZgloszenie } from '@/types';

// Mock the toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

describe('OdbiorView', () => {
  const mockUser: SessionData = {
    isLoggedIn: true,
    uid: 'user-1',
    name: 'Test User',
    isAdmin: true,
    isDriver: false,
    isRekrutacja: true,
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
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn((url) => {
      if (url === '/api/odbior/zgloszenia') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockZgloszenia),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as jest.Mock;
  });

  it('renders statistics correctly', async () => {
    render(<OdbiorView currentUser={mockUser} />);

    // Wait for the data to load
    await screen.findByText('W trakcie');

    expect(screen.getByText('Dostarczone')).toBeInTheDocument();
    
    // Check for stats value '1' in the amber card
    const amberStats = screen.getByText('1', { selector: 'p.text-amber-900' });
    expect(amberStats).toBeInTheDocument();
  });

  it('renders the list of submissions', async () => {
    render(<OdbiorView currentUser={mockUser} />);

    await screen.findByText('W trakcie');

    expect(screen.getByText('Stacja autobusowa')).toBeInTheDocument();
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
});
