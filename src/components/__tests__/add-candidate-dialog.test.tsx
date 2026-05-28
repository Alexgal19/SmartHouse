/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddCandidateDialog from '@/components/dialogs/add-candidate-dialog';

jest.mock('@/lib/actions', () => ({
    addCandidateAction: jest.fn(),
}));

jest.mock('../wizard-utils', () => {
    const original = jest.requireActual('../wizard-utils');
    return { ...original, OcrCameraButton: () => null };
});

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: mockToast }),
}));

import { addCandidateAction } from '@/lib/actions';
const mockAdd = addCandidateAction as jest.Mock;

const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onSaved: jest.fn(),
};

describe('AddCandidateDialog', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders form fields when open', () => {
        render(<AddCandidateDialog {...defaultProps} />);
        expect(screen.getByText('Dodaj kandydata')).toBeInTheDocument();
        // Labels render with an asterisk: "Imię *"
        expect(screen.getByText(/^Imię/)).toBeInTheDocument();
        expect(screen.getByText(/^Nazwisko/)).toBeInTheDocument();
        expect(screen.getByText('Numer paszportu')).toBeInTheDocument();
    });

    it('save button is disabled when first name is empty', () => {
        render(<AddCandidateDialog {...defaultProps} />);
        const saveBtn = screen.getByRole('button', { name: /Zapisz/i });
        expect(saveBtn).toBeDisabled();
    });

    it('save button is disabled when last name is empty', () => {
        render(<AddCandidateDialog {...defaultProps} />);
        const [firstNameInput] = screen.getAllByRole('textbox');
        fireEvent.change(firstNameInput, { target: { value: 'Jan' } });
        const saveBtn = screen.getByRole('button', { name: /Zapisz/i });
        expect(saveBtn).toBeDisabled();
    });

    it('save button is enabled when both required fields are filled', () => {
        render(<AddCandidateDialog {...defaultProps} />);
        const [firstNameInput, lastNameInput] = screen.getAllByRole('textbox');
        fireEvent.change(firstNameInput, { target: { value: 'Jan' } });
        fireEvent.change(lastNameInput, { target: { value: 'Kowalski' } });
        const saveBtn = screen.getByRole('button', { name: /Zapisz/i });
        expect(saveBtn).not.toBeDisabled();
    });

    it('calls addCandidateAction with correct data on save', async () => {
        mockAdd.mockResolvedValueOnce({ success: true, candidate: { id: '1' } });
        render(<AddCandidateDialog {...defaultProps} />);

        const [firstNameInput, lastNameInput, passportInput] = screen.getAllByRole('textbox');
        fireEvent.change(firstNameInput, { target: { value: 'Anna' } });
        fireEvent.change(lastNameInput, { target: { value: 'Nowak' } });
        fireEvent.change(passportInput, { target: { value: 'AB123456' } });

        fireEvent.click(screen.getByRole('button', { name: /Zapisz/i }));

        await waitFor(() => {
            expect(mockAdd).toHaveBeenCalledWith({
                firstName: 'Anna',
                lastName: 'Nowak',
                passportNumber: 'AB123456',
                sourceOdbiorId: null,
            });
        });
    });

    it('closes dialog and calls onSaved on success', async () => {
        const candidate = { id: '1', firstName: 'Anna', lastName: 'Nowak' };
        mockAdd.mockResolvedValueOnce({ success: true, candidate });
        const onSaved = jest.fn();
        const onOpenChange = jest.fn();
        render(<AddCandidateDialog {...defaultProps} onSaved={onSaved} onOpenChange={onOpenChange} />);

        const [firstNameInput, lastNameInput] = screen.getAllByRole('textbox');
        fireEvent.change(firstNameInput, { target: { value: 'Anna' } });
        fireEvent.change(lastNameInput, { target: { value: 'Nowak' } });
        fireEvent.click(screen.getByRole('button', { name: /Zapisz/i }));

        await waitFor(() => {
            expect(onOpenChange).toHaveBeenCalledWith(false);
            expect(onSaved).toHaveBeenCalledWith(candidate);
        });
    });

    it('populates fields from prefill props', () => {
        render(
            <AddCandidateDialog
                {...defaultProps}
                prefillFirstName="Piotr"
                prefillLastName="Wiśniewski"
                prefillPassportNumber="PL999"
            />
        );
        const inputs = screen.getAllByRole('textbox');
        expect(inputs[0]).toHaveValue('Piotr');
        expect(inputs[1]).toHaveValue('Wiśniewski');
        expect(inputs[2]).toHaveValue('PL999');
    });

    it('passes sourceOdbiorId when provided', async () => {
        mockAdd.mockResolvedValueOnce({ success: true, candidate: { id: '2' } });
        render(<AddCandidateDialog {...defaultProps} sourceOdbiorId="odbior-42" />);

        const [firstNameInput, lastNameInput] = screen.getAllByRole('textbox');
        fireEvent.change(firstNameInput, { target: { value: 'X' } });
        fireEvent.change(lastNameInput, { target: { value: 'Y' } });
        fireEvent.click(screen.getByRole('button', { name: /Zapisz/i }));

        await waitFor(() => {
            expect(mockAdd).toHaveBeenCalledWith(
                expect.objectContaining({ sourceOdbiorId: 'odbior-42' })
            );
        });
    });
});
