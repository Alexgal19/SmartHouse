import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CoordinatorForm } from '../forms/coordinator-form';

// Mock dialog animations to avoid act() warnings
jest.mock('@/components/ui/dialog', () => {
    const originalModule = jest.requireActual('@/components/ui/dialog');
    return {
        __esModule: true,
        ...originalModule,
        DialogContent: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
            <div data-testid="dialog-content" {...props}>{children}</div>
        ),
    };
});

jest.mock('@/lib/i18n', () => ({
    useLanguage: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'settings.coordinatorLoginName': 'Imię (Login)',
                'settings.adminPerms': 'Administrator',
                'settings.driverPerms': 'Kierowca',
                'settings.rekrutacjaPerms': 'Rekrutacja',
                'common.save': 'Zapisz',
            };
            return map[key] || key;
        }
    }),
}));

describe('CoordinatorForm', () => {
    const mockOnSave = jest.fn();
    const mockOnOpenChange = jest.fn();
    const departments = ['Dept1', 'Dept2'];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render all permission switches', async () => {
        render(
            <CoordinatorForm
                isOpen={true}
                onOpenChange={mockOnOpenChange}
                onSave={mockOnSave}
                departments={departments}
            />
        );

        // Name
        expect(screen.getByLabelText(/Imię \(Login\)/i)).toBeInTheDocument();

        // Check if all 5 permission switches are rendered
        // In Shadcn, the Switch has a hidden input or role="switch".
        const switches = screen.getAllByRole('switch');
        expect(switches).toHaveLength(5);

        // Find labels
        expect(screen.getByText(/Administrator/i)).toBeInTheDocument();
        expect(screen.getByText(/Kierowca/i)).toBeInTheDocument();
        expect(screen.getByText(/Rekrutacja/i)).toBeInTheDocument();
        expect(screen.getByText(/Uprawnienia BOK/i)).toBeInTheDocument();
        expect(screen.getByText(/Edycja minionych kart kontroli/i)).toBeInTheDocument();
    });

    it('should correctly submit all toggle values', async () => {
        render(
            <CoordinatorForm
                isOpen={true}
                onOpenChange={mockOnOpenChange}
                onSave={mockOnSave}
                departments={departments}
            />
        );

        // Fill required fields
        fireEvent.change(screen.getByLabelText(/Imię \(Login\)/i), { target: { value: 'Test Coordinator' } });
        
        // Toggle switches. By default they are false. Let's toggle Admin and BOK.
        const adminSwitch = screen.getAllByRole('switch')[0]; // Assuming order: Admin, Driver, Rekrutacja, BOK, EditPastCards
        fireEvent.click(adminSwitch);
        
        const bokSwitch = screen.getAllByRole('switch')[3];
        fireEvent.click(bokSwitch);

        // Submit form
        const submitBtn = screen.getByRole('button', { name: /Zapisz/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledTimes(1);
        });

        const submittedData = mockOnSave.mock.calls[0][0];
        expect(submittedData.name).toBe('Test Coordinator');
        expect(submittedData.isAdmin).toBe(true);
        expect(submittedData.isDriver).toBe(false);
        expect(submittedData.isRekrutacja).toBe(false);
        expect(submittedData.isBok).toBe(true);
        expect(submittedData.canEditPastControlCards).toBe(false);
    });
});
