

"use client";

import React, { useState, useEffect, useMemo, useCallback, createContext, useContext, useRef } from 'react';
import Link from 'next/link';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider
} from './ui/sidebar';
import Header from './header';
import { MobileNav } from './mobile-nav';
import type { View, Notification, Employee, Settings, Address, SessionData, NonEmployee, AddressHistory, BokResident } from '@/types';
import { Home, Settings as SettingsIcon, Users, Building } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    addEmployee,
    addNonEmployee,
    addBokResident,
    bulkDeleteEmployees,
    bulkDeleteEmployeesByCoordinator,
    checkAndUpdateStatuses,
    clearAllNotifications,
    deleteEmployee,
    deleteNonEmployee,
    deleteBokResident,
    importEmployeesFromExcel,
    importNonEmployeesFromExcel,
    updateNotificationReadStatus,
    updateEmployee,
    updateNonEmployee,
    updateBokResident,
    updateSettings,
    deleteNotification,
    deleteAddressHistoryEntry,
    migrateFullNames,
    bulkDeleteEmployeesByDepartment,
    sendPushNotification,
    updateCoordinatorSubscription,
} from '@/lib/actions';
import { getAllSheetsData } from '@/lib/sheets';
import { logout } from '../lib/auth';
import { useToast } from '../hooks/use-toast';
import { AddEmployeeForm, type EmployeeFormData } from './add-employee-form';
import { AddNonEmployeeForm } from './add-non-employee-form';
import { AddBokResidentForm, type BokResidentFormData } from './add-bok-resident-form';
import { cn } from '../lib/utils';
import { AddressForm } from './address-form';
import { ModernHouseIcon } from './icons/modern-house-icon';
import { differenceInDays, parseISO, format } from 'date-fns';

const HouseLoader = () => {
    return (
        <div className="relative w-48 h-48 flex flex-col items-center justify-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                <defs>
                    <linearGradient id="liquidGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="hsl(var(--primary) / 0.8)" />
                        <stop offset="50%" stopColor="hsl(var(--primary) / 0.4)" />
                        <stop offset="100%" stopColor="hsl(var(--primary) / 0.8)" />
                    </linearGradient>
                    <mask id="houseMask">
                        <path d="M10 50 L50 10 L90 50 L90 90 L65 90 L65 65 L35 65 L35 90 L10 90 Z" fill="white" />
                    </mask>
                </defs>
                <rect 
                    x="-50" 
                    y="-50" 
                    width="200" 
                    height="200" 
                    fill="url(#liquidGradient)" 
                    mask="url(#houseMask)"
                    className="animate-liquid-gradient"
                />
            </svg>
            <p className="absolute bottom-10 text-sm text-muted-foreground animate-pulse-text">
                Wczytywanie danych...
            </p>
        </div>
    );
};

type MainLayoutContextType = {
    allEmployees: Employee[] | null;
    allNonEmployees: NonEmployee[] | null;
    allBokResidents: BokResident[] | null;
    addressHistory: AddressHistory[] | null;
    rawEmployees: Employee[] | null;
    rawNonEmployees: NonEmployee[] | null;
    rawBokResidents: BokResident[] | null;
    settings: Settings | null;
    rawSettings: Settings | null;
    currentUser: SessionData | null;
    selectedCoordinatorId: string;
    hasNewCheckouts: boolean;
    setHasNewCheckouts: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedCoordinatorId: React.Dispatch<React.SetStateAction<string>>;
    handleBulkDeleteEmployees: (entityType: 'employee' | 'non-employee', status: 'active' | 'dismissed') => Promise<boolean>;
    handleBulkDeleteEmployeesByCoordinator: (coordinatorId: string) => Promise<boolean>;
    handleBulkDeleteEmployeesByDepartment: (department: string) => Promise<boolean>;
    handleAddEmployeeClick: () => void;
    handleEditEmployeeClick: (employee: Employee) => void;
    handleUpdateSettings: (newSettings: Partial<Settings>) => Promise<void>;
    refreshData: (showToast?: boolean) => Promise<RefreshDataResult | undefined>;
    handleAddNonEmployeeClick: () => void;
    handleEditNonEmployeeClick: (nonEmployee: NonEmployee) => void;
    handleDeleteNonEmployee: (id: string, actorUid: string) => Promise<void>;
    handleAddBokResidentClick: () => void;
    handleEditBokResidentClick: (resident: BokResident) => void;
    handleDeleteBokResident: (id: string, actorUid: string) => Promise<void>;
    handleRefreshStatuses: (showNoChangesToast?: boolean) => Promise<void>;
    handleAddressFormOpen: (address: Address | null) => void;
    handleDismissEmployee: (employeeId: string, checkOutDate: Date) => Promise<void>;
    handleDismissNonEmployee: (nonEmployeeId: string, checkOutDate: Date) => Promise<void>;
    handleRestoreEmployee: (employee: Employee) => Promise<void>;
    handleDeleteEmployee: (employeeId: string, actorUid: string) => Promise<void>;
    handleRestoreNonEmployee: (nonEmployee: NonEmployee) => Promise<void>;
    handleImportEmployees: (fileContent: string, settings: Settings) => Promise<void>;
    handleImportNonEmployees: (fileContent: string, settings: Settings) => Promise<void>;
    handleDeleteAddressHistory: (historyId: string, actorUid: string) => Promise<void>;
    handleToggleNotificationReadStatus: (notificationId: string, isRead: boolean) => Promise<void>;
    handleMigrateFullNames: () => Promise<void>;
    pushSubscription: string | null;
    setPushSubscription: React.Dispatch<React.SetStateAction<string | null>>;
    handleUpdateCoordinatorSubscription: (token: string | null) => Promise<void>;
};

