import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddBokResidentForm } from '../add-bok-resident-form';
import type { Settings, SessionData, BokResident } from '@/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/ai/flows/extract-passport-data-flow', () => ({
    extractPassportData: jest.fn(),
}));

jest.mock('react-webcam', () => {
    const Webcam = React.forwardRef((_props: unknown, _ref: unknown) => <div data-testid="webcam" />);
    Webcam.displayName = 'Webcam';
    return Webcam;
});

const mockHandleDismissBokResident = jest.fn().mockResolvedValue(undefined);

jest.mock('../main-layout', () => ({
    useMainLayout: () => ({
        handleDismissBokResident: mockHandleDismissBokResident,
    }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockSettings: Settings = {
    id: 'global-settings',
    coordinators: [
        { uid: 'coord-1', name: 'Jan Kowalski', isAdmin: false, departments: ['IT'] },
    ],
    localities: ['Barlinek', 'Bielawa'],
    departments: ['IT'],
    nationalities: ['Polska', 'Ukraina'],
    genders: ['Mężczyzna', 'Kobieta'],
    addresses: [
        {
            id: 'addr-1',
            locality: 'Barlinek',
            name: 'Chopina 11a',
            coordinatorIds: ['coord-1'],
            rooms: [{ id: 'room-1', name: '101', capacity: 2, isActive: true }],
            isActive: true,
        },
    ],
    paymentTypesNZ: [],
    statuses: [],
    bokRoles: ['Kierowca', 'Logistyk'],
    bokReturnOptions: ['Powrót', 'Rezygnacja'],
    bokStatuses: ['active', 'Wymeldowany'],
};

const mockCurrentUser: SessionData = {
    isLoggedIn: true,
    uid: 'coord-1',
    name: 'Jan Kowalski',
    isAdmin: true,
    isDriver: false,
};

const baseProps = {
    isOpen: true,
    onOpenChange: jest.fn(),
    onSave: jest.fn().mockResolvedValue(undefined),
    settings: mockSettings,
    currentUser: mockCurrentUser,
};

const existingResident: BokResident = {
    id: 'bok-1',
    firstName: 'Viktor',
    lastName: 'Shevchenko',
    fullName: 'Shevchenko Viktor',
    role: 'Kierowca',
    coordinatorId: 'coord-1',
    nationality: 'Polska',
    address: 'Chopina 11a',
    roomNumber: '101',
    zaklad: 'IT',
    gender: 'Mężczyzna',
    checkInDate: '2024-01-01',
    checkOutDate: null,
    returnStatus: '',
    status: 'active',
    comments: '',
    sendDate: null,
    dismissDate: null,
};

const residentWithDismissDate: BokResident = {
    ...existingResident,
    dismissDate: '2026-03-01',
};

// ─── AddBokResidentForm — Dialog rendering ────────────────────────────────────

describe('AddBokResidentForm — dialog rendering', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders "Dodaj Mieszkańca BOK" title for new resident', () => {
        render(<AddBokResidentForm {...baseProps} resident={null} />);
        expect(screen.getByText('Dodaj Mieszkańca BOK')).toBeInTheDocument();
    });

    it('renders "Edytuj Mieszkańca BOK" title for existing resident', () => {
        render(<AddBokResidentForm {...baseProps} resident={existingResident} />);
        expect(screen.getByText('Edytuj Mieszkańca BOK')).toBeInTheDocument();
    });

    it('pre-fills firstName and lastName when editing', async () => {
        render(<AddBokResidentForm {...baseProps} resident={existingResident} />);
        await waitFor(() => {
            expect(screen.getByDisplayValue('Viktor')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Shevchenko')).toBeInTheDocument();
        });
    });
});

// ─── AddBokResidentForm — Buttons presence ────────────────────────────────────

describe('AddBokResidentForm — button visibility', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows "Zapisz" button for new resident', () => {
        render(<AddBokResidentForm {...baseProps} resident={null} />);
        expect(screen.getByRole('button', { name: /Zapisz/i })).toBeInTheDocument();
    });

    it('shows "Anuluj" button', () => {
        render(<AddBokResidentForm {...baseProps} resident={null} />);
        expect(screen.getByRole('button', { name: /Anuluj/i })).toBeInTheDocument();
    });

    it('does NOT show "Zwolnij" button for a new resident (resident=null)', () => {
        render(<AddBokResidentForm {...baseProps} resident={null} />);
        expect(screen.queryByRole('button', { name: /Zwolnij/i })).not.toBeInTheDocument();
    });

    it('shows "Zwolnij" button when editing an existing resident', () => {
        render(<AddBokResidentForm {...baseProps} resident={existingResident} />);
        expect(screen.getByRole('button', { name: /Zwolnij/i })).toBeInTheDocument();
    });
});

