/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OdbiorDetailDialog from '../odbior-detail-dialog';
import type { SessionData, OdbiorZgloszenie } from '@/types';

jest.mock('@/components/odbior-zakwaterowanie-dialog', () => ({
  OdbiorZakwaterowanieDialog: () => null,
}));

jest.mock('@/components/add-candidate-dialog', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value }: any) => (
    <div data-testid="tabs" data-value={value}>
      {React.Children.toArray(children).filter((c: any) => {
        if (c.type?.displayName === 'TabsContent' || c.props?.value !== undefined) {
          return c.props?.value === value;
        }
        return true;
      })}
    </div>
  ),
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <button type="button">{children}</button>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockUserAdmin: SessionData = {
  isLoggedIn: true,
  uid: 'user-1',
  name: 'Test User',
  isAdmin: true,
  isDriver: false,
  isRekrutacja: true,
  isBok: false,
};

const mockUserDriver: SessionData = {
  isLoggedIn: true,
  uid: 'driver-1',
  name: 'Driver',
  isAdmin: false,
  isDriver: true,
  isRekrutacja: false,
  isBok: false,
};

const makeZgloszenie = (overrides: Partial<OdbiorZgloszenie> = {}): OdbiorZgloszenie => ({
  id: 'zgl-1',
  dataZgloszenia: '2024-04-28',
  numerTelefonu: '123456789',
  skad: 'autobusowa',
  komentarzSkad: '',
  iloscOsob: 2,
  komentarz: 'Test',
  zdjeciaUrls: '',
  rekruterId: 'user-1',
  rekruterNazwa: 'Test User',
  status: 'Nieprzyjęte',
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
  ...overrides,
});

