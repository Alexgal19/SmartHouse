/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OsobaDoZakwaterowaniaView from '@/components/views/osoba-do-zakwaterowania-view';
import * as layoutModule from '@/components/layouts/main-layout';
import * as actionsModule from '@/lib/actions';

// Mock actions
jest.mock('@/lib/actions', () => ({
    updateCandidateAction: jest.fn(),
}));

// Mock Dialog
jest.mock('@/components/dialogs/odbior-zakwaterowanie-dialog', () => ({
    OdbiorZakwaterowanieDialog: ({ isOpen, candidateId }: any) => {
        if (!isOpen) return null;
        return <div data-testid={`zakwaterowanie-dialog-${candidateId}`}>Dialog for {candidateId}</div>;
    }
}));

describe('OsobaDoZakwaterowaniaView', () => {
    const mockCurrentUser = { uid: 'user1', isAdmin: true, name: 'Admin', isLoggedIn: true, role: 'admin' } as any;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(layoutModule, 'useMainLayout').mockReturnValue({
            allCandidates: [
                {
                    id: 'c1',
                    firstName: 'John',
                    lastName: 'Doe',
                    interviewOutcome: 'do_zakwaterowania',
                    status: 'w_oczekiwaniu_na_zakwaterowanie',
                    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
                },
                {
                    id: 'c2',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    interviewOutcome: 'employed',
                    status: 'w_oczekiwaniu_na_zakwaterowanie',
                    createdAt: new Date('2024-01-02T12:00:00Z').toISOString(),
                },
                {
                    // Should not be visible
                    id: 'c3',
                    firstName: 'Hidden',
                    lastName: 'User',
                    interviewOutcome: null,
                    status: 'nowy',
                    createdAt: new Date('2024-01-03T12:00:00Z').toISOString(),
                }
            ]
        } as any);
    });

    it('renders list of candidates to be housed', () => {
        render(<OsobaDoZakwaterowaniaView currentUser={mockCurrentUser} />);
        
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.queryByText('Hidden User')).not.toBeInTheDocument();
        
        // Badge for employed
        expect(screen.getByText('Zatrudniony do zakwaterowania')).toBeInTheDocument();
    });

    it('opens zakwaterowanie dialog when clicking a candidate', () => {
        render(<OsobaDoZakwaterowaniaView currentUser={mockCurrentUser} />);
        
        // Click candidate card
        const candidate1 = screen.getByText('John Doe');
        fireEvent.click(candidate1);
        
        expect(screen.getByTestId('zakwaterowanie-dialog-c1')).toBeInTheDocument();
    });

    it('handles accept click and confirms', async () => {
        (actionsModule.updateCandidateAction as jest.Mock).mockResolvedValueOnce({});
        
        render(<OsobaDoZakwaterowaniaView currentUser={mockCurrentUser} />);
        
        // Click 'Akceptuję' button for John Doe (c1 is do_zakwaterowania)
        // There are two buttons, one for c1 and one for c2. Get by role 'button' inside candidate div
        const buttons = screen.getAllByText('Akceptuję');
        
        // Jane Smith (c2) is rendered first because it's newer (sorted by createdAt desc)
        // c2 is Jane Smith, c1 is John Doe.
        // We will just click the first one (c2)
        fireEvent.click(buttons[0]);
        
        // Alert dialog should appear
        expect(screen.getByText('Potwierdzenie')).toBeInTheDocument();
        expect(screen.getByText(/Czy na pewno chcesz zaakceptować Jane Smith/i)).toBeInTheDocument();
        
        // Click 'Tak'
        fireEvent.click(screen.getByText('Tak'));
        
        await waitFor(() => {
            expect(actionsModule.updateCandidateAction).toHaveBeenCalledWith('c2', {
                status: 'zakwaterowana' // because c2 is 'employed'
            });
        });
    });
});