// ─── AddBokResidentForm — Anuluj button ──────────────────────────────────────

describe('AddBokResidentForm — Anuluj button', () => {
    beforeEach(() => jest.clearAllMocks());

    it('calls onOpenChange(false) when "Anuluj" is clicked', async () => {
        const onOpenChange = jest.fn();
        render(<AddBokResidentForm {...baseProps} resident={null} onOpenChange={onOpenChange} />);
        fireEvent.click(screen.getByRole('button', { name: /Anuluj/i }));
        await waitFor(() => {
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });
});

// ─── AddBokResidentForm — Zwolnij button ─────────────────────────────────────

describe('AddBokResidentForm — Zwolnij button', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows error toast when "Zwolnij" is clicked without dismissDate filled', async () => {
        render(<AddBokResidentForm {...baseProps} resident={existingResident} />);
        fireEvent.click(screen.getByRole('button', { name: /Zwolnij/i }));
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                variant: 'destructive',
                description: expect.stringContaining('Data zwolnienia'),
            }));
        });
    });

    it('does NOT call handleDismissBokResident when dismissDate is missing', async () => {
        render(<AddBokResidentForm {...baseProps} resident={existingResident} />);
        fireEvent.click(screen.getByRole('button', { name: /Zwolnij/i }));
        await waitFor(() => {
            expect(mockHandleDismissBokResident).not.toHaveBeenCalled();
        });
    });

    it('calls handleDismissBokResident with resident.id and a Date when dismissDate is pre-filled', async () => {
        render(<AddBokResidentForm {...baseProps} resident={residentWithDismissDate} />);
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Zwolnij/i })).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: /Zwolnij/i }));
        await waitFor(() => {
            expect(mockHandleDismissBokResident).toHaveBeenCalledWith(
                'bok-1',
                expect.any(Date)
            );
        });
    });

    it('calls onOpenChange(false) after successful dismissal', async () => {
        const onOpenChange = jest.fn();
        render(<AddBokResidentForm {...baseProps} resident={residentWithDismissDate} onOpenChange={onOpenChange} />);
        await waitFor(() => screen.getByRole('button', { name: /Zwolnij/i }));
        fireEvent.click(screen.getByRole('button', { name: /Zwolnij/i }));
        await waitFor(() => {
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });
});

// ─── AddBokResidentForm — "Data zwolnienia" field ────────────────────────────

describe('AddBokResidentForm — Data zwolnienia field', () => {
    beforeEach(() => jest.clearAllMocks());

    it('does NOT show "Data zwolnienia" field when adding a new resident', () => {
        render(<AddBokResidentForm {...baseProps} resident={null} />);
        expect(screen.queryByText(/Data zwolnienia/i)).not.toBeInTheDocument();
    });

    it('shows "Data zwolnienia" field when editing an existing resident', () => {
        render(<AddBokResidentForm {...baseProps} resident={existingResident} />);
        expect(screen.getByText(/Data zwolnienia/i)).toBeInTheDocument();
    });
});

// ─── AddBokResidentForm — "Data wyjazdu" label ───────────────────────────────

describe('AddBokResidentForm — Data wyjazdu label', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows "Data wyjazdu" label with "(informacyjnie)" suffix', () => {
        render(<AddBokResidentForm {...baseProps} resident={existingResident} />);
        expect(screen.getByText(/informacyjnie/i)).toBeInTheDocument();
    });
});

