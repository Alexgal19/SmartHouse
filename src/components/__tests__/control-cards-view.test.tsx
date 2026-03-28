import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ControlCardsView from '../control-cards-view';
import { SessionData } from '@/types';

// Mock the main layout context
jest.mock('@/components/main-layout', () => ({
  useMainLayout: () => ({
    settings: {
      addresses: [
        { id: 'addr1', name: 'Address 1', locality: 'Locality 1', coordinatorIds: ['uid1'], isActive: true },
        { id: 'addr2', name: 'Address 2', locality: 'Locality 2', coordinatorIds: ['uid1'], isActive: true }
      ],
      coordinators: [],
      nationalities: [],
      departments: [],
      genders: [],
      localities: ['Locality 1', 'Locality 2'],
      paymentTypesNZ: [],
      statuses: [],
      bokRoles: [],
      bokReturnOptions: [],
      bokStatuses: []
    }
  })
}));

// Mock server actions
jest.mock('@/lib/actions', () => ({
  saveControlCardAction: jest.fn(),
  editControlCardAction: jest.fn(),
  uploadControlCardPhotoAction: jest.fn(),
}));

// Mock fetch
const mockFetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    json: () => Promise.resolve([]),
  })
);
global.fetch = mockFetch as any;

describe('ControlCardsView PIN Protection', () => {
  const adminUser: SessionData = { uid: 'uid1', name: 'Admin', isAdmin: true, isLoggedIn: true, isDriver: false };
  const coordinatorUser: SessionData = { uid: 'uid2', name: 'User', isAdmin: false, isLoggedIn: true, isDriver: false };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should bypass PIN lock for admin users', () => {
    render(<ControlCardsView currentUser={adminUser} />);
    expect(screen.queryByText(/Moduł Zablokowany/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Karty Kontroli/i)).toBeInTheDocument();
  });

  test('should show PIN lock for non-admin users', () => {
    render(<ControlCardsView currentUser={coordinatorUser} />);
    expect(screen.getByText(/Moduł Zablokowany/i)).toBeInTheDocument();
    expect(screen.queryByText(/Karty Kontroli/i)).not.toBeInTheDocument();
  });

  test('should unlock after entering correct PIN (2991)', async () => {
    render(<ControlCardsView currentUser={coordinatorUser} />);
    const input = screen.getByPlaceholderText(/Wprowadź kod PIN/i);
    const button = screen.getByText(/Odblokuj Dostęp/i);

    fireEvent.change(input, { target: { value: '2991' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.queryByText(/Moduł Zablokowany/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Karty Kontroli/i)).toBeInTheDocument();
    });
  });

  test('should show error and clear input on incorrect PIN', async () => {
    render(<ControlCardsView currentUser={coordinatorUser} />);
    const input = screen.getByPlaceholderText(/Wprowadź kod PIN/i);
    const button = screen.getByText(/Odblokuj Dostęp/i);

    fireEvent.change(input, { target: { value: 'wrong' } });
    fireEvent.click(button);

    expect(screen.getByText(/Nieprawidłowy kod PIN/i)).toBeInTheDocument();
    expect(input).toHaveValue('');
  });
});
