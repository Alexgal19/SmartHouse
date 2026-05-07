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
const mockSettings = {
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
};

jest.mock('@/components/main-layout', () => ({
  useMainLayout: () => ({
    settings: mockSettings,
    rawSettings: mockSettings,
  })
}));

// Mock server actions
jest.mock('@/lib/actions', () => ({
  saveControlCardAction: jest.fn(),
  editControlCardAction: jest.fn(),
  uploadControlCardPhotoAction: jest.fn(),
  saveStartListAction: jest.fn(),
  setAddressNoMetersRequiredAction: jest.fn(),
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Fully populated Start-list for addr1 (so Kontrola tab is unlocked in tests)
const completeStartList = {
  addressId: 'addr1',
  addressName: 'Address 1',
  housingType: 'Kwatera',
  distanceToWork: '5 km',
  transport: ['Pieszo'],
  distanceToShop: '300 m',
  floorsCount: 0,
  floorInBuilding: 2,
  roomsCount: 3,
  kitchensCount: 1,
  bathroomsCount: 1,
  placesCount: 6,
  hasBalcony: true,
  standard: 'Normalny',
  heating: 'Centralne',
  heatingOther: '',
  kitchenPhotoUrls: ['https://storage.example.com/k.jpg'],
  bathroomPhotoUrls: ['https://storage.example.com/b.jpg'],
  roomsPhotoUrls: ['https://storage.example.com/r.jpg'],
  hallwayPhotoUrls: ['https://storage.example.com/h.jpg'],
  updatedAt: '2026-04-17T10:00:00.000Z',
  updatedBy: 'Admin',
  updatedById: 'uid1',
};

// Mock fetch — returns empty cards and a pre-filled Start-list for addr1
const mockFetch = jest.fn().mockImplementation((url: string) => {
  if (typeof url === 'string' && url.includes('/api/start-lists')) {
    return Promise.resolve({ json: () => Promise.resolve([completeStartList]) });
  }
  return Promise.resolve({ json: () => Promise.resolve([]) });
});
global.fetch = mockFetch as typeof fetch;

// ─── Access Tests ────────────────────────────────────────────────────────────

describe('ControlCardsView Access', () => {
  const adminUser: SessionData = { uid: 'uid1', name: 'Admin', isAdmin: true, isLoggedIn: true, isDriver: false, isRekrutacja: false };
  const coordinatorUser: SessionData = { uid: 'uid2', name: 'User', isAdmin: false, isLoggedIn: true, isDriver: false, isRekrutacja: false };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should show view for admin users without PIN lock', () => {
    render(<ControlCardsView currentUser={adminUser} />);
    expect(screen.queryByText(/Moduł Zablokowany/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Karty Kontroli/i)).toBeInTheDocument();
  });

  test('should show view for non-admin users without PIN lock', () => {
    render(<ControlCardsView currentUser={coordinatorUser} />);
    expect(screen.queryByText(/Moduł Zablokowany/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Karty Kontroli/i)).toBeInTheDocument();
  });
});

// ─── Meter Photo Upload Tests ────────────────────────────────────────────────

describe('ControlCardDialog - Meter Photo Upload', () => {
  const adminUser: SessionData = { uid: 'uid1', name: 'Admin', isAdmin: true, isLoggedIn: true, isDriver: false, isRekrutacja: false };

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

  test('displays photo immediately as data URL, then replaces with server URL after upload', async () => {
    (uploadControlCardPhotoAction as jest.Mock).mockResolvedValue({
      url: 'https://storage.example.com/meter-photo.jpg',
    });

    await openMeterDialog();
    const galleryInput = getMeterGalleryInput();

    const mockFile = new File(['imagedata'], 'meter.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [mockFile] } });

    // Photo appears immediately as data URL (offline-first)
    await waitFor(() => {
      expect(screen.getByAltText('Zdjęcie 1')).toBeInTheDocument();
    });

    // After background upload completes, src is replaced with server URL
    await waitFor(() => {
      const img = screen.getByAltText('Zdjęcie 1');
      expect(img).toHaveAttribute('src', 'https://storage.example.com/meter-photo.jpg');
    });
  });

  test('shows photo as pending (data URL) when server upload fails — no error toast', async () => {
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

    // Photo is shown immediately as data URL even when upload fails
    expect(screen.getByAltText('Zdjęcie 1')).toBeInTheDocument();
    // No destructive error toast for silent background upload failure
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'Błąd wgrywania' })
    );
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

    // Wait until background upload completes and delete button becomes available
    await waitFor(() => {
      expect(screen.getByTitle('Usuń zdjęcie')).toBeInTheDocument();
    });

    // Click the delete button on the thumbnail
    fireEvent.click(screen.getByTitle('Usuń zdjęcie'));

    expect(screen.queryByAltText('Zdjęcie 1')).not.toBeInTheDocument();
  });
});