// ─── AddBokResidentForm — Form validation ─────────────────────────────────────

describe('AddBokResidentForm — form validation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows validation errors for empty firstName and lastName on submit', async () => {
        render(<AddBokResidentForm {...baseProps} resident={null} />);

        const firstNameInput = screen.getByLabelText('Imię');
        const lastNameInput = screen.getByLabelText('Nazwisko');
        fireEvent.change(firstNameInput, { target: { value: '' } });
        fireEvent.change(lastNameInput, { target: { value: '' } });

        fireEvent.click(screen.getByRole('button', { name: /Zapisz/i }));

        await waitFor(() => {
            expect(screen.getByText('Imię jest wymagane.')).toBeInTheDocument();
            expect(screen.getByText('Nazwisko jest wymagane.')).toBeInTheDocument();
        });
    });

    it('calls onSave when form is valid and "Zapisz" is clicked', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        render(<AddBokResidentForm {...baseProps} resident={existingResident} onSave={onSave} />);

        await waitFor(() => screen.getByDisplayValue('Viktor'));
        fireEvent.click(screen.getByRole('button', { name: /Zapisz/i }));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledTimes(1);
        });
    });

    it('onSave receives dismissDate when editing resident with dismissDate set', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        render(<AddBokResidentForm {...baseProps} resident={residentWithDismissDate} onSave={onSave} />);

        await waitFor(() => screen.getByDisplayValue('Viktor'));
        fireEvent.click(screen.getByRole('button', { name: /Zapisz/i }));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({ dismissDate: '2026-03-01' })
            );
        });
    });

    it('onSave does NOT call onOpenChange when onSave throws', async () => {
        const onSave = jest.fn().mockRejectedValue(new Error('Save failed'));
        const onOpenChange = jest.fn();
        render(<AddBokResidentForm {...baseProps} resident={existingResident} onSave={onSave} onOpenChange={onOpenChange} />);

        await waitFor(() => screen.getByDisplayValue('Viktor'));
        fireEvent.click(screen.getByRole('button', { name: /Zapisz/i }));

        await waitFor(() => expect(onSave).toHaveBeenCalled());
        // dialog should stay open
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
});

// ─── AddBokResidentForm — formSchema validation ───────────────────────────────

describe('AddBokResidentForm — formSchema unit tests', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { formSchema } = require('../add-bok-resident-form');

    it('rejects empty firstName, lastName, role', () => {
        const result = formSchema.safeParse({
            role: '',
            firstName: '',
            lastName: '',
            coordinatorId: 'coord-1',
            nationality: 'Polska',
            gender: 'Mężczyzna',
            checkInDate: new Date(),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i: { path: string[] }) => i.path[0]);
            expect(paths).toContain('firstName');
            expect(paths).toContain('lastName');
            expect(paths).toContain('role');
        }
    });

    it('accepts valid minimal BOK resident', () => {
        const result = formSchema.safeParse({
            role: 'Kierowca',
            firstName: 'Jan',
            lastName: 'Kowalski',
            coordinatorId: 'coord-1',
            nationality: 'Polska',
            gender: 'Mężczyzna',
            checkInDate: new Date(),
        });
        expect(result.success).toBe(true);
    });

    it('accepts valid data with dismissDate as Date', () => {
        const result = formSchema.safeParse({
            role: 'Kierowca',
            firstName: 'Jan',
            lastName: 'Kowalski',
            coordinatorId: 'coord-1',
            nationality: 'Polska',
            gender: 'Mężczyzna',
            checkInDate: new Date(),
            dismissDate: new Date('2026-03-01'),
        });
        expect(result.success).toBe(true);
    });

    it('rejects missing coordinatorId', () => {
        const result = formSchema.safeParse({
            role: 'Kierowca',
            firstName: 'Jan',
            lastName: 'Kowalski',
            coordinatorId: '',
            nationality: 'Polska',
            gender: 'Mężczyzna',
            checkInDate: new Date(),
        });
        expect(result.success).toBe(false);
    });
});
