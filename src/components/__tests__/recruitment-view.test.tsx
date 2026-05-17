/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecruitmentView from '../recruitment-view';
import type { SessionData, Candidate, CandidateDemand } from '@/types';

jest.mock('@/lib/actions', () => ({
    getCandidatesAction: jest.fn(),
    getCandidateDemandsAction: jest.fn(),
    sendCandidateDemandNotificationAction: jest.fn(),
}));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: mockToast }),
}));

import {
    getCandidatesAction,
    getCandidateDemandsAction,
    sendCandidateDemandNotificationAction,
} from '@/lib/actions';

const mockGetCandidates = getCandidatesAction as jest.Mock;
const mockGetDemands = getCandidateDemandsAction as jest.Mock;
const mockSendDemand = sendCandidateDemandNotificationAction as jest.Mock;

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
            expect(screen.getByText('Kowalski')).toBeInTheDocument();
            expect(screen.getByText('Jan')).toBeInTheDocument();
            expect(screen.getByText('AB123')).toBeInTheDocument();
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
            const demandBtn = screen.getByRole('button', { name: /Zapotrzebowanie na kandydata/i });
            expect(demandBtn).toBeDisabled();
        });
    });

    it('demand button is enabled when no demand exists', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => {
            const demandBtn = screen.getByRole('button', { name: /Zapotrzebowanie na kandydata/i });
            expect(demandBtn).not.toBeDisabled();
        });
    });

    it('clicking demand button calls sendCandidateDemandNotificationAction', async () => {
        mockGetCandidates.mockResolvedValue([makeCandidate()]);
        mockSendDemand.mockResolvedValue({ success: true, sentCount: 2 });
        render(<RecruitmentView currentUser={mockUser} activeView="recruitment" />);

        await waitFor(() => expect(screen.getByText('Kowalski')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /Zapotrzebowanie na kandydata/i }));

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
            expect(screen.getByText(/✅/)).toBeInTheDocument();
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
});
