/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecruitmentView from '@/components/views/recruitment-view';
import type { SessionData, Candidate, CandidateDemand } from '@/types';

let mockDemandId: string | null = null;
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: (...args: any[]) => mockReplace(...args),
        prefetch: jest.fn(),
    }),
    useSearchParams: () => ({
        get: (key: string) => (key === 'demandId' ? mockDemandId : null),
    }),
    usePathname: () => '',
}));

jest.mock('@/lib/actions', () => ({
    getCandidatesAction: jest.fn(),
    getCandidateDemandsAction: jest.fn(),
    sendCandidateDemandNotificationAction: jest.fn(),
    deleteCandidateAction: jest.fn(),
    acknowledgeCandidateDemandAction: jest.fn(),
    recordInterviewResultAction: jest.fn(),
    getOdbiorEntriesAction: jest.fn(),
}));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: any) => <div data-testid="mock-dropdown">{children}</div>,
    DropdownMenuTrigger: ({ children }: any) => <div data-testid="mock-dropdown-trigger">{children}</div>,
    DropdownMenuContent: ({ children }: any) => {
        const props = {
            'data-testid': 'mock-dropdown-content',
            role: 'menu',
        };
        return <div {...props}>{children}</div>;
    },
    DropdownMenuItem: ({ children, onClick, className }: any) => {
        const props = {
            role: 'menuitem',
            className,
            onClick,
        };
        return <div {...props}>{children}</div>;
    },
}));

import {
    getCandidatesAction,
    getCandidateDemandsAction,
    deleteCandidateAction,
    acknowledgeCandidateDemandAction,
    getOdbiorEntriesAction,
} from '@/lib/actions';
import { useMainLayout } from '@/components/layouts/main-layout';

const mockGetCandidates = getCandidatesAction as jest.Mock;
const mockGetDemands = getCandidateDemandsAction as jest.Mock;
const mockDeleteCandidate = deleteCandidateAction as jest.Mock;
const mockAckDemand = acknowledgeCandidateDemandAction as jest.Mock;
const mockGetOdbiorEntries = getOdbiorEntriesAction as jest.Mock;

const mockUser: SessionData = {
    isLoggedIn: true,
    uid: 'user-1',
    name: 'Test User',
    isAdmin: true,
    isDriver: false,
    isRekrutacja: true,
    isBok: false,
};

const makeCandidate = (overrides: Partial<Candidate> = {}): Candidate => ({
    id: 'cand-1',
    firstName: 'Jan',
    lastName: 'Kowalski',
    passportNumber: 'AB123',
    status: 'wdrodze',
    createdAt: '2026-05-01T10:00:00.000Z',
    interviewHistory: [],
    ...overrides,
});

const makeDemand = (overrides: Partial<CandidateDemand> = {}): CandidateDemand => ({
    id: 'dem-1',
    candidateId: 'cand-1',
    candidateFirstName: 'Jan',
    candidateLastName: 'Kowalski',
    requestedBy: 'user-1',
    requestedAt: '2026-05-01T11:00:00.000Z',
    status: 'pending',
    retryCount: 0,
    ...overrides,
});

