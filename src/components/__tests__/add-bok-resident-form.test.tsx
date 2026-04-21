import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

jest.mock('../main-layout', () => ({
    useMainLayout: () => ({
        handleDismissBokResident: jest.fn().mockResolvedValue(undefined),
        allEmployees: [],
        allNonEmployees: [],
        allBokResidents: [],
    }),
}));

// Mock wizard-utils OcrCameraButton
jest.mock('../wizard-utils', () => {
    const original = jest.requireActual('../wizard-utils');
    return {
        ...original,
        OcrCameraButton: () => null,
    };
});

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
    isRekrutacja: false,
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

// ─── AddBokResidentForm — Wizard (new resident) ──────────────────────────────

describe('AddBokResidentForm — wizard for new resident', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders step 0 with "Dane osoby" heading', () => {
        render(<AddBokResidentForm {...baseProps} resident={null} />);
        expect(screen.getByText('Dane osoby')).toBeInTheDocument();
    });

    it('Dalej button is disabled when required step 0 fields are empty', () => {
        render(<AddBokResidentForm {...baseProps} resident={null} />);
        expect(screen.getByRole('button', { name: /Dalej/i })).toBeDisabled();
    });

    it('Dalej button is enabled when step 0 fields are filled', () => {
        render(<AddBokResidentForm {...baseProps} resident={null} />);
        // Select role via button
        fireEvent.click(screen.getByRole('button', { name: 'Kierowca' }));
        // Fill name fields
        fireEvent.change(screen.getByPlaceholderText('Kowalski'), { target: { value: 'Kowalski' } });
        fireEvent.change(screen.getByPlaceholderText('Jan'), { target: { value: 'Jan' } });
        // Select coordinator and nationality via Comboboxes
        const comboboxes = screen.getAllByRole('combobox');
        fireEvent.click(comboboxes[0]); // coordinator
        fireEvent.click(screen.getByText('Jan Kowalski'));
        fireEvent.click(comboboxes[1]); // nationality
        fireEvent.click(screen.getByText('Polska'));
        expect(screen.getByRole('button', { name: /Dalej/i })).toBeEnabled();
    });

    it('Anuluj button on step 0 calls onOpenChange(false)', () => {
        const onOpenChange = jest.fn();
        render(<AddBokResidentForm {...baseProps} resident={null} onOpenChange={onOpenChange} />);
        fireEvent.click(screen.getByRole('button', { name: /Anuluj/i }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});

// ─── AddBokResidentForm — Edit mode (delegates to EditBokResidentForm) ────────

describe('AddBokResidentForm — edit mode via EditBokResidentForm', () => {
    beforeEach(() => jest.clearAllMocks());

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

    it('shows "Zapisz" button for existing resident', () => {
        render(<AddBokResidentForm {...baseProps} resident={existingResident} />);
        expect(screen.getByRole('button', { name: /Zapisz/i })).toBeInTheDocument();
    });

    it('shows "Anuluj" button for existing resident', () => {
        render(<AddBokResidentForm {...baseProps} resident={existingResident} />);
        expect(screen.getByRole('button', { name: /Anuluj/i })).toBeInTheDocument();
    });

    it('shows "Zwolnij" button when editing an existing resident', () => {
        render(<AddBokResidentForm {...baseProps} resident={existingResident} />);
        expect(screen.getByRole('button', { name: /Zwolnij/i })).toBeInTheDocument();
    });

    it('shows error toast when "Zwolnij" is clicked without dismissDate', async () => {
        render(<AddBokResidentForm {...baseProps} resident={existingResident} />);
        fireEvent.click(screen.getByRole('button', { name: /Zwolnij/i }));
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                variant: 'destructive',
                description: expect.stringContaining('Data zwolnienia'),
            }));
        });
    });

    it('shows "Data zwolnienia" field when editing an existing resident', () => {
        render(<AddBokResidentForm {...baseProps} resident={existingResident} />);
        expect(screen.getByText(/Data zwolnienia/i)).toBeInTheDocument();
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

    it('does NOT call onOpenChange when onSave throws', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        const onSave = jest.fn().mockRejectedValue(new Error('Save failed'));
        const onOpenChange = jest.fn();
        render(<AddBokResidentForm {...baseProps} resident={existingResident} onSave={onSave} onOpenChange={onOpenChange} />);
        await waitFor(() => screen.getByDisplayValue('Viktor'));
        fireEvent.click(screen.getByRole('button', { name: /Zapisz/i }));
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
        consoleSpy.mockRestore();
    });
});

// ─── AddBokResidentForm — formSchema validation ───────────────────────────────

describe('AddBokResidentForm — formSchema unit tests', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
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