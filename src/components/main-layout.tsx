

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
import type { View, Notification, Employee, Settings, NonEmployee, Address, SessionData } from '@/types';
import { Home, Settings as SettingsIcon, Users, Building } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    clearAllNotifications,
    markNotificationAsRead,
    addEmployee,
    updateEmployee,
    updateSettings,
    addNonEmployee,
    updateNonEmployee,
    deleteNonEmployee,
    deleteEmployee,
    checkAndUpdateEmployeeStatuses,
    importEmployeesFromExcel,
    bulkDeleteEmployees,
    deleteNotification,
    bulkDeleteEmployeesByCoordinator,
} from '@/lib/actions';
import { getAllSheetsData } from '@/lib/sheets';
import { logout } from '../lib/auth';
import { useToast } from '../hooks/use-toast';
import { AddEmployeeForm, type EmployeeFormData } from './add-employee-form';
import { AddNonEmployeeForm } from './add-non-employee-form';
import { cn } from '../lib/utils';
import { AddressForm } from './address-form';
import { ModernHouseIcon } from './icons/modern-house-icon';

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
    settings: Settings | null;
    currentUser: SessionData | null;
    selectedCoordinatorId: string;
    setSelectedCoordinatorId: React.Dispatch<React.SetStateAction<string>>;
    handleBulkDeleteEmployees: (entityType: 'employee' | 'non-employee', status: 'active' | 'dismissed') => Promise<boolean>;
    handleBulkDeleteEmployeesByCoordinator: (coordinatorId: string) => Promise<boolean>;
    handleAddEmployeeClick: () => void;
    handleEditEmployeeClick: (employee: Employee) => void;
    handleUpdateSettings: (newSettings: Partial<Settings>) => Promise<void>;
    refreshData: (showToast?: boolean) => Promise<void>;
    handleAddNonEmployeeClick: () => void;
    handleEditNonEmployeeClick: (nonEmployee: NonEmployee) => void;
    handleDeleteNonEmployee: (id: string) => Promise<void>;
    handleRefreshStatuses: (showNoChangesToast?: boolean) => Promise<void>;
    handleAddressFormOpen: (address: Address | null) => void;
    handleDismissEmployee: (employeeId: string) => Promise<void>;
    handleRestoreEmployee: (employeeId: string) => Promise<void>;
    handleDeleteEmployee: (employeeId: string) => Promise<void>;
    handleImportEmployees: (file: File) => Promise<void>;
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
    const [settings, setSettings] = useState<Settings | null>(null);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isNonEmployeeFormOpen, setIsNonEmployeeFormOpen] = useState(false);
    const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
    

    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [editingNonEmployee, setEditingNonEmployee] = useState<NonEmployee | null>(null);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    
    const [selectedCoordinatorId, _setSelectedCoordinatorId] = useState(initialSession.isAdmin ? 'all' : initialSession.uid);
    
    const { toast } = useToast();

    // Filtered data based on selected coordinator
    const allEmployees = useMemo(() => {
        if (!rawEmployees || !currentUser) return null;
        if (currentUser.isAdmin && selectedCoordinatorId === 'all') {
            return rawEmployees;
        }
        return rawEmployees.filter(e => e.coordinatorId === selectedCoordinatorId);
    }, [rawEmployees, currentUser, selectedCoordinatorId]);

    const allNonEmployees = useMemo(() => {
        if (!rawNonEmployees || !settings || !currentUser) return null;
        if (currentUser.isAdmin && selectedCoordinatorId === 'all') {
            return rawNonEmployees;
        }
        return rawNonEmployees.filter(ne => ne.coordinatorId === selectedCoordinatorId);
    }, [rawNonEmployees, settings, currentUser, selectedCoordinatorId]);

    
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


    const filteredNotifications = useMemo(() => {
        if (!currentUser) return [];
        // Admin sees notifications for all coordinators unless a filter is applied in the header
        if (currentUser.isAdmin) {
            return allNotifications;
        }
        // Regular user sees only notifications for their employees
        return allNotifications.filter(n => n.coordinatorId === currentUser.uid);
    }, [currentUser, allNotifications]);

    const refreshData = useCallback(async (showToast = true) => {
        if (!currentUser) return;
        try {
            const {
                employees,
                settings,
                nonEmployees,
                notifications,
            } = await getAllSheetsData();

            setRawEmployees(employees);
            setSettings(settings);
            setRawNonEmployees(nonEmployees);
            setAllNotifications(notifications);
            
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
        if (!currentUser) return;
        try {
            const { updated } = await checkAndUpdateEmployeeStatuses(currentUser.uid);
            if (updated > 0) {
                toast({ title: "Sukces", description: `Zaktualizowano statusy dla ${updated} pracowników.` });
                await refreshData(false);
            } else if (showNoChangesToast) {
                 toast({ title: "Brak zmian", description: "Wszyscy pracownicy mają aktualne statusy."});
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się odświeżyć statusów." });
        }
    }, [currentUser, refreshData, toast]);

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
            const employeeToEdit = rawEmployees?.find(e => e.id === editEntityId);
            if (employeeToEdit) {
                setEditingEmployee(employeeToEdit);
                setIsFormOpen(true);
            } else {
                const nonEmployeeToEdit = rawNonEmployees?.find(e => e.id === editEntityId);
                if (nonEmployeeToEdit) {
                    setEditingNonEmployee(nonEmployeeToEdit);
                    setIsNonEmployeeFormOpen(true);
                }
            }
            
            const currentSearchParams = new URLSearchParams(window.location.search);
            currentSearchParams.delete('edit');
            routerRef.current.replace(`${pathname}?${currentSearchParams.toString()}`, { scroll: false });
        }
    }, [editEntityId, rawEmployees, rawNonEmployees]);

    const handleSaveEmployee = useCallback(async (data: EmployeeFormData) => {
        if (!currentUser || !settings) return;
        
        try {
            if (editingEmployee) {
                const updatedData: Partial<Employee> = { ...data };
                await updateEmployee(editingEmployee.id, updatedData, currentUser.uid)
                toast({ title: "Sukces", description: "Dane pracownika zostały zaktualizowane." });
            } else {
                await addEmployee(data, currentUser.uid, settings);
                toast({ title: "Sukces", description: "Nowy pracownik został dodany." });
            }
            await refreshData(false);
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zapisać pracownika." });
        }
    }, [currentUser, editingEmployee, refreshData, toast, settings]);

    const handleSaveNonEmployee = useCallback(async (data: Omit<NonEmployee, 'id'>) => {
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
    
    const handleDeleteNonEmployee = useCallback(async (id: string) => {
        if (!currentUser) return;
        const originalNonEmployees = rawNonEmployees;
        
        setRawNonEmployees(prev => prev!.filter(ne => ne.id !== id));
        
        try {
            await deleteNonEmployee(id, currentUser.uid);
            toast({ title: "Sukces", description: "Mieszkaniec został usunięty." });
        } catch(e) {
            setRawNonEmployees(originalNonEmployees); // Revert
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć mieszkańca." });
        }
    }, [rawNonEmployees, currentUser, toast]);
    
    const handleUpdateSettings = useCallback(async (newSettings: Partial<Settings>) => {
        if (!settings || !currentUser?.isAdmin) {
             toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administrator może zmieniać ustawienia." });
            return;
        }

        const originalSettings = settings;
        setSettings(prev => ({ ...prev!, ...newSettings }));

        try {
            await updateSettings(newSettings);
            toast({ title: "Sukces", description: "Ustawienia zostały zaktualizowane." });
            await refreshData(false);
        } catch(e) {
            setSettings(originalSettings); // Revert on error
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zapisać ustawień." });
        }
    }, [settings, currentUser, toast, refreshData]);

    const handleAddEmployeeClick = useCallback(() => {
        setEditingEmployee(null);
        setIsFormOpen(true);
    }, []);

    const handleAddNonEmployeeClick = useCallback(() => {
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
        if (!settings) return;
        const newAddresses = [...settings.addresses];
        const addressIndex = newAddresses.findIndex(a => a.id === addressData.id);

        if (addressIndex > -1) {
            newAddresses[addressIndex] = addressData;
        } else {
            newAddresses.push(addressData);
        }
        handleUpdateSettings({ addresses: newAddresses });
    }, [settings, handleUpdateSettings]);

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
    
    const handleDeleteEmployee = useCallback(async (employeeId: string) => {
        if (!currentUser) return;
        try {
            await deleteEmployee(employeeId, currentUser.uid);
            toast({ title: "Sukces", description: "Pracownik został trwale usunięty." });
            await refreshData(false);
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć pracownika." });
        }
    }, [currentUser, refreshData, toast]);
    
    const handleImportEmployees = useCallback(async (file: File) => {
        if (!currentUser || !settings) {
            throw new Error("Brak danych użytkownika lub ustawień do przeprowadzenia importu.");
        }

        const reader = new FileReader();
        const promise = new Promise<string>((resolve, reject) => {
            reader.onload = (e) => {
                const result = e.target?.result;
                if (typeof result === 'string') {
                    const base64 = result.split(',')[1];
                    resolve(base64);
                } else {
                    reject(new Error("Nie udało się odczytać pliku."));
                }
            };
            reader.onerror = (error) => reject(error);
        });
        
        reader.readAsDataURL(file);
        const fileContent = await promise;

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

    }, [currentUser, settings, refreshData, toast]);

    const contextValue: MainLayoutContextType = useMemo(() => ({
        allEmployees,
        allNonEmployees,
        settings,
        currentUser,
        selectedCoordinatorId,
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
        handleImportEmployees,
    } ), [
        allEmployees,
        allNonEmployees,
        settings,
        currentUser,
        selectedCoordinatorId,
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
        handleImportEmployees,
    ]);

    if (!settings || !rawEmployees || !rawNonEmployees) {
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
                        notifications={filteredNotifications}
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
            
            {settings && (
                 <AddEmployeeForm
                    isOpen={isFormOpen}
                    onOpenChange={setIsFormOpen}
                    onSave={handleSaveEmployee}
                    settings={settings}
                    employee={editingEmployee}
                />
            )}
            {settings && currentUser && (
                <AddNonEmployeeForm
                    isOpen={isNonEmployeeFormOpen}
                    onOpenChange={setIsNonEmployeeFormOpen}
                    onSave={(data) => handleSaveNonEmployee(data)}
                    settings={settings}
                    nonEmployee={editingNonEmployee}
                    currentUser={currentUser}
                />
            )}
            {settings && currentUser && (
                <AddressForm
                    isOpen={isAddressFormOpen}
                    onOpenChange={setIsAddressFormOpen}
                    onSave={handleSaveAddress}
                    settings={settings}
                    address={editingAddress}
                />
            )}
        </MainLayoutContext.Provider>
        </SidebarProvider>
    );
}
