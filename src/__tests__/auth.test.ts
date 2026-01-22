import { login, logout, getSession } from '@/lib/auth';
import * as sheets from '@/lib/sheets';

jest.mock('iron-session');
jest.mock('next/headers');
jest.mock('@/lib/sheets');
jest.mock('@/lib/session');

const mockedGetAllSheetsData = sheets.getAllSheetsData as jest.Mock;

describe('Authentication', () => {
    const mockSession = {
        isLoggedIn: false,
        uid: '',
        name: '',
        isAdmin: false,
        save: jest.fn(),
        destroy: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock getIronSession to return our mock session
        const { getIronSession } = require('iron-session');
        getIronSession.mockResolvedValue(mockSession);
    });

    describe('getSession', () => {
        it('should return session with default values if not logged in', async () => {
            const session = await getSession();
            expect(session.isLoggedIn).toBe(false);
            expect(session.uid).toBe('');
            expect(session.name).toBe('');
            expect(session.isAdmin).toBe(false);
        });

        it('should return session as is if already logged in', async () => {
            mockSession.isLoggedIn = true;
            mockSession.uid = 'test-uid';
            mockSession.name = 'Test User';
            mockSession.isAdmin = true;

            const session = await getSession();
            expect(session.isLoggedIn).toBe(true);
            expect(session.uid).toBe('test-uid');
            expect(session.name).toBe('Test User');
            expect(session.isAdmin).toBe(true);
        });
    });

    describe('login', () => {
        it('should login admin with hardcoded credentials', async () => {
            process.env.ADMIN_PASSWORD = 'adminpass';

            const result = await login('admin', 'adminpass');
            expect(result.success).toBe(true);
            expect(result.user).toEqual({
                uid: 'admin-hardcoded',
                name: 'Admin',
                isAdmin: true,
            });
            expect(mockSession.save).toHaveBeenCalled();
            expect(mockSession.isLoggedIn).toBe(true);
            expect(mockSession.uid).toBe('admin-hardcoded');
            expect(mockSession.name).toBe('Admin');
            expect(mockSession.isAdmin).toBe(true);
        });

        it('should fail login for invalid admin password', async () => {
            process.env.ADMIN_PASSWORD = 'adminpass';

            await expect(login('admin', 'wrongpass')).rejects.toThrow('Nieprawidłowa nazwa użytkownika lub hasło.');
            expect(mockSession.save).not.toHaveBeenCalled();
        });

        it('should login coordinator with correct credentials', async () => {
            mockedGetAllSheetsData.mockResolvedValue({
                settings: {
                    coordinators: [
                        { uid: 'coord-1', name: 'Jan Kowalski', password: 'coordpass', isAdmin: false },
                    ],
                },
            });

            const result = await login('Jan Kowalski', 'coordpass');
            expect(result.success).toBe(true);
            expect(result.user).toEqual({
                uid: 'coord-1',
                name: 'Jan Kowalski',
                isAdmin: false,
            });
            expect(mockSession.save).toHaveBeenCalled();
            expect(mockSession.isLoggedIn).toBe(true);
            expect(mockSession.uid).toBe('coord-1');
            expect(mockSession.name).toBe('Jan Kowalski');
            expect(mockSession.isAdmin).toBe(false);
        });

        it('should fail login for invalid coordinator credentials', async () => {
            mockedGetAllSheetsData.mockResolvedValue({
                settings: {
                    coordinators: [
                        { uid: 'coord-1', name: 'Jan Kowalski', password: 'coordpass', isAdmin: false },
                    ],
                },
            });

            await expect(login('Jan Kowalski', 'wrongpass')).rejects.toThrow('Nieprawidłowa nazwa użytkownika lub hasło.');
            expect(mockSession.save).not.toHaveBeenCalled();
        });

        it('should fail login for non-existent coordinator', async () => {
            mockedGetAllSheetsData.mockResolvedValue({
                settings: {
                    coordinators: [],
                },
            });

            await expect(login('Unknown', 'pass')).rejects.toThrow('Nieprawidłowa nazwa użytkownika lub hasło.');
            expect(mockSession.save).not.toHaveBeenCalled();
        });
    });

    describe('logout', () => {
        it('should destroy the session and redirect', async () => {
            const { redirect } = require('next/navigation');
            redirect.mockImplementation(() => {});

            await logout();
            expect(mockSession.destroy).toHaveBeenCalled();
            expect(redirect).toHaveBeenCalledWith('/');
        });
    });
});