describe('OdbiorDetailDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToast.mockClear();
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    ) as jest.Mock;
  });

  const renderDialog = (props?: { zgloszenie?: OdbiorZgloszenie; currentUser?: SessionData }) => {
    const z = props?.zgloszenie ?? makeZgloszenie();
    const onStatusChange = jest.fn();
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <OdbiorDetailDialog
        open
        onOpenChange={onOpenChange}
        zgloszenie={z}
        allZgloszenia={[z]}
        currentUser={props?.currentUser ?? mockUserAdmin}
        onStatusChange={onStatusChange}
      />
    );
    return { rerender, onStatusChange, onOpenChange };
  };

  it('renders dialog title when open', () => {
    renderDialog();
    expect(screen.getByText('Szczegóły i akcje zgłoszenia odbioru')).toBeInTheDocument();
  });

  describe('Nieprzyjęte', () => {
    it('shows Przyjmij button and transitions to W trakcie on click', async () => {
      renderDialog();

      fireEvent.click(screen.getByRole('button', { name: /Przyjmij/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/odbior/zgloszenie/zgl-1',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('"action":"przyjmij"'),
          })
        );
      });
    });

    it('shows edit form, modifies fields, and saves updates', async () => {
      renderDialog();

      fireEvent.click(screen.getByRole('button', { name: /Edytuj dane/i }));

      const phoneInput = screen.getByDisplayValue('123456789');
      fireEvent.change(phoneInput, { target: { value: '987654321' } });

      fireEvent.click(screen.getByRole('button', { name: /Zapisz/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/odbior/zgloszenie/zgl-1',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('"action":"update"'),
          })
        );
      });
    });
  });

  describe('W trakcie', () => {
    it('displays person list with correct count', () => {
      const z = makeZgloszenie({
        status: 'W trakcie',
        osoby: JSON.stringify([{ imie: 'Jan', nazwisko: 'Kowalski', paszport: 'AB123' }]),
      });
      renderDialog({ zgloszenie: z });

      expect(screen.getByText(/Jan Kowalski/)).toBeInTheDocument();
      expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
    });

    it('opens AddPersonDialog and adds a person', async () => {
      const z = makeZgloszenie({
        status: 'W trakcie',
        osoby: JSON.stringify([{ imie: 'Jan', nazwisko: 'Kowalski', paszport: 'AB123' }]),
      });
      renderDialog({ zgloszenie: z });

      fireEvent.click(screen.getByRole('button', { name: /Dodaj osobę/i }));

      await waitFor(() => {
        expect(screen.getByText(/Imię/i)).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'Anna' } });
      fireEvent.change(inputs[1], { target: { value: 'Nowak' } });

      const submitButtons = screen.getAllByRole('button', { name: /^Dodaj osobę$/i });
      fireEvent.click(submitButtons[submitButtons.length - 1]);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/odbior/zgloszenie/zgl-1',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('"action":"update"'),
          })
        );
      });
    });

    it('prevents adding person beyond max count', async () => {
      const z = makeZgloszenie({
        status: 'W trakcie',
        iloscOsob: 1,
        osoby: JSON.stringify([{ imie: 'Jan', nazwisko: 'Kowalski', paszport: 'AB123' }]),
      });
      renderDialog({ zgloszenie: z });

      fireEvent.click(screen.getByRole('button', { name: /Dodaj osobę/i }));

      await waitFor(() => {
        expect(screen.getByText(/Imię/i)).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'Anna' } });
      fireEvent.change(inputs[1], { target: { value: 'Nowak' } });

      const submitButtons2 = screen.getAllByRole('button', { name: /^Dodaj osobę$/i });
      fireEvent.click(submitButtons2[submitButtons2.length - 1]);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ description: expect.stringContaining('Nie można dodać') })
        );
      });
    });

    it('Odrzuć transitions status back to Nieprzyjęte', async () => {
      const z = makeZgloszenie({ status: 'W trakcie' });
      renderDialog({ zgloszenie: z });

      fireEvent.click(screen.getByRole('button', { name: /Odrzuć/i }));

      await waitFor(() => {
          expect(screen.getByText(/Jesteś pewny/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Tak/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/odbior/zgloszenie/zgl-1',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('"action":"odrzuc"'),
          })
        );
      });
    });

    it('Zakończ odbiór is disabled when no persons', async () => {
      const z = makeZgloszenie({ status: 'W trakcie', osoby: '' });
      renderDialog({ zgloszenie: z });

      const finishBtn = screen.getByRole('button', { name: /Zakończ odbiór/i });
      expect(finishBtn).toBeDisabled();
    });

    it('Zakończ odbiór succeeds when persons present', async () => {
      const z = makeZgloszenie({
        status: 'W trakcie',
        iloscOsob: 1,
        osoby: JSON.stringify([{ imie: 'Jan', nazwisko: 'Kowalski', paszport: 'AB123', statusKrok: 'completed' }]),
      });
      renderDialog({ zgloszenie: z });

      const finishBtn = screen.getByRole('button', { name: /Zakończ odbiór/i });
      expect(finishBtn).not.toBeDisabled();
      fireEvent.click(finishBtn);

      await waitFor(() => {
          expect(screen.getByText(/Jesteś pewny/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Tak/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/odbior/zgloszenie/zgl-1',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('"action":"zakoncz"'),
          })
        );
      });
    });

    it('next-step selector calls update with selected step', async () => {
      const z = makeZgloszenie({
        status: 'W trakcie',
        osoby: JSON.stringify([{ imie: 'Jan', nazwisko: 'Kowalski', paszport: 'AB123' }]),
      });
      renderDialog({ zgloszenie: z });

      fireEvent.click(screen.getByRole('button', { name: /Zakwaterowanie/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/odbior/zgloszenie/zgl-1',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('wybranyKrok'),
          })
        );
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/odbior/zgloszenie/zgl-1',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('zakwaterowanie'),
          })
        );
      });
    });
  });

  describe('Zakończone', () => {
    it('shows completion date and person list', () => {
      const z = makeZgloszenie({
        status: 'Zakończone',
        dataZakonczenia: '2024-04-29',
        osoby: JSON.stringify([{ imie: 'Jan', nazwisko: 'Kowalski', paszport: 'AB123' }]),
      });
      renderDialog({ zgloszenie: z });

      expect(screen.getByText(/Zakończono:/i)).toBeInTheDocument();
      expect(screen.getByText(/2024-04-29/)).toBeInTheDocument();
      expect(screen.getByText(/Jan Kowalski/)).toBeInTheDocument();
    });

    it('displays change log for admin', () => {
      const z = makeZgloszenie({
        status: 'Zakończone',
        changeLog: JSON.stringify([
          { timestamp: '2024-04-29T10:00:00Z', userName: 'Admin', changes: 'Zmieniono status' },
        ]),
      });
      renderDialog({ zgloszenie: z });

      expect(screen.getByText(/Historia zmian/i)).toBeInTheDocument();
      expect(screen.getByText(/Admin/)).toBeInTheDocument();
      expect(screen.getByText(/Zmieniono status/)).toBeInTheDocument();
    });

    it('hides change log for non-admin', () => {
      const z = makeZgloszenie({
        status: 'Zakończone',
        changeLog: JSON.stringify([
          { timestamp: '2024-04-29T10:00:00Z', userName: 'Admin', changes: 'Zmieniono status' },
        ]),
      });
      renderDialog({ zgloszenie: z, currentUser: mockUserDriver });

      expect(screen.queryByText(/Historia zmian/i)).not.toBeInTheDocument();
    });

    it('shows Anuluj zakończenie for admin and calls correct action', async () => {
      const z = makeZgloszenie({ status: 'Zakończone' });
      renderDialog({ zgloszenie: z });

      fireEvent.click(screen.getByRole('button', { name: /Anuluj zakończenie/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/odbior/zgloszenie/zgl-1',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('"action":"anuluj_zakonczenie"'),
          })
        );
      });
    });

    it('hides Anuluj zakończenie for non-admin', () => {
      const z = makeZgloszenie({ status: 'Zakończone' });
      renderDialog({ zgloszenie: z, currentUser: mockUserDriver });

      expect(screen.queryByRole('button', { name: /Anuluj zakończenie/i })).not.toBeInTheDocument();
    });
  });
});
