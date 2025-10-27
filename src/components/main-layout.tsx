
"use client";

import React, { useState, useEffect, useMemo, useCallback, createContext, useContext, useRef } from 'react';
import Link from 'next/link';
import {
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarFooter,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarProvider
} from './ui/sidebar';
import Header from './header';
import { MobileNav } from './mobile-nav';
import type { View, Notification, Employee, Settings, NonEmployee, Inspection, EquipmentItem, SessionData, Address } from '../types';
import { Building, ClipboardList, Home, Settings as SettingsIcon, Users, Archive } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    clearAllNotifications,
    markNotificationAsRead,
    addEmployee,
    updateEmployee,
    updateSettings,
    addInspection,
    addNonEmployee,
    updateNonEmployee,
    deleteNonEmployee,
    deleteEmployee,
    checkAndUpdateEmployeeStatuses,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    getAllData,
    bulkDeleteEmployees,
} from '../lib/actions';
import { logout } from '../lib/auth';
import { useToast } from '../hooks/use-toast';
import { AddEmployeeForm, type EmployeeFormData } from './add-employee-form';
import { AddNonEmployeeForm } from './add-non-employee-form';
import { cn } from '../lib/utils';
import { AddressForm } from './address-form';

const navItems: { view: View; icon: React.ElementType; label: string }[] = [
    { view: 'dashboard', icon: Home, label: 'Pulpit' },
    { view: 'employees', icon: Users, label: 'Pracownicy' },
    { view: 'inspections', icon: ClipboardList, label: 'Inspekcje' },
    { view: 'equipment', icon: Archive, label: 'Wyposażenie' },
    { view: 'settings', icon: SettingsIcon, label: 'Ustawienia' },
];

