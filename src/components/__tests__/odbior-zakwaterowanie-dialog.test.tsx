import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OdbiorZakwaterowanieDialog } from '../odbior-zakwaterowanie-dialog';
import type { SessionData } from '@/types';
import { addOdbiorZakwaterowanieAction } from '@/lib/actions';

// Mock the dependencies
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockMainLayout = {
  settings: {
    addresses: [
      {
        id: 'addr-1',
        name: 'Chopina 11a',
        locality: 'mieszkania Barlinek',
        isActive: true,
        rooms: [{ id: 'room-1', name: '101', capacity: 2, isActive: true, isLocked: false }],
      },
    ],
    nationalities: ['Ukraina', 'Kolumbia'],
    genders: ['Mężczyzna', 'Kobieta'],
  },
  allEmployees: [],
  allNonEmployees: [],
  allBokResidents: [],
  addRawOdbiorEntry: jest.fn(),
  patchRawOdbiorEntry: jest.fn(),
  addRawBokResident: jest.fn(),
  patchRawBokResident: jest.fn(),
};

jest.mock('@/components/main-layout', () => ({
  useMainLayout: () => mockMainLayout,
}));

jest.mock('@/lib/actions', () => ({
  addOdbiorZakwaterowanieAction: jest.fn().mockResolvedValue({ success: true, entry: { id: 'new-1' }, bokResident: { id: 'bok-1' } }),
  updateOdbiorZakwaterowanieAction: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/ai/flows/extract-passport-data-flow', () => ({
  extractPassportData: jest.fn().mockResolvedValue({
    firstName: 'Juan',
    lastName: 'Carlos',
    nationality: 'Kolumbia',
    passportNumber: 'EP123456',
  }),
}));

// Mock react-webcam
jest.mock('react-webcam', () => {
    const Webcam = React.forwardRef((_props: Record<string, unknown>, ref: React.ForwardedRef<{ getScreenshot: () => string }>) => {
        React.useImperativeHandle(ref, () => ({
            getScreenshot: () => 'data:image/jpeg;base64,mock',
        }));
        return <div data-testid="webcam" />;
    });
    Webcam.displayName = 'Webcam';
    return Webcam;
});

describe('OdbiorZakwaterowanieDialog', () => {
  const mockUser: SessionData = {
    isLoggedIn: true,
    uid: 'user-1',
    name: 'Test Admin',
    isAdmin: true,
    isDriver: false,
    isRekrutacja: false,
  };

  const baseProps = {
    isOpen: true,
    onOpenChange: jest.fn(),
    currentUser: mockUser,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes the wizard successfully', async () => {
    render(<OdbiorZakwaterowanieDialog {...baseProps} />);

    // Step 0: Osoba
    fireEvent.change(screen.getByPlaceholderText('Kowalski'), { target: { value: 'Carlos' } });
    fireEvent.change(screen.getByPlaceholderText('Jan'), { target: { value: 'Juan' } });
    
    const nationalityTrigger = screen.getByRole('combobox');
    fireEvent.click(nationalityTrigger);
    
    const kolumbiaOption = await screen.findByText('Kolumbia');
    fireEvent.click(kolumbiaOption);

    const nextButton = screen.getByRole('button', { name: /Dalej/i });
    fireEvent.click(nextButton);

    // Step 1: Lokalizacja
    await screen.findByText('Wybierz adres i pokój');
    const addressButton = screen.getByText('Chopina 11a');
    fireEvent.click(addressButton);
    
    const roomButton = await screen.findByText('101');
    fireEvent.click(roomButton);
    
    fireEvent.click(screen.getByRole('button', { name: /Dalej/i }));

    // Step 2: Szczegóły
    await screen.findByText('Uzupełnij pozostałe dane');
    const genderButton = screen.getByText('Mężczyzna');
    fireEvent.click(genderButton);
    
    fireEvent.click(screen.getByRole('button', { name: /Dalej/i }));

    // Step 3: Podsumowanie
    await screen.findByText('Sprawdź dane przed zapisem');
    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText('Juan')).toBeInTheDocument();
    expect(screen.getByText('Chopina 11a')).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /Zatwierdź/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(addOdbiorZakwaterowanieAction).toHaveBeenCalled();
      expect(baseProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('handles OCR scanning', async () => {
    render(<OdbiorZakwaterowanieDialog {...baseProps} />);

    const scanButton = screen.getByRole('button', { name: /Skanuj paszport/i });
    fireEvent.click(scanButton);

    const captureButton = await screen.findByRole('button', { name: /Zrób zdjęcie/i });
    fireEvent.click(captureButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Carlos')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Juan')).toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sukces' }));
    });
  });
});
