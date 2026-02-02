
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FilterControls } from '../housing-view';

// Mock UI components that might cause issues in JSDOM or are complex
jest.mock('@/components/ui/select', () => ({
    Select: ({ children, value, onValueChange }: any) => (
        <div data-testid="select-wrapper">
            <select
                data-testid="select-mock"
                value={value}
                onChange={e => onValueChange(e.target.value)}
            >
                {children}
            </select>
        </div>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

jest.mock('@/components/ui/switch', () => ({
    Switch: ({ checked, onCheckedChange, id }: any) => (
        <input 
            type="checkbox" 
            id={id} 
            checked={checked} 
            onChange={e => onCheckedChange(e.target.checked)} 
            data-testid="switch-mock"
        />
    ),
}));

describe('FilterControls', () => {
    const mockOnFilterChange = jest.fn();
    const mockSettings = {
        id: 'settings',
        addresses: [
            { id: 'addr1', name: 'Address 1', locality: 'Locality 1', coordinatorIds: ['coord1'], rooms: [] },
            { id: 'addr2', name: 'Address 2', locality: 'Locality 2', coordinatorIds: ['coord1'], rooms: [] }
        ],
        localities: ['Locality 1', 'Locality 2'],
        coordinators: [],
        nationalities: [],
        departments: [],
        genders: [],
        paymentTypesNZ: [],
        statuses: [],
        bokRoles: [],
        bokReturnOptions: [],
        bokStatuses: []
    } as any;
    
    const mockCurrentUser = { uid: 'coord1', isAdmin: true, name: 'Admin', isLoggedIn: true, role: 'admin' } as any;

    const initialFilters = {
        name: '',
        locality: 'all',
        showOnlyAvailable: false
    };

    beforeEach(() => {
        mockOnFilterChange.mockClear();
    });

    it('should render correctly', () => {
        render(<FilterControls filters={initialFilters} onFilterChange={mockOnFilterChange} settings={mockSettings} currentUser={mockCurrentUser} />);
        expect(screen.getByLabelText(/Szukaj adresu/i)).toBeInTheDocument();
        expect(screen.getByText(/Miejscowość/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Tylko z wolnymi miejscami/i)).toBeInTheDocument();
    });

    it('should call onFilterChange when name changes', () => {
        render(<FilterControls filters={initialFilters} onFilterChange={mockOnFilterChange} settings={mockSettings} currentUser={mockCurrentUser} />);
        const input = screen.getByLabelText(/Szukaj adresu/i);
        fireEvent.change(input, { target: { value: 'Test' } });
        expect(mockOnFilterChange).toHaveBeenCalledWith({ ...initialFilters, name: 'Test' });
    });

    it('should call onFilterChange when showOnlyAvailable changes', () => {
        render(<FilterControls filters={initialFilters} onFilterChange={mockOnFilterChange} settings={mockSettings} currentUser={mockCurrentUser} />);
        const switchControl = screen.getByLabelText(/Tylko z wolnymi miejscami/i);
        fireEvent.click(switchControl);
        expect(mockOnFilterChange).toHaveBeenCalledWith({ ...initialFilters, showOnlyAvailable: true });
    });
    
    it('should call onFilterChange when locality changes', () => {
        render(<FilterControls filters={initialFilters} onFilterChange={mockOnFilterChange} settings={mockSettings} currentUser={mockCurrentUser} />);
        const select = screen.getByTestId('select-mock');
        fireEvent.change(select, { target: { value: 'Locality 1' } });
        expect(mockOnFilterChange).toHaveBeenCalledWith({ ...initialFilters, locality: 'Locality 1' });
    });
});
