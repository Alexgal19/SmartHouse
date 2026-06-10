/**
 * Smoke test MainLayout — renderuje layout i uruchamia synchronizację
 * bufora offline zdjęć (useOfflinePhotoSync) przy mount.
 *
 * Uwaga: formularze (add-employee-form itd.) importują useMainLayout z tego
 * modułu — cykl main-layout ↔ forms łamie default export w jest (CJS interop).
 * Mockujemy moduły formularzy, żeby przerwać cykl w teście.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// jest.setup.mjs mockuje ten moduł globalnie (sam useMainLayout, bez default) —
// tu testujemy prawdziwy komponent
jest.unmock('@/components/layouts/main-layout');

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/dashboard',
}));

jest.mock('@/lib/sheets', () => ({
    getSettings: jest.fn().mockResolvedValue(null),
    getEmployees: jest.fn().mockResolvedValue([]),
    getNonEmployees: jest.fn().mockResolvedValue([]),
    getBokResidents: jest.fn().mockResolvedValue([]),
    getNotifications: jest.fn().mockResolvedValue([]),
    getRawAddressHistory: jest.fn().mockResolvedValue([]),
    getOdbiorEntries: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/hooks/use-offline-photo-sync', () => ({
    useOfflinePhotoSync: jest.fn(() => ({ syncNow: jest.fn() })),
}));

// Przerwanie cyklu main-layout ↔ forms (formy importują useMainLayout)
jest.mock('@/components/forms/add-employee-form', () => ({ AddEmployeeForm: () => null }));
jest.mock('@/components/forms/add-non-employee-form', () => ({ AddNonEmployeeForm: () => null }));
jest.mock('@/components/forms/add-bok-resident-form', () => ({ AddBokResidentForm: () => null }));
jest.mock('@/components/forms/edit-bok-resident-form', () => ({}));
jest.mock('@/components/forms/address-form', () => ({ AddressForm: () => null }));

jest.mock('@/components/layouts/header', () => ({
    __esModule: true,
    default: () => <div data-testid="header" />,
}));

jest.mock('@/components/layouts/mobile-nav', () => ({
    MobileNav: () => <div data-testid="mobile-nav" />,
}));

import MainLayout from '@/components/layouts/main-layout';
import { useOfflinePhotoSync } from '@/hooks/use-offline-photo-sync';
import type { SessionData } from '@/types';

const session: SessionData = {
    isLoggedIn: true,
    uid: 'u1',
    name: 'Admin',
    isAdmin: true,
} as SessionData;

describe('MainLayout', () => {
    it('renderuje się (loader przed danymi) i odpala sync bufora offline zdjęć', async () => {
        const { container } = render(
            <MainLayout initialSession={session}>
                <div data-testid="page-content">Treść strony</div>
            </MainLayout>
        );

        // Layout renderuje się bez crashu (loader albo pełny shell)
        await waitFor(() => expect(container.firstChild).not.toBeNull());

        // Kluczowa asercja: synchronizacja bufora offline zdjęć startuje z layoutem
        expect(useOfflinePhotoSync).toHaveBeenCalled();
    });
});