type MainLayoutContextType = {
    allEmployees: Employee[] | null;
    allNonEmployees: NonEmployee[] | null;
    allInspections: Inspection[] | null;
    allEquipment: EquipmentItem[] | null;
    settings: Settings | null;
    currentUser: SessionData | null;
    selectedCoordinatorId: string;
    setSelectedCoordinatorId: React.Dispatch<React.SetStateAction<string>>;
    handleBulkDeleteEmployees: (entityType: 'employee' | 'non-employee', status: 'active' | 'dismissed') => Promise<boolean>;
    handleAddEmployeeClick: () => void;
    handleEditEmployeeClick: (employee: Employee) => void;
    handleUpdateSettings: (newSettings: Partial<Settings>) => Promise<void>;
    refreshData: (showToast?: boolean) => Promise<void>;
    handleAddNonEmployeeClick: () => void;
    handleEditNonEmployeeClick: (nonEmployee: NonEmployee) => void;
    handleDeleteNonEmployee: (id: string) => Promise<void>;
    handleAddInspection: (inspectionData: Omit<Inspection, 'id'>) => Promise<void>;
    handleAddEquipment: (itemData: Omit<EquipmentItem, 'id'>) => Promise<void>;
    handleUpdateEquipment: (id: string, itemData: Partial<EquipmentItem>) => Promise<void>;
    handleDeleteEquipment: (id: string) => Promise<void>;
    handleRefreshStatuses: (showNoChangesToast?: boolean) => Promise<void>;
    handleAddressFormOpen: (address: Address | null) => void;
    handleDismissEmployee: (employeeId: string) => Promise<void>;
    handleRestoreEmployee: (employeeId: string) => Promise<void>;
    handleDeleteEmployee: (employeeId: string) => Promise<void>;
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

    const activeView = useMemo(() => {
        return (searchParams.get('view') as View) || 'dashboard';
    }, [searchParams]);

    const editEmployeeId = searchParams.get('edit');

    const [currentUser] = useState<SessionData | null>(initialSession);
    const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
    
    const [allEmployees, setAllEmployees] = useState<Employee[] | null>(null);
    const [allNonEmployees, setAllNonEmployees] = useState<NonEmployee[] | null>(null);
    const [allInspections, setAllInspections] = useState<Inspection[] | null>(null);
    const [allEquipment, setAllEquipment] = useState<EquipmentItem[] | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isNonEmployeeFormOpen, setIsNonEmployeeFormOpen] = useState(false);
    const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
    

    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [editingNonEmployee, setEditingNonEmployee] = useState<NonEmployee | null>(null);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    
    const [selectedCoordinatorId, _setSelectedCoordinatorId] = useState(initialSession.isAdmin ? 'all' : initialSession.uid);
    
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Wczytywanie danych...");
    const { toast } = useToast();
    
    const setSelectedCoordinatorId = useCallback((value: React.SetStateAction<string>) => {
        _setSelectedCoordinatorId(value);
    }, []);
    
    const visibleNavItems = useMemo(() => {
        if (currentUser?.isAdmin) {
            return navItems;
        }
        return navItems.filter(item => item.view !== 'settings');
    }, [currentUser]);

    const handleLogout = useCallback(async () => {
        await logout();
        routerRef.current.push('/');
    }, []);

    const handleNotificationClick = useCallback(async (notification: Notification, employeeId?: string) => {
        const pathname = window.location.pathname;
        if (employeeId) {
             const currentSearchParams = new URLSearchParams(window.location.search);
             currentSearchParams.set('view', 'employees');
             currentSearchParams.set('edit', employeeId);
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
            toast({ title: "Sukces", description: "Wszystkie powiadomienia zostały wyczyszczone." });
        } catch (e) {
             toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się wyczyścić powiadomień." });
        }
    }, [currentUser, toast]);


    const filteredNotifications = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.isAdmin) {
            return allNotifications;
        }
        return allNotifications.filter(n => n.coordinatorId === currentUser.uid);
    }, [currentUser, allNotifications]);

    const refreshData = useCallback(async (showToast = true) => {
        if (!currentUser) return;
        try {
            const {
                employees,
                settings,
                inspections,
                nonEmployees,
                equipment,
                notifications,
            } = await getAllData();

            setAllEmployees(employees);
            setSettings(settings);
            const normalizedInspections = inspections.map(i => ({
                ...i,
                // Ensure `standard` matches the expected union type or is null
                standard:
                    i.standard === "Wysoki" || i.standard === "Normalny" || i.standard === "Niski"
                        ? (i.standard as import('../types').Inspection['standard'])
                        : null,
                // Ensure categories is at least an empty array if undefined
                categories: i.categories ?? [],
            })) as import('../types').Inspection[];

            setAllInspections(normalizedInspections);
            setAllNonEmployees(nonEmployees);
            setAllEquipment(equipment);
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

    const fetchAllData = useCallback(async () => {
        if (!currentUser) return;
        setIsLoadingData(true);
        try {
            setLoadingMessage("Wczytywanie danych...");
            await refreshData(false);
        } catch (error) {
             console.error("Critical data loading error:", error);
        } finally {
             setIsLoadingData(false);
        }
    }, [currentUser, refreshData]);

    useEffect(() => {
        if (currentUser) {
            fetchAllData();
            const intervalId = setInterval(() => {
                 handleRefreshStatuses(false);
            }, 5 * 60 * 1000); // every 5 minutes
            
            return () => clearInterval(intervalId);
        }
    }, [currentUser, fetchAllData, handleRefreshStatuses]);

    useEffect(() => {
        const pathname = window.location.pathname;
        if (editEmployeeId && allEmployees) {
            const employeeToEdit = allEmployees.find(e => e.id === editEmployeeId);
            if (employeeToEdit) {
                setEditingEmployee(employeeToEdit);
                setIsFormOpen(true);
                
                const currentSearchParams = new URLSearchParams(window.location.search);
                currentSearchParams.delete('edit');
                routerRef.current.replace(`${pathname}?${currentSearchParams.toString()}`, { scroll: false });
            }
        }
    }, [editEmployeeId, allEmployees]);

    const handleSaveEmployee = useCallback(async (data: EmployeeFormData) => {
        if (!currentUser) return;
        
        try {
            if (editingEmployee) {
                const updatedData: Partial<Employee> = { ...data };
                const initialAddress = allEmployees?.find(e => e.id === editingEmployee.id)?.address;
                if (data.address !== initialAddress) {
                  updatedData.oldAddress = initialAddress;
                } else if (editingEmployee) {
                  updatedData.oldAddress = editingEmployee.oldAddress;
                }
                
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
    }, [currentUser, editingEmployee, allEmployees, refreshData, toast]);

    const handleSaveNonEmployee = useCallback(async (data: Omit<NonEmployee, 'id'>) => {
        if (editingNonEmployee) {
            try {
                await updateNonEmployee(editingNonEmployee.id, data);
                toast({ title: "Sukces", description: "Dane mieszkańca zostały zaktualizowane." });
            } catch(e) {
                toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zapisać mieszkańca." });
            }
        } else {
             try {
                await addNonEmployee(data);
                toast({ title: "Sukces", description: "Nowy mieszkaniec został dodany." });
            } catch (e) {
                toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się dodać mieszkańca." });
            }
        }
        await refreshData(false);
    }, [editingNonEmployee, refreshData, toast]);
    
    const handleDeleteNonEmployee = useCallback(async (id: string) => {
        const originalNonEmployees = allNonEmployees;
        
        setAllNonEmployees(prev => prev!.filter(ne => ne.id !== id));
        
        try {
            await deleteNonEmployee(id);
            toast({ title: "Sukces", description: "Mieszkaniec został usunięty." });
        } catch(e) {
            setAllNonEmployees(originalNonEmployees); // Revert
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć mieszkańca." });
        }
    }, [allNonEmployees, toast]);
    
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

        const handleAddInspection = useCallback(async (inspectionData: Omit<Inspection, 'id'>) => {
        const tempId = `temp-insp-${Date.now()}`;
        const newInspection: Inspection = { ...inspectionData, id: tempId };

        setAllInspections(prev => [newInspection, ...(prev || [])]);

        try {
            await addInspection(inspectionData);
            toast({ title: "Sukces", description: "Nowa inspekcja została dodana." });
            await refreshData(false);
        } catch(e) {
            setAllInspections(prev => prev ? prev.filter(i => i.id !== tempId) : null);
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się dodać inspekcji." });
        }
    }, [refreshData, toast]);

    const handleAddEquipment = useCallback(async (itemData: Omit<EquipmentItem, 'id'>) => {
        try {
            await addEquipment(itemData);
            toast({ title: "Sukces", description: "Dodano nowy sprzęt." });
            await refreshData(false);
        } catch (e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się dodać sprzętu." });
        }
    }, [refreshData, toast]);

    const handleUpdateEquipment = useCallback(async (id: string, itemData: Partial<EquipmentItem>) => {
        try {
            await updateEquipment(id, itemData);
            toast({ title: "Sukces", description: "Zaktualizowano sprzęt." });
            await refreshData(false);
        } catch (e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zaktualizować sprzętu." });
        }
    }, [refreshData, toast]);

    const handleDeleteEquipment = useCallback(async (id: string) => {
        try {
            await deleteEquipment(id);
            toast({ title: "Sukces", description: "Usunięto sprzęt." });
            await refreshData(false);
        } catch (e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć sprzętu." });
        }
    }, [refreshData, toast]);

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

    const handleBulkDeleteEmployees = useCallback(async (entityType: 'employee' | 'non-employee', status: 'active' | 'dismissed') => {
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

    const contextValue: MainLayoutContextType = useMemo(() => ({
        allEmployees,
        allNonEmployees,
        allInspections,
        allEquipment,
        settings,
        currentUser,
        selectedCoordinatorId,
        setSelectedCoordinatorId,
        handleEditEmployeeClick,
        handleBulkDeleteEmployees,
        handleAddEmployeeClick,
        handleUpdateSettings,
        refreshData,
        handleAddNonEmployeeClick,
        handleEditNonEmployeeClick,
        handleDeleteNonEmployee,
        handleAddInspection,
        handleAddEquipment,
        handleUpdateEquipment,
        handleDeleteEquipment,
        handleRefreshStatuses,
        handleAddressFormOpen,
        handleDismissEmployee,
        handleRestoreEmployee,
        handleDeleteEmployee,
    } as MainLayoutContextType), [
        allEmployees,
        allNonEmployees,
        allInspections,
        allEquipment,
        settings,
        currentUser,
        selectedCoordinatorId,
        setSelectedCoordinatorId,
        handleEditEmployeeClick,
        handleBulkDeleteEmployees,
        handleAddEmployeeClick,
        handleUpdateSettings,
        refreshData,
        handleAddNonEmployeeClick,
        handleEditNonEmployeeClick,
        handleDeleteNonEmployee,
        handleAddInspection,
        handleAddEquipment,
        handleUpdateEquipment,
        handleDeleteEquipment,
        handleRefreshStatuses,
        handleAddressFormOpen,
        handleDismissEmployee,
        handleRestoreEmployee,
        handleDeleteEmployee,
    ]);

    if (isLoadingData) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex animate-fade-in flex-col items-center gap-6">
                     <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent drop-shadow-sm">
                        SmartHouse
                    </h1>
                     <p className="text-muted-foreground">{loadingMessage}</p>
                </div>
            </div>
        );
    }

    return (
       <SidebarProvider>
         <MainLayoutContext.Provider value={contextValue}>
            <div className="flex h-screen w-full bg-muted/50">
                <Sidebar>
                    <SidebarHeader>
                        <div className="flex items-center gap-2">
                            <Building className="h-8 w-8 text-primary" />
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
                        onNotificationClick={(n) => handleNotificationClick(n, n.employeeId)} 
                        onLogout={handleLogout} 
                        onClearNotifications={handleClearNotifications}
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
            {settings && (
                <AddNonEmployeeForm
                    isOpen={isNonEmployeeFormOpen}
                    onOpenChange={setIsNonEmployeeFormOpen}
                    onSave={(data) =>
                        handleSaveNonEmployee({
                            ...data,
                            // ensure comments is a string as the API expects
                            comments: data.comments ?? '',
                        })
                    }
                    settings={settings}
                    nonEmployee={editingNonEmployee}
                />
            )}
            {settings && currentUser && (
                <AddressForm
                    isOpen={isAddressFormOpen}
                    onOpenChange={setIsAddressFormOpen}
                    onSave={handleSaveAddress}
                    coordinators={settings.coordinators}
                    address={editingAddress}
                />
            )}
        </MainLayoutContext.Provider>
        </SidebarProvider>
    );
}