type RefreshDataResult = {
    employees: Employee[];
    nonEmployees: NonEmployee[];
    bokResidents: BokResident[];
    settings: Settings;
    notifications: Notification[];
    addressHistory: AddressHistory[];
};

const MainLayoutContext = createContext<MainLayoutContextType | null>(null);

export const useMainLayout = () => {
    const context = useContext(MainLayoutContext);
    if (!context) {
        throw new Error('useMainLayout must be used within a MainLayout');
    }
    return context;
};

export default function MainLayout({
  initialSession,
  children
}: {
  initialSession: SessionData;
  children: React.ReactNode;
}) {
    const router = useRouter();
    const routerRef = useRef(router);
    const searchParams = useSearchParams();
    
    const navItems = useMemo(() => [
        { view: 'dashboard', icon: Home, label: 'Pulpit' },
        { view: 'employees', icon: Users, label: 'Mieszkańcy' },
        { view: 'housing', icon: Building, label: 'Zakwaterowanie' },
        { view: 'settings', icon: SettingsIcon, label: 'Ustawienia' },
    ], [])  as { view: View; icon: React.ElementType; label: string }[];

    const activeView = useMemo(() => {
        return (searchParams.get('view') as View) || 'dashboard';
    }, [searchParams]);

    const editEntityId = searchParams.get('edit');

    const [currentUser] = useState<SessionData | null>(initialSession);
    const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
    
    const [rawEmployees, setRawEmployees] = useState<Employee[] | null>(null);
    const [rawNonEmployees, setRawNonEmployees] = useState<NonEmployee[] | null>(null);
    const [rawBokResidents, setRawBokResidents] = useState<BokResident[] | null>(null);
    const [rawSettings, setRawSettings] = useState<Settings | null>(null);
    const [addressHistory, setAddressHistory] = useState<AddressHistory[] | null>(null);

    const [pushSubscription, setPushSubscription] = useState<string | null>(null);

    const [hasNewCheckouts, setHasNewCheckouts] = useState(false);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isNonEmployeeFormOpen, setIsNonEmployeeFormOpen] = useState(false);
    const [isBokResidentFormOpen, setIsBokResidentFormOpen] = useState(false);
    const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
    
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [editingNonEmployee, setEditingNonEmployee] = useState<NonEmployee | null>(null);
    const [editingBokResident, setEditingBokResident] = useState<BokResident | null>(null);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const [initialEmployeeData, setInitialEmployeeData] = useState<Partial<EmployeeFormData>>({});
    
    const [selectedCoordinatorId, _setSelectedCoordinatorId] = useState(initialSession.isAdmin ? 'all' : initialSession.uid);
    
    const { toast } = useToast();

    const filteredData = useMemo(() => {
        if (!rawEmployees || !rawNonEmployees || !rawBokResidents || !rawSettings || !currentUser) {
            return { employees: null, nonEmployees: null, bokResidents: null, settings: rawSettings, addressHistory: addressHistory };
        }

        const coordinator = rawSettings.coordinators.find(c => c.uid === selectedCoordinatorId);
        const shouldFilter = !currentUser.isAdmin || (currentUser.isAdmin && selectedCoordinatorId !== 'all');
        const isStrict = shouldFilter && coordinator?.visibilityMode === 'strict';

        if (!shouldFilter) {
            return { employees: rawEmployees, nonEmployees: rawNonEmployees, bokResidents: rawBokResidents, settings: rawSettings, addressHistory: addressHistory };
        }
        
        if (!coordinator) {
            return { employees: [], nonEmployees: [], bokResidents: [], settings: { ...rawSettings, addresses: [] }, addressHistory: [] };
        }

        let employees: Employee[];
        let nonEmployees: NonEmployee[];
        let bokResidents: BokResident[];
        let filteredAddresses = rawSettings.addresses;
        
        if (isStrict) {
            employees = rawEmployees.filter(e => e.coordinatorId === selectedCoordinatorId);
            nonEmployees = rawNonEmployees.filter(ne => ne.coordinatorId === selectedCoordinatorId);
            bokResidents = rawBokResidents.filter(b => b.coordinatorId === selectedCoordinatorId);
            filteredAddresses = rawSettings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId));
        } else { // department mode
            const coordinatorAddresses = new Set(rawSettings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId)).map(a => a.name));
            const coordinatorDepartments = new Set(coordinator.departments || []);
            
            employees = rawEmployees.filter(e => {
                const livesInCoordinatorsAddress = e.address && coordinatorAddresses.has(e.address);
                const worksInCoordinatorsDepartment = e.zaklad && coordinatorDepartments.has(e.zaklad);
                return livesInCoordinatorsAddress || worksInCoordinatorsDepartment;
            });

            nonEmployees = rawNonEmployees.filter(ne => ne.address && coordinatorAddresses.has(ne.address));
            bokResidents = rawBokResidents.filter(b => b.coordinatorId === selectedCoordinatorId); // BOK residents filter logic (assuming similar to others, mainly by coordinator)
            filteredAddresses = rawSettings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId));
        }

        const settings = {
            ...rawSettings,
            addresses: filteredAddresses,
        };

        const employeeIds = new Set(employees.map(e => e.id));
        const filteredHistory = addressHistory?.filter(h => employeeIds.has(h.employeeId));


        return { employees, nonEmployees, bokResidents, settings, addressHistory: filteredHistory || [] };

    }, [rawEmployees, rawNonEmployees, rawBokResidents, rawSettings, addressHistory, currentUser, selectedCoordinatorId]);

    const { employees: allEmployees, nonEmployees: allNonEmployees, bokResidents: allBokResidents, settings } = filteredData;
    
    const setSelectedCoordinatorId = useCallback((value: React.SetStateAction<string>) => {
        _setSelectedCoordinatorId(value);
    }, []);

    const visibleNavItems = useMemo(() => {
        if (currentUser?.isAdmin) {
            return navItems;
        }
        return navItems.filter(item => item.view !== 'settings');
    }, [currentUser, navItems]);

    const handleLogout = useCallback(async () => {
        await logout();
        routerRef.current.push('/');
    }, []);

    const handleNotificationClick = useCallback(async (notification: Notification) => {
        const entityId = notification.entityId;
        const pathname = window.location.pathname;
        if (entityId) {
             const currentSearchParams = new URLSearchParams(window.location.search);
             currentSearchParams.set('view', 'employees');
             currentSearchParams.set('edit', entityId);
             routerRef.current.push(`${pathname}?${currentSearchParams.toString()}`);
        }
    }, []);

    const handleToggleNotificationReadStatus = useCallback(async (notificationId: string, isRead: boolean) => {
        const originalNotifications = allNotifications;
        setAllNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead } : n));
        try {
            await updateNotificationReadStatus(notificationId, isRead);
        } catch (e: unknown) {
            setAllNotifications(originalNotifications);
            toast({ variant: "destructive", title: "Błąd", description: "Nie udało się zaktualizować statusu powiadomienia." });
        }
    }, [allNotifications, toast]);

     const handleClearNotifications = useCallback(async () => {
        if (!currentUser?.isAdmin) {
             toast({ variant: "destructive", title: "Błąd uprawnień", description: "Tylko administratorzy mogą wykonać tę akcję." });
             return;
        }
        try {
            await clearAllNotifications();
            setAllNotifications([]);
            toast({ title: "Sukces", description: "Wszystkie powiadomienia zostały usunięte." });
        } catch (e) {
             toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć powiadomienia." });
        }
    }, [currentUser, toast]);

    const handleDeleteNotification = useCallback(async (notificationId: string) => {
        const originalNotifications = allNotifications;
        setAllNotifications(prev => prev.filter(n => n.id !== notificationId));

        try {
            await deleteNotification(notificationId);
            toast({ title: "Sukces", description: "Powiadomienie zostało usunięte." });
        } catch (e: unknown) {
            setAllNotifications(originalNotifications); // Revert
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć powiadomienia." });
        }
    }, [allNotifications, toast]);

    const refreshData = useCallback(async (showToast = true) => {
        if (!currentUser) return;
        try {
            // Fetch critical data first
            const data = await getAllSheetsData(currentUser.uid, currentUser.isAdmin);
            setRawSettings(data.settings);
            setAllNotifications(data.notifications);
            setRawNonEmployees(data.nonEmployees);
            setRawBokResidents(data.bokResidents);
            setRawEmployees(data.employees);
            setAddressHistory(data.addressHistory);

            if (currentUser.isAdmin) {
                const allActive = [...(data.employees || []).filter(e => e.status === 'active'), ...(data.nonEmployees || [])];
                const upcoming = allActive
                    .filter(o => {
                        if (!o.checkOutDate) return false;
                        const today = new Date();
                        const date = parseISO(o.checkOutDate);
                        const diff = differenceInDays(date, today);
                        return diff >= 0 && diff <= 30;
                    })
                    .map(o => o.id);

                const storedUpcoming = localStorage.getItem('upcomingCheckouts');
                const storedUpcomingIds = storedUpcoming ? JSON.parse(storedUpcoming) : [];
                
                if (JSON.stringify(upcoming.sort()) !== JSON.stringify(storedUpcomingIds.sort())) {
                    setHasNewCheckouts(true);
                }
            }
            
            if(showToast) {
                toast({ title: "Sukces", description: "Dane zostały odświeżone." });
            }
            return data;
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Błąd krytyczny ładowania danych",
                description: `Nie udało się pobrać podstawowych danych z serwera. ${error instanceof Error ? error.message : ''}`,
            });
        }
    }, [currentUser, toast]);

    const handleRefreshStatuses = useCallback(async (showNoChangesToast = false) => {
        try {
            const { updated } = await checkAndUpdateStatuses(currentUser?.uid);
            if (updated > 0) {
                toast({ title: "Sukces", description: `Zaktualizowano statusy dla ${updated} osób.` });
                await refreshData(false);
            } else if (showNoChangesToast) {
                 toast({ title: "Brak zmian", description: "Wszyscy mają aktualne statusy."});
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się odświeżyć statusów." });
        }
    }, [refreshData, toast, currentUser]);

    const handleUpdateCoordinatorSubscription = useCallback(async (token: string | null) => {
        if (!currentUser) return;
        try {
            await updateCoordinatorSubscription(currentUser.uid, token);
        } catch (e) {
            console.error("Failed to update coordinator subscription:", e);
            toast({ variant: "destructive", title: "Błąd", description: "Nie udało się zaktualizować subskrypcji powiadomień." });
        }
    }, [currentUser, toast]);

    useEffect(() => {
        if (currentUser) {
            refreshData(false);
            const intervalId = setInterval(() => {
                 handleRefreshStatuses(false);
            }, 5 * 60 * 1000); // every 5 minutes
            
            return () => clearInterval(intervalId);
        }
    }, [currentUser, refreshData, handleRefreshStatuses]);

    useEffect(() => {
        const pathname = window.location.pathname;
        // Wait for all data sources to be loaded to avoid missing an entity that hasn't loaded yet
        if (editEntityId && rawEmployees && rawNonEmployees && rawBokResidents) {
            const allPeople = [...rawEmployees, ...rawNonEmployees, ...rawBokResidents];
            const entityToEdit = allPeople.find(e => e.id === editEntityId);
            if (entityToEdit) {
                if ('zaklad' in entityToEdit && !('role' in entityToEdit)) {
                    setEditingEmployee(entityToEdit as Employee);
                    setIsFormOpen(true);
                } else if ('role' in entityToEdit) {
                    setEditingBokResident(entityToEdit as BokResident);
                    setIsBokResidentFormOpen(true);
                } else {
                    setEditingNonEmployee(entityToEdit as NonEmployee);
                    setIsNonEmployeeFormOpen(true);
                }
            }
            
            const currentSearchParams = new URLSearchParams(window.location.search);
            currentSearchParams.delete('edit');
            routerRef.current.replace(`${pathname}?${currentSearchParams.toString()}`, { scroll: false });
        }
    }, [editEntityId, rawEmployees, rawNonEmployees, rawBokResidents]);

    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'add' && activeView === 'employees') {
            const firstName = searchParams.get('firstName') || '';
            const lastName = searchParams.get('lastName') || '';
            const nationality = searchParams.get('nationality') || '';
            const zaklad = searchParams.get('zaklad') || '';
            
            setInitialEmployeeData({
                firstName,
                lastName,
                nationality,
                zaklad,
            });
            setEditingEmployee(null);
            setEditingNonEmployee(null);
            setIsFormOpen(true);
            
            const currentSearchParams = new URLSearchParams(window.location.search);
            currentSearchParams.delete('action');
            currentSearchParams.delete('firstName');
            currentSearchParams.delete('lastName');
            currentSearchParams.delete('nationality');
            currentSearchParams.delete('zaklad');
            routerRef.current.replace(`${window.location.pathname}?${currentSearchParams.toString()}`, { scroll: false });
        }
    }, [searchParams, activeView]);

    const handleSaveEmployee = useCallback(async (data: EmployeeFormData) => {
        if (!currentUser) return;
        
        try {
            if (editingEmployee) {
                const updatedData: Partial<Employee> = { ...data };
                await updateEmployee(editingEmployee.id, updatedData, currentUser.uid)
                toast({ title: "Sukces", description: "Dane pracownika zostały zaktualizowane." });
                await refreshData(false);
            } else {
                const newEmployee = await addEmployee(data, currentUser.uid);
                const refreshedData = await refreshData(false);
                if (!refreshedData) return;
                const wasAdded = refreshedData.employees.some((e: Employee) => e.id === newEmployee.id);
                if (wasAdded) {
                    toast({ title: "Sukces", description: "Nowy pracownik został dodany." });
                } else {
                    toast({ variant: "destructive", title: "Błąd zapisu", description: "Osoba nie została dodana, proszę poinformować administratora." });
                }
            }
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zapisać pracownika." });
        }
    }, [currentUser, editingEmployee, refreshData, toast]);

    const handleSaveNonEmployee = useCallback(async (data: Omit<NonEmployee, 'id' | 'status'>) => {
        if (!currentUser) return;
        try {
            if (editingNonEmployee) {
                await updateNonEmployee(editingNonEmployee.id, data, currentUser.uid);
                toast({ title: "Sukces", description: "Dane mieszkańca zostały zaktualizowane." });
                await refreshData(false);
            } else {
                 const newNonEmployee = await addNonEmployee(data, currentUser.uid);
                 const refreshedData = await refreshData(false);
                 if (!refreshedData) return;
                 const wasAdded = refreshedData.nonEmployees.some((ne: NonEmployee) => ne.id === newNonEmployee.id);
                 if(wasAdded) {
                    toast({ title: "Sukces", description: "Nowy mieszkaniec został dodany." });
                 } else {
                    toast({ variant: "destructive", title: "Błąd zapisu", description: "Osoba nie została dodana, proszę poinformować administratora." });
                 }
            }
        } catch(e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zapisać mieszkańca." });
        }
    }, [editingNonEmployee, currentUser, refreshData, toast]);

    const handleSaveBokResident = useCallback(async (data: BokResidentFormData) => {
        if (!currentUser) return;
        try {
            if (editingBokResident) {
                await updateBokResident(editingBokResident.id, data, currentUser.uid);
                toast({ title: "Sukces", description: "Dane mieszkańca BOK zostały zaktualizowane." });
                await refreshData(false);
            } else {
                 const newResidentData = {
                     ...data,
                     checkOutDate: data.checkOutDate ?? null,
                     returnStatus: data.returnStatus ?? '',
                     zaklad: data.zaklad ?? '',
                     status: data.status ?? '',
                     fullName: `${data.lastName} ${data.firstName}`.trim(),
                 };
                 const newResident = await addBokResident(newResidentData, currentUser.uid);
                 const refreshedData = await refreshData(false);
                 if (!refreshedData) return;
                 const wasAdded = refreshedData.bokResidents.some((b: BokResident) => b.id === newResident.id);
                 if(wasAdded) {
                    toast({ title: "Sukces", description: "Nowy mieszkaniec BOK został dodany." });
                    
                    if (newResidentData.coordinatorId) {
                        const link = `/dashboard?view=employees&action=add&firstName=${encodeURIComponent(newResidentData.firstName)}&lastName=${encodeURIComponent(newResidentData.lastName)}&nationality=${encodeURIComponent(newResidentData.nationality)}&zaklad=${encodeURIComponent(newResidentData.zaklad || '')}`;
                        await sendPushNotification(
                            newResidentData.coordinatorId,
                            'Nowe zadanie: Dodaj pracownika',
                            `Mieszkaniec BOK: ${newResidentData.lastName} ${newResidentData.firstName} - kliknij, aby dodać.`,
                            link
                        );
                    }
                 } else {
                    toast({ variant: "destructive", title: "Błąd zapisu", description: "Osoba nie została dodana, proszę poinformować administratora." });
                 }
            }
        } catch(e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zapisać mieszkańca BOK." });
        }
    }, [editingBokResident, currentUser, refreshData, toast]);
    
    const handleDeleteNonEmployee = useCallback(async (id: string, actorUid: string) => {
        if (!currentUser) return;
        try {
            await deleteNonEmployee(id, actorUid);
            await refreshData(false);
        } catch(e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć mieszkańca." });
        }
    }, [currentUser, refreshData, toast]);

    const handleDeleteBokResident = useCallback(async (id: string, actorUid: string) => {
        if (!currentUser) return;
        try {
            await deleteBokResident(id, actorUid);
            await refreshData(false);
        } catch(e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć mieszkańca BOK." });
        }
    }, [currentUser, refreshData, toast]);
    
    const handleUpdateSettings = useCallback(async (newSettings: Partial<Settings>) => {
        if (!rawSettings || !currentUser?.isAdmin) {
             toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administrator może zmieniać ustawienia." });
            return;
        }

        const originalSettings = rawSettings;
        setRawSettings(prev => ({ ...prev!, ...newSettings }));

        try {
            await updateSettings(newSettings);
            toast({ title: "Sukces", description: "Ustawienia zostały zaktualizowane." });
            await refreshData(false);
        } catch(e) {
            setRawSettings(originalSettings); // Revert on error
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zapisać ustawień." });
        }
    }, [rawSettings, currentUser, toast, refreshData]);

    const handleAddEmployeeClick = useCallback(() => {
        setEditingEmployee(null);
        setEditingNonEmployee(null);
        setIsFormOpen(true);
    }, []);

    const handleAddNonEmployeeClick = useCallback(() => {
        setEditingEmployee(null);
        setEditingNonEmployee(null);
        setIsNonEmployeeFormOpen(true);
    }, []);

    const handleAddBokResidentClick = useCallback(() => {
        setEditingBokResident(null);
        setIsBokResidentFormOpen(true);
    }, []);

    const handleEditEmployeeClick = useCallback((employee: Employee) => {
        setEditingEmployee(employee);
        setIsFormOpen(true);
    }, []);

    const handleEditNonEmployeeClick = useCallback((nonEmployee: NonEmployee) => {
      setEditingNonEmployee(nonEmployee);
      setIsNonEmployeeFormOpen(true);
    }, []);

    const handleEditBokResidentClick = useCallback((resident: BokResident) => {
        setEditingBokResident(resident);
        setIsBokResidentFormOpen(true);
    }, []);

    const handleAddressFormOpen = useCallback((address: Address | null) => {
        setEditingAddress(address);
        setIsAddressFormOpen(true);
    }, []);

    const handleSaveAddress = useCallback((addressData: Address) => {
        if (!rawSettings) return;
        const newAddresses = [...rawSettings.addresses];
        const addressIndex = newAddresses.findIndex(a => a.id === addressData.id);

        if (addressIndex > -1) {
            newAddresses[addressIndex] = addressData;
        } else {
            newAddresses.push(addressData);
        }
        handleUpdateSettings({ addresses: newAddresses });
    }, [rawSettings, handleUpdateSettings]);

    const handleBulkDeleteEmployees = useCallback(async (_entityType: 'employee' | 'non-employee', status: 'active' | 'dismissed') => {
        if (!currentUser || !currentUser.isAdmin) {
            toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administratorzy mogą wykonać tę akcję." });
            return false;
        }
        
        try {
            await bulkDeleteEmployees(status, currentUser.uid);
            toast({ title: "Sukces", description: `Wszyscy ${status === 'active' ? 'aktywni' : 'zwolnieni'} pracownicy zostali usunięci.` });
            await refreshData(false);
            return true;
        } catch(e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć pracowników." });
            return false;
        }
    }, [currentUser, refreshData, toast]);

    const handleBulkDeleteEmployeesByCoordinator = useCallback(async (coordinatorId: string) => {
        if (!currentUser || !currentUser.isAdmin) {
            toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administratorzy mogą wykonać tę akcję." });
            return false;
        }
        
        try {
            await bulkDeleteEmployeesByCoordinator(coordinatorId, currentUser.uid);
            toast({ title: "Sukces", description: `Wszyscy pracownicy wybranego koordynatora zostali usunięci.` });
            await refreshData(false);
            return true;
        } catch(e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć pracowników." });
            return false;
        }
    }, [currentUser, refreshData, toast]);

    const handleBulkDeleteEmployeesByDepartment = useCallback(async (department: string) => {
        if (!currentUser || !currentUser.isAdmin) {
            toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administratorzy mogą wykonać tę akcję." });
            return false;
        }
        
        try {
            await bulkDeleteEmployeesByDepartment(department, currentUser.uid);
            toast({ title: "Sukces", description: `Wszyscy pracownicy z zakładu "${department}" zostali usunięci.` });
            await refreshData(false);
            return true;
        } catch(e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć pracowników." });
            return false;
        }
    }, [currentUser, refreshData, toast]);
    
    const handleDismissEmployee = useCallback(async (employeeId: string, checkOutDate: Date) => {
        if (!currentUser) return;
        try {
            await updateEmployee(employeeId, { status: 'dismissed', checkOutDate: format(checkOutDate, 'yyyy-MM-dd') }, currentUser.uid);
            toast({ title: "Sukces", description: "Pracownik został zwolniony." });
            await refreshData(false);
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zwolnić pracownika." });
        }
    }, [currentUser, refreshData, toast]);

    const handleDismissNonEmployee = useCallback(async (nonEmployeeId: string, checkOutDate: Date) => {
        if (!currentUser) return;
        try {
            await updateNonEmployee(nonEmployeeId, { status: 'dismissed', checkOutDate: format(checkOutDate, 'yyyy-MM-dd') }, currentUser.uid);
            toast({ title: "Sukces", description: "Mieszkaniec został zwolniony." });
            await refreshData(false);
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zwolnić mieszkańca." });
        }
    }, [currentUser, refreshData, toast]);

    const handleRestoreEmployee = useCallback(async (employee: Employee) => {
        if (!currentUser) return;
        try {
            await updateEmployee(employee.id, { status: 'active', checkOutDate: null }, currentUser.uid);
            toast({ title: "Sukces", description: "Pracownik został przywrócony." });
            await refreshData(false);
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się przywrócić pracownika." });
        }
    }, [currentUser, refreshData, toast]);

    const handleRestoreNonEmployee = useCallback(async (nonEmployee: NonEmployee) => {
        if (!currentUser) return;
        try {
            await updateNonEmployee(nonEmployee.id, { status: 'active', checkOutDate: null }, currentUser.uid);
            toast({ title: "Sukces", description: "Mieszkaniec został przywrócony." });
            await refreshData(false);
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się przywrócić mieszkańca." });
        }
    }, [currentUser, refreshData, toast]);
    
    const handleDeleteEmployee = useCallback(async (employeeId: string, actorUid: string) => {
        if (!currentUser) return;
        try {
            await deleteEmployee(employeeId, actorUid);
            await refreshData(false);
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć pracownika." });
        }
    }, [currentUser, refreshData, toast]);

    const handleDeleteAddressHistory = useCallback(async (historyId: string, actorUid: string) => {
        if (!currentUser) return;
        try {
            await deleteAddressHistoryEntry(historyId, actorUid);
            toast({ title: "Sukces", description: "Wpis z historii został usunięty." });
            await refreshData(false);
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć wpisu z historii." });
        }
    }, [currentUser, refreshData, toast]);
    
    const handleImportEmployees = useCallback(async (fileContent: string, settings: Settings) => {
        if (!currentUser) return;
        try {
            const result = await importEmployeesFromExcel(fileContent, currentUser.uid, settings);
            
            let description = `Pomyślnie zaimportowano ${result.importedCount} z ${result.totalRows} wierszy.`;
            if (result.errors.length > 0) {
                description += ` Błędy: ${result.errors.join('; ')}`;
            }
            
            toast({
                title: "Import zakończony",
                description: description,
                duration: result.errors.length > 0 ? 10000 : 5000,
            });
            await refreshData(false);
        } catch (e) {
             toast({
                variant: "destructive",
                title: "Błąd importu",
                description: e instanceof Error ? e.message : 'Nieznany błąd serwera.'
            });
        }
    }, [currentUser, refreshData, toast]);

    const handleImportNonEmployees = useCallback(async (fileContent: string, settings: Settings) => {
        if (!currentUser) return;
        try {
            const result = await importNonEmployeesFromExcel(fileContent, currentUser.uid, settings);
            if (result) {
                let description = `Pomyślnie zaimportowano ${result.importedCount} z ${result.totalRows} wierszy.`;
                if (result.errors.length > 0) {
                    description += ` Błędy: ${result.errors.join('; ')}`;
                }
                
                toast({
                    title: "Import zakończony",
                    description: description,
                    duration: result.errors.length > 0 ? 10000 : 5000,
                });
            }
            await refreshData(false);
        } catch (e) {
            toast({
                variant: "destructive",
                title: "Błąd importu mieszkańców (NZ)",
                description: e instanceof Error ? e.message : 'Nieznany błąd serwera.'
            });
        }
    }, [currentUser, refreshData, toast]);

    const handleMigrateFullNames = useCallback(async () => {
        if (!currentUser) return;
        try {
            const result = await migrateFullNames(currentUser.uid);
            toast({ title: "Sukces", description: `Zmigrowano ${result.migratedEmployees} pracowników i ${result.migratedNonEmployees} mieszkańców.` });
            await refreshData(false);
        } catch (e) {
             toast({
                variant: "destructive",
                title: "Błąd migracji",
                description: e instanceof Error ? e.message : 'Nieznany błąd serwera.'
            });
        }
    }, [currentUser, refreshData, toast]);

    const contextValue: MainLayoutContextType = useMemo(() => ({
        allEmployees,
        allNonEmployees,
        allBokResidents,
        addressHistory: filteredData.addressHistory,
        rawEmployees,
        rawNonEmployees,
        rawBokResidents,
        settings,
        rawSettings,
        currentUser,
        selectedCoordinatorId,
        hasNewCheckouts,
        setHasNewCheckouts,
        setSelectedCoordinatorId,
        handleEditEmployeeClick,
        handleBulkDeleteEmployees,
        handleBulkDeleteEmployeesByCoordinator,
        handleBulkDeleteEmployeesByDepartment,
        handleAddEmployeeClick,
        handleUpdateSettings,
        refreshData,
        handleAddNonEmployeeClick,
        handleEditNonEmployeeClick,
        handleDeleteNonEmployee,
        handleAddBokResidentClick,
        handleEditBokResidentClick,
        handleDeleteBokResident,
        handleRefreshStatuses,
        handleAddressFormOpen,
        handleDismissEmployee,
        handleDismissNonEmployee,
        handleRestoreEmployee,
        handleDeleteEmployee,
        handleRestoreNonEmployee,
        handleImportEmployees,
        handleImportNonEmployees,
        handleDeleteAddressHistory,
        handleToggleNotificationReadStatus,
        handleMigrateFullNames,
        pushSubscription,
        setPushSubscription,
        handleUpdateCoordinatorSubscription,
    } ), [
        allEmployees,
        allNonEmployees,
        allBokResidents,
        filteredData.addressHistory,
        rawEmployees,
        rawNonEmployees,
        rawBokResidents,
        settings,
        rawSettings,
        currentUser,
        selectedCoordinatorId,
        hasNewCheckouts,
        setSelectedCoordinatorId,
        handleEditEmployeeClick,
        handleBulkDeleteEmployees,
        handleBulkDeleteEmployeesByCoordinator,
        handleBulkDeleteEmployeesByDepartment,
        handleAddEmployeeClick,
        handleUpdateSettings,
        refreshData,
        handleAddNonEmployeeClick,
        handleEditNonEmployeeClick,
        handleDeleteNonEmployee,
        handleAddBokResidentClick,
        handleEditBokResidentClick,
        handleDeleteBokResident,
        handleRefreshStatuses,
        handleAddressFormOpen,
        handleDismissEmployee,
        handleDismissNonEmployee,
        handleRestoreEmployee,
        handleDeleteEmployee,
        handleRestoreNonEmployee,
        handleImportEmployees,
        handleImportNonEmployees,
        handleDeleteAddressHistory,
        handleToggleNotificationReadStatus,
        handleMigrateFullNames,
        pushSubscription,
        setPushSubscription,
        handleUpdateCoordinatorSubscription,
    ]);

    if (!settings || !currentUser || !allEmployees || !allNonEmployees) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <HouseLoader />
            </div>
        );
    }

    return (
       <SidebarProvider>
         <MainLayoutContext.Provider value={contextValue}>
            <div className="flex h-screen w-full bg-muted/50">
                <Sidebar>
                    <SidebarHeader>
                         <div className="flex items-center gap-3">
                            <ModernHouseIcon className="h-7 w-7 text-primary" />
                            <span className={cn("font-semibold text-xl whitespace-nowrap transition-all duration-300", "group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0")}>SmartHouse</span>
                        </div>
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarMenu>
                            {visibleNavItems.map(item => (
                                <SidebarMenuItem key={item.view}>
                                    <Link href={`/dashboard?view=${item.view}`} legacyBehavior passHref>
                                        <SidebarMenuButton
                                            isActive={activeView === item.view}
                                            tooltip={item.label}
                                            aria-disabled={item.view === 'settings' && !currentUser?.isAdmin}
                                            tabIndex={item.view === 'settings' && !currentUser?.isAdmin ? -1 : undefined}
                                            className={item.view === 'settings' && !currentUser?.isAdmin ? 'opacity-50 pointer-events-none' : undefined}
                                        >
                                            <item.icon />
                                            <span>{item.label}</span>
                                        </SidebarMenuButton>
                                    </Link>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarContent>
                    <SidebarFooter>
                    </SidebarFooter>
                </Sidebar>
                <div className="flex flex-1 flex-col">
                    {currentUser && <Header 
                        user={currentUser} 
                        activeView={activeView} 
                        notifications={allNotifications}
                        settings={settings}
                        onNotificationClick={handleNotificationClick} 
                        onLogout={handleLogout} 
                        onClearNotifications={handleClearNotifications}
                        onDeleteNotification={handleDeleteNotification}
                        onToggleNotificationReadStatus={handleToggleNotificationReadStatus}
                    />}
                    <main className="flex-1 overflow-y-auto px-2 sm:px-6 pb-20 sm:pb-6 pt-4">
                        {children}
                    </main>
                </div>
                
                {currentUser && <MobileNav activeView={activeView} navItems={visibleNavItems} currentUser={currentUser}/>}
            </div>
            
            {rawSettings && currentUser && (
                 <AddEmployeeForm
                    isOpen={isFormOpen}
                    onOpenChange={setIsFormOpen}
                    onSave={handleSaveEmployee}
                    settings={currentUser.isAdmin ? rawSettings : settings}
                    employee={editingEmployee}
                    initialData={initialEmployeeData}
                    currentUser={currentUser}
                />
            )}
            {rawSettings && currentUser && (
                <AddNonEmployeeForm
                    isOpen={isNonEmployeeFormOpen}
                    onOpenChange={setIsNonEmployeeFormOpen}
                    onSave={(data) => handleSaveNonEmployee(data as Omit<NonEmployee, 'id' | 'status'>)}
                    settings={currentUser.isAdmin ? rawSettings : settings}
                    nonEmployee={editingNonEmployee}
                    currentUser={currentUser}
                />
            )}
            {rawSettings && currentUser && (
                <AddBokResidentForm
                    isOpen={isBokResidentFormOpen}
                    onOpenChange={setIsBokResidentFormOpen}
                    onSave={handleSaveBokResident}
                    settings={currentUser.isAdmin ? rawSettings : settings}
                    resident={editingBokResident}
                    currentUser={currentUser}
                />
            )}
            {rawSettings && currentUser && (
                <AddressForm
                    isOpen={isAddressFormOpen}
                    onOpenChange={setIsAddressFormOpen}
                    onSave={handleSaveAddress}
                    settings={rawSettings}
                    address={editingAddress}
                />
            )}
        </MainLayoutContext.Provider>
        </SidebarProvider>
    );
}

    