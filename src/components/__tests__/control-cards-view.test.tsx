import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ControlCardsView from '../control-cards-view';
import { SessionData } from '@/types';
import { uploadControlCardPhotoAction } from '@/lib/actions';

// Mock framer-motion to avoid animation issues in jsdom
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// Mock the main layout context
jest.mock('@/components/main-layout', () => ({
  useMainLayout: () => ({
    settings: {
      addresses: [
        { id: 'addr1', name: 'Address 1', locality: 'Locality 1', coordinatorIds: ['uid1'], isActive: true, rooms: [] },
        { id: 'addr2', name: 'Address 2', locality: 'Locality 2', coordinatorIds: ['uid1'], isActive: true, rooms: [] }
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

// Mock useToast
const mockToast = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock fetch
const mockFetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    json: () => Promise.resolve([]),
  })
);
global.fetch = mockFetch as typeof fetch;

// ─── PIN Protection Tests ────────────────────────────────────────────────────

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

// ─── Meter Photo Upload Tests ────────────────────────────────────────────────

describe('ControlCardDialog - Meter Photo Upload', () => {
  const adminUser: SessionData = { uid: 'uid1', name: 'Admin', isAdmin: true, isLoggedIn: true, isDriver: false };

  beforeAll(() => {
    // Mock canvas API used by compressImage
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
      drawImage: jest.fn(),
    }) as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = jest.fn().mockReturnValue(
      'data:image/jpeg;base64,compressedmockdata'
    );

    // Mock window.Image — fires onload after src is assigned
    // @ts-expect-error replacing global Image with test stub
    global.Image = class {
      width = 100;
      height = 100;
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      private _src = '';
      get src() { return this._src; }
      set src(value: string) {
        this._src = value;
        Promise.resolve().then(() => this.onload?.());
      }
    };

    // Mock FileReader — returns a fake base64 data URL synchronously via microtask
    // @ts-expect-error replacing global FileReader with test stub
    global.FileReader = class {
      result: string | ArrayBuffer | null = null;
      onload: ((e: { target: { result: string | ArrayBuffer | null } }) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      readAsDataURL(_file: Blob) {
        this.result = 'data:image/jpeg;base64,originalimagedata';
        Promise.resolve().then(() => {
          this.onload?.({ target: { result: this.result } });
        });
      }
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Renders the view, waits for the locality to auto-open, clicks Address 1,
   *  and waits until the meter section label is visible in the dialog. */
  async function openMeterDialog() {
    render(<ControlCardsView currentUser={adminUser} />);
    const addressButton = await screen.findByText('Address 1');
    fireEvent.click(addressButton);
    await screen.findByText('Zdjęcia liczników (prąd, woda, itp.)');
  }

  /** Finds the gallery file input inside the meter PhotoUploadWidget. */
  function getMeterGalleryInput(): HTMLInputElement {
    const meterLabel = screen.getByText('Zdjęcia liczników (prąd, woda, itp.)');
    // meterLabel is a <label>; its parent is the flex header div of the widget
    const headerDiv = meterLabel.closest('div')!;
    return headerDiv.querySelector('input[type="file"][multiple]') as HTMLInputElement;
  }

  test('renders meter photo section with upload buttons when dialog is open', async () => {
    await openMeterDialog();

    expect(screen.getByText('Zdjęcia liczników (prąd, woda, itp.)')).toBeInTheDocument();
    // Each PhotoUploadWidget has Aparat + Galeria buttons; at least one set must be present
    expect(screen.getAllByText('Galeria').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aparat').length).toBeGreaterThan(0);
  });

  test('calls uploadControlCardPhotoAction with compressed image when a file is selected', async () => {
    (uploadControlCardPhotoAction as jest.Mock).mockResolvedValue({
      url: 'https://storage.example.com/meter-photo.jpg',
    });

    await openMeterDialog();
    const galleryInput = getMeterGalleryInput();

    const mockFile = new File(['imagedata'], 'meter.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(uploadControlCardPhotoAction).toHaveBeenCalledWith(
        'data:image/jpeg;base64,compressedmockdata',
        'meter.jpg',
        'image/jpeg'
      );
    });
  });

  test('displays the uploaded photo after a successful upload', async () => {
    (uploadControlCardPhotoAction as jest.Mock).mockResolvedValue({
      url: 'https://storage.example.com/meter-photo.jpg',
    });

    await openMeterDialog();
    const galleryInput = getMeterGalleryInput();

    const mockFile = new File(['imagedata'], 'meter.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      const img = screen.getByAltText('Zdjęcie 1');
      expect(img).toHaveAttribute('src', 'https://storage.example.com/meter-photo.jpg');
    });
  });

  test('does not add a photo when the server returns an upload error', async () => {
    (uploadControlCardPhotoAction as jest.Mock).mockResolvedValue({
      url: '',
      error: 'Zdjęcie jest za duże (maksymalnie 5MB)',
    });

    await openMeterDialog();
    const galleryInput = getMeterGalleryInput();

    const mockFile = new File(['imagedata'], 'big-photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(uploadControlCardPhotoAction).toHaveBeenCalled();
    });
    expect(screen.queryByAltText('Zdjęcie 1')).not.toBeInTheDocument();
  });

  test('shows an error toast when the upload fails', async () => {
    (uploadControlCardPhotoAction as jest.Mock).mockResolvedValue({
      url: '',
      error: 'Zdjęcie jest za duże (maksymalnie 5MB)',
    });

    await openMeterDialog();
    const galleryInput = getMeterGalleryInput();

    const mockFile = new File(['imagedata'], 'big-photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Błąd wgrywania',
          description: 'Zdjęcie jest za duże (maksymalnie 5MB)',
          variant: 'destructive',
        })
      );
    });
  });

  test('removes a meter photo when the delete button is clicked', async () => {
    (uploadControlCardPhotoAction as jest.Mock).mockResolvedValue({
      url: 'https://storage.example.com/meter-photo.jpg',
    });

    await openMeterDialog();
    const galleryInput = getMeterGalleryInput();

    // First upload a photo
    const mockFile = new File(['imagedata'], 'meter.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByAltText('Zdjęcie 1')).toBeInTheDocument();
    });

    // Click the delete button on the thumbnail
    fireEvent.click(screen.getByTitle('Usuń zdjęcie'));

    expect(screen.queryByAltText('Zdjęcie 1')).not.toBeInTheDocument();
  });
});
