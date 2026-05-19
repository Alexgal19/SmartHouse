/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecruitmentView from '../recruitment-view';
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
}));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: mockToast }),
}));

import {
    getCandidatesAction,
    getCandidateDemandsAction,
    sendCandidateDemandNotificationAction,
    deleteCandidateAction,
    acknowledgeCandidateDemandAction,
    recordInterviewResultAction,
} from '@/lib/actions';

const mockGetCandidates = getCandidatesAction as jest.Mock;
const mockGetDemands = getCandidateDemandsAction as jest.Mock;
const mockSendDemand = sendCandidateDemandNotificationAction as jest.Mock;
const mockDeleteCandidate = deleteCandidateAction as jest.Mock;
const mockAckDemand = acknowledgeCandidateDemandAction as jest.Mock;
const mockRecordInterview = recordInterviewResultAction as jest.Mock;

const mockUser: SessionData = {
    isLoggedIn: true,
    uid: 'user-1',
    name: 'Test User',
    isAdmin: true,
    isDriver: false,
    isRekrutacja: true,
};

const makeCandidate = (overrides: Partial<Candidate> = {}): Candidate => ({
    id: 'cand-1',
    firstName: 'Jan',
    lastName: 'Kowalski',
    passportNumber: 'AB123',
    status: 'nowy',
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
            expect(within(desktop).getByText('AB123')).toBeInTheDocument();
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

    it('demand button is disabled when demand status is pending', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockGetDemands.mockResolvedValue([makeDemand({ status: 'pending' })]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            const demandBtn = within(desktop).getByRole('button', { name: /Zapotrzebowanie na kandydata/i });
            expect(demandBtn).toBeDisabled();
        });
    });

    it('demand button is enabled when no demand exists', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            const demandBtn = within(desktop).getByRole('button', { name: /Zapotrzebowanie na kandydata/i });
            expect(demandBtn).not.toBeDisabled();
        });
    });

    it('clicking demand button calls sendCandidateDemandNotificationAction', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockSendDemand.mockResolvedValue({ success: true, sentCount: 2 });
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText('Kowalski')).toBeInTheDocument();
        });

        const desktop = screen.getByTestId('recruitment-desktop');
        fireEvent.click(within(desktop).getByRole('button', { name: /Zapotrzebowanie na kandydata/i }));

        await waitFor(() => {
            expect(mockSendDemand).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'cand-1', lastName: 'Kowalski' })
            );
        });
    });

    it('shows acknowledged demand status correctly', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockGetDemands.mockResolvedValue([
            makeDemand({ status: 'acknowledged', acknowledgedAt: '2026-05-02T09:00:00.000Z' }),
        ]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText(/✅/)).toBeInTheDocument();
        });
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
            expect(within(desktop).getByRole('button', { name: /Usuń/i })).toBeInTheDocument();
        });
    });

    it('hides delete button for non-admin', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        const nonAdminUser = { ...mockUser, isAdmin: false };
        render(<RecruitmentView currentUser={nonAdminUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).queryByRole('button', { name: /Usuń/i })).not.toBeInTheDocument();
        });
    });

    it('clicking delete button removes candidate for admin', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockDeleteCandidate.mockResolvedValue({ success: true });
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText('Kowalski')).toBeInTheDocument();
        });

        const desktop = screen.getByTestId('recruitment-desktop');
        fireEvent.click(within(desktop).getByRole('button', { name: /Usuń/i }));

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

    it('opens interview dialog on candidate row click', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText('Kowalski')).toBeInTheDocument();
        });

        const desktop = screen.getByTestId('recruitment-desktop');
        fireEvent.click(within(desktop).getByText('Kowalski'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Tak — udana/i })).toBeInTheDocument();
        });
    });

    it('interview dialog shows success and failure buttons', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText('Kowalski')).toBeInTheDocument();
        });

        const desktop = screen.getByTestId('recruitment-desktop');
        fireEvent.click(within(desktop).getByText('Kowalski'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Tak — udana/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Nie — nieudana/i })).toBeInTheDocument();
        });
    });

    it('clicking success records interview result and updates table', async () => {
        const candidate = makeCandidate();
        mockGetCandidates.mockResolvedValue([candidate]);
        mockRecordInterview.mockResolvedValue({
            success: true,
            entry: { result: 'success', recordedBy: 'Test User', recordedAt: '2026-05-01T12:00:00.000Z' },
        });
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText('Kowalski')).toBeInTheDocument();
        });

        const desktop = screen.getByTestId('recruitment-desktop');
        fireEvent.click(within(desktop).getByText('Kowalski'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Tak — udana/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Tak — udana/i }));

        await waitFor(() => {
            expect(mockRecordInterview).toHaveBeenCalledWith('cand-1', 'success');
            const desktop2 = screen.getByTestId('recruitment-desktop');
            expect(within(desktop2).getByText(/Udana/)).toBeInTheDocument();
        });
    });

    it('clicking failure records interview result', async () => {
        const candidate = makeCandidate();
        mockGetCandidates.mockResolvedValue([candidate]);
        mockRecordInterview.mockResolvedValue({
            success: true,
            entry: { result: 'failure', recordedBy: 'Test User', recordedAt: '2026-05-01T12:00:00.000Z' },
        });
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText('Kowalski')).toBeInTheDocument();
        });

        const desktop = screen.getByTestId('recruitment-desktop');
        fireEvent.click(within(desktop).getByText('Kowalski'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Nie — nieudana/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Nie — nieudana/i }));

        await waitFor(() => {
            expect(mockRecordInterview).toHaveBeenCalledWith('cand-1', 'failure');
            const desktop2 = screen.getByTestId('recruitment-desktop');
            expect(within(desktop2).getByText(/Nieudana/)).toBeInTheDocument();
        });
    });

    it('displays interview history in reverse chronological order', async () => {
        const candidate = makeCandidate({
            firstName: 'Piotr',
            interviewHistory: [
                { result: 'success', recordedBy: 'Anna', recordedAt: '2026-05-02T10:00:00.000Z' },
                { result: 'failure', recordedBy: 'Jan', recordedAt: '2026-05-01T10:00:00.000Z' },
            ],
        });
        mockGetCandidates.mockResolvedValue([candidate]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText('Kowalski')).toBeInTheDocument();
        });

        const desktop = screen.getByTestId('recruitment-desktop');
        fireEvent.click(within(desktop).getByText('Kowalski'));

        await waitFor(() => {
            expect(screen.getByText(/Historia rozmów/i)).toBeInTheDocument();
        });

        // Both history entries should be visible
        expect(screen.getByText('Anna')).toBeInTheDocument();
        expect(screen.getByText('Jan')).toBeInTheDocument();
    });

    it('latest interview result shown in table cell', async () => {
        const candidate = makeCandidate({
            interviewHistory: [
                { result: 'success', recordedBy: 'Anna', recordedAt: '2026-05-02T10:00:00.000Z' },
            ],
        });
        mockGetCandidates.mockResolvedValue([candidate]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const desktop = screen.getByTestId('recruitment-desktop');
            expect(within(desktop).getByText(/Udana/)).toBeInTheDocument();
        });
    });
});
