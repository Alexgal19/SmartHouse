

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
import type { View, Notification, Employee, Settings, Address, SessionData, NonEmployee, Coordinator } from '@/types';
import { Home, Settings as SettingsIcon, Users, Building } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    addEmployee,
    addNonEmployee,
    bulkDeleteEmployees,
    bulkDeleteEmployeesByCoordinator,
    checkAndUpdateStatuses,
    clearAllNotifications,
    deleteEmployee,
    deleteNonEmployee,
    importEmployeesFromExcel,
    importNonEmployeesFromExcel,
    markNotificationAsRead,
    updateEmployee,
    updateNonEmployee,
    updateSettings,
    deleteNotification
} from '@/lib/actions';
import { getAllSheetsData } from '@/lib/sheets';
import { logout } from '../lib/auth';
import { useToast } from '../hooks/use-toast';
import { AddEmployeeForm, type EmployeeFormData } from './add-employee-form';
import { AddNonEmployeeForm } from './add-non-employee-form';
import { cn } from '../lib/utils';
import { AddressForm } from './address-form';
import { ModernHouseIcon } from './icons/modern-house-icon';
import { differenceInDays, parseISO } from 'date-fns';

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
    rawEmployees: Employee[] | null;
    rawNonEmployees: NonEmployee[] | null;
    settings: Settings | null;
    rawSettings: Settings | null;
    currentUser: SessionData | null;
    selectedCoordinatorId: string;
    hasNewCheckouts: boolean;
    setHasNewCheckouts: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedCoordinatorId: React.Dispatch<React.SetStateAction<string>>;
    handleBulkDeleteEmployees: (entityType: 'employee' | 'non-employee', status: 'active' | 'dismissed') => Promise<boolean>;
    handleBulkDeleteEmployeesByCoordinator: (coordinatorId: string) => Promise<boolean>;
    handleAddEmployeeClick: () => void;
    handleEditEmployeeClick: (employee: Employee) => void;
    handleUpdateSettings: (newSettings: Partial<Settings>) => Promise<void>;
    refreshData: (showToast?: boolean) => Promise<void>;
    handleAddNonEmployeeClick: () => void;
    handleEditNonEmployeeClick: (nonEmployee: NonEmployee) => void;
    handleDeleteNonEmployee: (id: string, actorUid: string) => Promise<void>;
    handleRefreshStatuses: (showNoChangesToast?: boolean) => Promise<void>;
    handleAddressFormOpen: (address: Address | null) => void;
    handleDismissEmployee: (employeeId: string) => Promise<void>;
    handleRestoreEmployee: (employeeId: string) => Promise<void>;
    handleDeleteEmployee: (employeeId: string, actorUid: string) => Promise<void>;
    handleRestoreNonEmployee: (nonEmployeeId: string) => Promise<void>;
    handleImportEmployees: (fileContent: string) => Promise<void>;
    handleImportNonEmployees: (fileContent: string) => Promise<void>;
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
    const [rawSettings, setRawSettings] = useState<Settings | null>(null);
    const [hasNewCheckouts, setHasNewCheckouts] = useState(false);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isNonEmployeeFormOpen, setIsNonEmployeeFormOpen] = useState(false);
    const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
    
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [editingNonEmployee, setEditingNonEmployee] = useState<NonEmployee | null>(null);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    
    const [selectedCoordinatorId, _setSelectedCoordinatorId] = useState(initialSession.isAdmin ? 'all' : initialSession.uid);
    
    const { toast } = useToast();

    const filteredData = useMemo(() => {
        if (!rawEmployees || !rawNonEmployees || !rawSettings || !currentUser) {
            return { employees: null, nonEmployees: null, settings: rawSettings };
        }

        const shouldFilter = !currentUser.isAdmin || (currentUser.isAdmin && selectedCoordinatorId !== 'all');

        if (!shouldFilter) {
            return { employees: rawEmployees, nonEmployees: rawNonEmployees, settings: rawSettings };
        }
        
        const coordinator = rawSettings.coordinators.find(c => c.uid === selectedCoordinatorId);
        if (!coordinator) {
            return { employees: [], nonEmployees: [], settings: { ...rawSettings, addresses: [] } };
        }
        
        const coordinatorAddresses = new Set(rawSettings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId)).map(a => a.name));
        const coordinatorDepartments = new Set(coordinator.departments || []);

        const employees = rawEmployees.filter(e => {
            const livesInCoordinatorsAddress = e.address && coordinatorAddresses.has(e.address);
            const worksInCoordinatorsDepartment = e.zaklad && coordinatorDepartments.has(e.zaklad);
            return livesInCoordinatorsAddress || worksInCoordinatorsDepartment;
        });

        const nonEmployees = rawNonEmployees.filter(ne => ne.address && coordinatorAddresses.has(ne.address));
        
        const settings = {
            ...rawSettings,
            addresses: rawSettings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId)),
        };

        return { employees, nonEmployees, settings };

    }, [rawEmployees, rawNonEmployees, rawSettings, currentUser, selectedCoordinatorId]);

    const { employees: allEmployees, nonEmployees: allNonEmployees, settings } = filteredData;
    
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
        
        if (!notification.isRead) {
            setAllNotifications(prev => prev.map(n => n.id === notification.id ? {...n, isRead: true} : n));
            await markNotificationAsRead(notification.id);
        }
    }, []);

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
            const { settings, notifications, nonEmployees, employees } = await getAllSheetsData(currentUser.uid, currentUser.isAdmin);
            setRawSettings(settings);
            setAllNotifications(notifications);
            setRawNonEmployees(nonEmployees);
            setRawEmployees(employees);

            if (currentUser.isAdmin) {
                const allActive = [...(employees || []).filter(e => e.status === 'active'), ...(nonEmployees || [])];
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
            const { updated } = await checkAndUpdateStatuses();
            if (updated > 0) {
                toast({ title: "Sukces", description: `Zaktualizowano statusy dla ${updated} osób.` });
                await refreshData(false);
            } else if (showNoChangesToast) {
                 toast({ title: "Brak zmian", description: "Wszyscy mają aktualne statusy."});
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się odświeżyć statusów." });
        }
    }, [refreshData, toast]);

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
        if (editEntityId && (rawEmployees || rawNonEmployees)) {
            const allPeople = [...(rawEmployees || []), ...(rawNonEmployees || [])];
            const entityToEdit = allPeople.find(e => e.id === editEntityId);
            if (entityToEdit) {
                if ('zaklad' in entityToEdit) {
                    setEditingEmployee(entityToEdit);
                    setIsFormOpen(true);
                } else {
                    setEditingNonEmployee(entityToEdit as NonEmployee);
                    setIsNonEmployeeFormOpen(true);
                }
            }
            
            const currentSearchParams = new URLSearchParams(window.location.search);
            currentSearchParams.delete('edit');
            routerRef.current.replace(`${pathname}?${currentSearchParams.toString()}`, { scroll: false });
        }
    }, [editEntityId, rawEmployees, rawNonEmployees]);

    const handleSaveEmployee = useCallback(async (data: EmployeeFormData) => {
        if (!currentUser) return;
        
        try {
            if (editingEmployee) {
                const updatedData: Partial<Employee> = { ...data };
                await updateEmployee(editingEmployee.id, updatedData, currentUser.uid)
                toast({ title: "Sukces", description: "Dane pracownika zostały zaktualizowane." });
            } else {
                await addEmployee(data, currentUser.uid);
                toast({ title: "Sukces", description: "Nowy pracownik został dodany." });
            }
            await refreshData(false);
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zapisać pracownika." });
        }
    }, [currentUser, editingEmployee, refreshData, toast]);

    const handleSaveNonEmployee = useCallback(async (data: Omit<NonEmployee, 'id' | 'status'>) => {
        if (!currentUser) return;
        if (editingNonEmployee) {
            try {
                await updateNonEmployee(editingNonEmployee.id, data, currentUser.uid);
                toast({ title: "Sukces", description: "Dane mieszkańca zostały zaktualizowane." });
            } catch(e) {
                toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zapisać mieszkańca." });
            }
        } else {
             try {
                await addNonEmployee(data, currentUser.uid);
                toast({ title: "Sukces", description: "Nowy mieszkaniec został dodany." });
            } catch (e) {
                toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się dodać mieszkańca." });
            }
        }
        await refreshData(false);
    }, [editingNonEmployee, currentUser, refreshData, toast]);
    
    const handleDeleteNonEmployee = useCallback(async (id: string, actorUid: string) => {
        if (!currentUser) return;
        try {
            await deleteNonEmployee(id, actorUid);
            toast({ title: "Sukces", description: "Mieszkaniec został usunięty." });
            await refreshData(false);
        } catch(e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć mieszkańca." });
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

    const handleEditEmployeeClick = useCallback((employee: Employee) => {
        setEditingEmployee(employee);
        setIsFormOpen(true);
    }, []);

    const handleEditNonEmployeeClick = useCallback((nonEmployee: NonEmployee) => {
      setEditingNonEmployee(nonEmployee);
      setIsNonEmployeeFormOpen(true);
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
    
    const handleDismissEmployee = useCallback(async (employeeId: string) => {
        if (!currentUser) return;
        try {
            await updateEmployee(employeeId, { status: 'dismissed' }, currentUser.uid);
            toast({ title: "Sukces", description: "Pracownik został zwolniony." });
            await refreshData(false);
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zwolnić pracownika." });
        }
    }, [currentUser, refreshData, toast]);

    const handleRestoreEmployee = useCallback(async (employeeId: string) => {
        if (!currentUser) return;
        try {
            await updateEmployee(employeeId, { status: 'active' }, currentUser.uid);
            toast({ title: "Sukces", description: "Pracownik został przywrócony." });
            await refreshData(false);
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się przywrócić pracownika." });
        }
    }, [currentUser, refreshData, toast]);

    const handleRestoreNonEmployee = useCallback(async (nonEmployeeId: string) => {
        if (!currentUser) return;
        try {
            await updateNonEmployee(nonEmployeeId, { status: 'active' }, currentUser.uid);
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
            toast({ title: "Sukces", description: "Pracownik został trwale usunięty." });
            await refreshData(false);
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć pracownika." });
        }
    }, [currentUser, refreshData, toast]);
    
    const handleImportEmployees = useCallback(async (fileContent: string) => {
        if (!currentUser) return;
        try {
            const result = await importEmployeesFromExcel(fileContent, currentUser.uid);
            
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

    const handleImportNonEmployees = useCallback(async (fileContent: string) => {
        if (!currentUser) return;
        try {
            const result = await importNonEmployeesFromExcel(fileContent, currentUser.uid);
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
                title: "Błąd importu mieszkańców (NZ)",
                description: e instanceof Error ? e.message : 'Nieznany błąd serwera.'
            });
        }
    }, [currentUser, refreshData, toast]);

    const contextValue: MainLayoutContextType = useMemo(() => ({
        allEmployees,
        allNonEmployees,
        rawEmployees,
        rawNonEmployees,
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
        handleAddEmployeeClick,
        handleUpdateSettings,
        refreshData,
        handleAddNonEmployeeClick,
        handleEditNonEmployeeClick,
        handleDeleteNonEmployee,
        handleRefreshStatuses,
        handleAddressFormOpen,
        handleDismissEmployee,
        handleRestoreEmployee,
        handleDeleteEmployee,
        handleRestoreNonEmployee,
        handleImportEmployees,
        handleImportNonEmployees,
    } ), [
        allEmployees,
        allNonEmployees,
        rawEmployees,
        rawNonEmployees,
        settings,
        rawSettings,
        currentUser,
        selectedCoordinatorId,
        hasNewCheckouts,
        setSelectedCoordinatorId,
        handleEditEmployeeClick,
        handleBulkDeleteEmployees,
        handleBulkDeleteEmployeesByCoordinator,
        handleAddEmployeeClick,
        handleUpdateSettings,
        refreshData,
        handleAddNonEmployeeClick,
        handleEditNonEmployeeClick,
        handleDeleteNonEmployee,
        handleRefreshStatuses,
        handleAddressFormOpen,
        handleDismissEmployee,
        handleRestoreEmployee,
        handleDeleteEmployee,
        handleRestoreNonEmployee,
        handleImportEmployees,
        handleImportNonEmployees,
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
                                    <Link href={`/dashboard?view=${item.view}`}>
                                        <SidebarMenuButton
                                            isActive={activeView === item.view}
                                            tooltip={item.label}
                                            aria-disabled={item.view === 'settings' && !currentUser?.isAdmin}
                                            tabIndex={item.view === 'settings' && !currentUser?.isAdmin ? -1 : undefined}
                                            className={item.view === 'settings' && !currentUser?.isAdmin ? 'opacity-50 pointer-events-none' : undefined}
                                        >
                                            <item.icon />
                                            <span>{item.label}</span>
                                        </SidebarMenuButton>  </Link>
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
                    />}
                    <main className="flex-1 overflow-y-auto px-2 sm:px-6 pb-20 sm:pb-6 pt-4">
                        {children}
                    </main>
                </div>
                
                {currentUser && <MobileNav activeView={activeView} navItems={visibleNavItems} currentUser={currentUser}/>}
            </div>
            
            {settings && currentUser && (
                 <AddEmployeeForm
                    isOpen={isFormOpen}
                    onOpenChange={setIsFormOpen}
                    onSave={handleSaveEmployee}
                    settings={settings}
                    employee={editingEmployee}
                    currentUser={currentUser}
                />
            )}
            {settings && currentUser && (
                <AddNonEmployeeForm
                    isOpen={isNonEmployeeFormOpen}
                    onOpenChange={setIsNonEmployeeFormOpen}
                    onSave={(data) => handleSaveNonEmployee(data as Omit<NonEmployee, 'id' | 'status'>)}
                    settings={settings}
                    nonEmployee={editingNonEmployee}
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