describe('RecruitmentView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetDemands.mockResolvedValue([]);
        mockGetOdbiorEntries.mockResolvedValue([]);
        mockDemandId = null;
        mockReplace.mockClear();
    });

    it('shows empty state when there are no candidates', async () => {
        mockGetCandidates.mockResolvedValue([]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);
        await waitFor(() => {
            expect(screen.getByText('Brak danych do wyświetlenia.')).toBeInTheDocument();
        });
    });

    it('renders candidates in a table', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);
        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText('Kowalski')).toBeInTheDocument();
            expect(within(desktop).getByText('Jan')).toBeInTheDocument();
        });
    });

    it('filters candidates by last name', async () => {
        mockGetCandidates.mockResolvedValue([
            makeCandidate({ id: 'c1', lastName: 'Kowalski' }),
            makeCandidate({ id: 'c2', lastName: 'Nowak', firstName: 'Anna' }),
        ]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => expect(screen.getByText('Kowalski')).toBeInTheDocument());

        const searchInput = screen.getByPlaceholderText('Szukaj po nazwisku...');
        fireEvent.change(searchInput, { target: { value: 'now' } });

        expect(screen.queryByText('Kowalski')).not.toBeInTheDocument();
        expect(screen.getByText('Nowak')).toBeInTheDocument();
    });

    it('reloads data when activeView changes to recruitment', async () => {
        mockGetCandidates.mockResolvedValue([]);
        const { rerender } = render(
            <RecruitmentView currentUser={mockUser} activeView="other" />
        );
        const initialCalls = mockGetCandidates.mock.calls.length;

        rerender(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            expect(mockGetCandidates.mock.calls.length).toBeGreaterThan(initialCalls);
        });
    });

    it('shows delete button for admin', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByRole('menuitem', { name: /Usuń/i })).toBeInTheDocument();
        });
    });

    it('hides delete button for non-admin', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        const nonAdminUser = { ...mockUser, isAdmin: false };
        render(<RecruitmentView currentUser={nonAdminUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).queryByRole('menuitem', { name: /Usuń/i })).not.toBeInTheDocument();
        });
    });

    it('clicking delete button removes candidate for admin', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockDeleteCandidate.mockResolvedValue({ success: true });
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText('Kowalski')).toBeInTheDocument();
            expect(within(desktop).getByRole('menuitem', { name: /Usuń/i })).toBeInTheDocument();
        });

        const desktop = screen.getByTestId('recruitment-desktop');
        fireEvent.click(within(desktop).getByRole('menuitem', { name: /Usuń/i }));

        await waitFor(() => {
            expect(mockDeleteCandidate).toHaveBeenCalledWith('cand-1', 'user-1');
            expect(screen.queryByText('Kowalski')).not.toBeInTheDocument();
        });
    });

    it('shows confirmation dialog when demandId is in URL and demand is pending', async () => {
        mockDemandId = 'dem-1';
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockGetDemands.mockResolvedValue([makeDemand({ status: 'pending' })]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            expect(screen.getByText(/Przyjąć zapotrzebowanie na kandydata/i)).toBeInTheDocument();
        });
    });

    it('accepting demand calls acknowledgeCandidateDemandAction and refreshes data', async () => {
        mockDemandId = 'dem-1';
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockGetDemands.mockResolvedValue([makeDemand({ status: 'pending' })]);
        mockAckDemand.mockResolvedValue({ success: true });
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            expect(screen.getByText(/Przyjąć zapotrzebowanie na kandydata/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Tak/i }));

        await waitFor(() => {
            expect(mockAckDemand).toHaveBeenCalledWith('dem-1', 'Test User');
        });
    });

    it('rejecting demand opens "are you sure" dialog', async () => {
        mockDemandId = 'dem-1';
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockGetDemands.mockResolvedValue([makeDemand({ status: 'pending' })]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            expect(screen.getByText(/Przyjąć zapotrzebowanie na kandydata/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Nie/i }));

        await waitFor(() => {
            expect(screen.getByText(/Jesteś pewny/i)).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('"are you sure" -> No returns to confirmation dialog', async () => {
        mockDemandId = 'dem-1';
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockGetDemands.mockResolvedValue([makeDemand({ status: 'pending' })]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            expect(screen.getByText(/Przyjąć zapotrzebowanie na kandydata/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Nie/i }));
        await waitFor(() => {
            expect(screen.getByText(/Jesteś pewny/i)).toBeInTheDocument();
        }, { timeout: 3000 });

        fireEvent.click(screen.getByRole('button', { name: /Nie/i }));
        await waitFor(() => {
            expect(screen.getByText(/Przyjąć zapotrzebowanie na kandydata/i)).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('"are you sure" -> Yes closes dialogs and clears URL param', async () => {
        mockDemandId = 'dem-1';
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockGetDemands.mockResolvedValue([makeDemand({ status: 'pending' })]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            expect(screen.getByText(/Przyjąć zapotrzebowanie na kandydata/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Nie/i }));
        await waitFor(() => {
            expect(screen.getByText(/Jesteś pewny/i)).toBeInTheDocument();
        }, { timeout: 3000 });

        fireEvent.click(screen.getByRole('button', { name: /Tak/i }));
        await waitFor(() => {
            expect(screen.queryByText(/Przyjąć zapotrzebowanie na kandydata/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Jesteś pewny/i)).not.toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('opens candidate detail dialog on candidate row click showing no passport photo when URL is absent', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate({ passportPhotoUrl: undefined })]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText('Kowalski')).toBeInTheDocument();
        });

        const desktop = screen.getByTestId('recruitment-desktop');
        fireEvent.click(within(desktop).getByText('Kowalski'));

        await waitFor(() => {
            expect(screen.getByText('Brak zdjęcia paszportu')).toBeInTheDocument();
            expect(screen.getByText('Numer paszportu:')).toBeInTheDocument();
            expect(screen.getAllByText('AB123').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('opens candidate detail dialog on candidate row click showing passport photo when URL is present', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate({ passportPhotoUrl: 'https://example.com/photo.jpg' })]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText('Kowalski')).toBeInTheDocument();
        });

        const desktop = screen.getByTestId('recruitment-desktop');
        fireEvent.click(within(desktop).getByText('Kowalski'));

        // Photo is hidden behind password wall initially
        await waitFor(() => {
            expect(screen.getByText('Kliknij aby zobaczyć zdjęcie paszportu')).toBeInTheDocument();
        });

        // Click the eye area to open password dialog
        fireEvent.click(screen.getByText('Kliknij aby zobaczyć zdjęcie paszportu'));

        await waitFor(() => {
            expect(screen.getByText('Wprowadź hasło')).toBeInTheDocument();
        });

        const passwordInput = screen.getByPlaceholderText('Hasło');
        fireEvent.change(passwordInput, { target: { value: 'SWhouse$21' } });
        fireEvent.click(screen.getByRole('button', { name: /Zatwierdź/i }));

        await waitFor(() => {
            const img = screen.getByAltText('Paszport') as HTMLImageElement;
            expect(img).toBeInTheDocument();
            expect(img.src).toBe('https://example.com/photo.jpg');
        });
    });

    it('hides candidates whose bokId matches a dismissed BOK resident', async () => {
        const dismissedBokResident = {
            id: 'bok-dismissed-1',
            firstName: 'Anna',
            lastName: 'Dismissed',
            nationality: '',
            address: '',
            roomNumber: '',
            gender: '',
            checkInDate: '2026-01-01',
            status: 'dismissed' as const,
        };
        const candidate = makeCandidate({
            id: 'cand-bok-match',
            firstName: 'Anna',
            lastName: 'Dismissed',
            status: 'zakwaterowana',
            sourceOdbiorId: null,
            bokId: 'bok-dismissed-1',
        });

        (useMainLayout as jest.Mock).mockReturnValue({
            allEmployees: [],
            allNonEmployees: [],
            allBokResidents: [dismissedBokResident],
            allCandidates: null,
            allDemands: null,
            settings: {
                coordinators: [], nationalities: [], departments: [],
                genders: [], localities: [], addresses: [], statuses: [],
            },
            currentUser: mockUser,
        });

        mockGetCandidates.mockResolvedValue([candidate]);
        mockGetOdbiorEntries.mockResolvedValue([]);

        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        // Candidate filtered out by direct bokId match — candidates table not rendered
        await waitFor(() => {
            expect(screen.getByText('Szukaj po nazwisku...')).toBeInTheDocument();
        });
        // BOK search section may show the dismissed BOK resident as history,
        // so we check that the candidates TABLE (not the whole page) has no entry
        expect(screen.queryByTestId('recruitment-desktop')).toBeNull();
    });

    it('hides candidates by name fallback when bokId is null and sourceOdbiorId is unlinked', async () => {
        const dismissedBokResident = {
            id: 'bok-dismissed-2',
            firstName: 'Jan',
            lastName: 'Zwolniony',
            nationality: '',
            address: '',
            roomNumber: '',
            gender: '',
            checkInDate: '2026-01-01',
            status: 'dismissed' as const,
        };
        // Old candidate without bokId, with broken sourceOdbiorId link
        const candidate = makeCandidate({
            id: 'cand-legacy',
            firstName: 'Jan',
            lastName: 'Zwolniony',
            status: 'zakwaterowana',
            sourceOdbiorId: 'odbior-unlinked',
            bokId: null,
        });

        (useMainLayout as jest.Mock).mockReturnValue({
            allEmployees: [],
            allNonEmployees: [],
            allBokResidents: [dismissedBokResident],
            allCandidates: null,
            allDemands: null,
            settings: {
                coordinators: [], nationalities: [], departments: [],
                genders: [], localities: [], addresses: [], statuses: [],
            },
            currentUser: mockUser,
        });

        mockGetCandidates.mockResolvedValue([candidate]);
        mockGetOdbiorEntries.mockResolvedValue([
            { id: 'odbior-unlinked', convertedToBokId: null } as any,
        ]);

        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        // Name-based fallback catches it — candidates table not rendered
        await waitFor(() => {
            expect(screen.getByText('Szukaj po nazwisku...')).toBeInTheDocument();
        });
        // BOK search section now shows all BOK residents (including dismissed) as history,
        // so we verify the candidate is absent from the CANDIDATES table specifically
        expect(screen.queryByTestId('recruitment-desktop')).toBeNull();
    });

    it('shows candidate when BOK resident is NOT dismissed (name match but active)', async () => {
        const activeBokResident = {
            id: 'bok-active-1',
            firstName: 'Ewa',
            lastName: 'Active',
            nationality: '',
            address: '',
            roomNumber: '',
            gender: '',
            checkInDate: '2026-01-01',
            status: 'active' as const,
        };
        const candidate = makeCandidate({
            id: 'cand-bok-active-match',
            firstName: 'Ewa',
            lastName: 'Active',
            status: 'zakwaterowana',
            sourceOdbiorId: null,
        });

        (useMainLayout as jest.Mock).mockReturnValue({
            allEmployees: [],
            allNonEmployees: [],
            allBokResidents: [activeBokResident],
            allCandidates: null,
            allDemands: null,
            settings: {
                coordinators: [], nationalities: [], departments: [],
                genders: [], localities: [], addresses: [], statuses: [],
            },
            currentUser: mockUser,
        });

        mockGetCandidates.mockResolvedValue([candidate]);
        mockGetOdbiorEntries.mockResolvedValue([]);

        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        // Candidate should be VISIBLE because BOK resident is active
        await waitFor(() => {
            expect(screen.getByText('Active')).toBeInTheDocument();
        });
    });

    it('does NOT open confirmation dialog when demandId is already acknowledged', async () => {
        mockDemandId = 'dem-acknowledged';
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockGetDemands.mockResolvedValue([makeDemand({ id: 'dem-acknowledged', status: 'acknowledged' })]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            expect(screen.getByText('Kowalski')).toBeInTheDocument();
        });

        // Dialog should NOT appear for already-acknowledged demand
        expect(screen.queryByText(/Przyjąć zapotrzebowanie na kandydata/i)).not.toBeInTheDocument();
        expect(mockReplace).toHaveBeenCalled();
    });

    it('does NOT open confirmation dialog when demandId is delivered', async () => {
        mockDemandId = 'dem-delivered';
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockGetDemands.mockResolvedValue([makeDemand({ id: 'dem-delivered', status: 'delivered' })]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            expect(screen.getByText('Kowalski')).toBeInTheDocument();
        });

        expect(screen.queryByText(/Przyjąć zapotrzebowanie na kandydata/i)).not.toBeInTheDocument();
    });

    it('does NOT open confirmation dialog when demandId is expired', async () => {
        mockDemandId = 'dem-expired';
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockGetDemands.mockResolvedValue([makeDemand({ id: 'dem-expired', status: 'expired' })]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            expect(screen.getByText('Kowalski')).toBeInTheDocument();
        });

        expect(screen.queryByText(/Przyjąć zapotrzebowanie na kandydata/i)).not.toBeInTheDocument();
    });


});