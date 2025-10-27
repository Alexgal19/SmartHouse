

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
} from '..components/ui/sidebar';
import Header from '../app/src/components/header';
import { MobileNav } from '../app/src/components/mobile-nav';
import type { View, Notification, Employee, Settings, NonEmployee, Inspection, EquipmentItem, SessionData } from '../app/src/types';
import { Building, ClipboardList, Home, Settings as SettingsIcon, Users, Archive } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clearAllNotifications, markNotificationAsRead, getNotifications, getEmployees, getSettings, addEmployee, updateEmployee, updateSettings, getInspections, addInspection, updateInspection, deleteInspection, bulkDeleteEmployees, bulkImportEmployees, getNonEmployees, addNonEmployee, updateNonEmployee, deleteNonEmployee, deleteEmployee, checkAndUpdateEmployeeStatuses, getEquipment, addEquipment, updateEquipment, deleteEquipment } from '../app/src/lib/actions';
import { logout } from '../app/src/lib/session';
import { useToast } from '../app/src/hooks/use-toast';
import { AddEmployeeForm, type EmployeeFormData } from '../app/src/components/add-employee-form';
import { AddNonEmployeeForm } from '../app/src/components/add-non-employee-form';

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
    handleEditEmployeeClick: (employee: Employee) => void;
    handleDismissEmployee: (employeeId: string) => Promise<boolean>;
    handleRestoreEmployee: (employeeId: string) => Promise<boolean>;
    handleDeleteEmployee: (employeeId: string) => Promise<void>;
    handleBulkDeleteEmployees: (entityType: 'employee' | 'non-employee', status: 'active' | 'dismissed') => Promise<boolean>;
    handleAddEmployeeClick: () => void;
    handleUpdateSettings: (newSettings: Partial<Settings>) => Promise<void>;
    refreshData: (showToast?: boolean) => Promise<void>;
    handleBulkImport: (fileData: ArrayBuffer) => Promise<{ success: boolean; message: string; }>;
    handleAddNonEmployeeClick: () => void;
    handleEditNonEmployeeClick: (nonEmployee: NonEmployee) => void;
    handleDeleteNonEmployee: (id: string) => Promise<void>;
    handleAddInspection: (inspectionData: Omit<Inspection, 'id'>) => Promise<void>;
    handleUpdateInspection: (id: string, inspectionData: Omit<Inspection, 'id'>) => Promise<void>;
    handleDeleteInspection: (id: string) => Promise<void>;
    handleAddEquipment: (itemData: Omit<EquipmentItem, 'id'>) => Promise<void>;
    handleUpdateEquipment: (id: string, itemData: Partial<EquipmentItem>) => Promise<void>;
    handleDeleteEquipment: (id: string) => Promise<void>;
    handleRefreshStatuses: (showNoChangesToast?: boolean) => Promise<void>;
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
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [editingNonEmployee, setEditingNonEmployee] = useState<NonEmployee | null>(null);
    const [selectedCoordinatorId, _setSelectedCoordinatorId] = useState('all');
    
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Wczytywanie danych...");
    const { toast } = useToast();

    useEffect(() => {
      if (currentUser?.isLoggedIn && !currentUser.isAdmin) {
          _setSelectedCoordinatorId(currentUser.uid);
      }
    }, [currentUser]);

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
            const coordinatorIdToFetch = currentUser.isAdmin ? undefined : currentUser.uid;
            
            const [employeesData, settingsData, inspectionsData, nonEmployeesData, equipmentData, notificationsData] = await Promise.all([
                getEmployees(),
                getSettings(),
                getInspections(),
                getNonEmployees(),
                getEquipment(),
                getNotifications(),
            ]);

            setAllEmployees(employeesData);
            setSettings(settingsData);
            setAllInspections(inspectionsData);
            setAllNonEmployees(nonEmployeesData);
            setAllEquipment(equipmentData);
            setAllNotifications(notificationsData);
            
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
                 toast({ title: "Брак змін", description: "Усі працівники мають актуальні статуси."});
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Бłąd", description: e instanceof Error ? e.message : "Nie udało się odświeżyć статусів." });
        }
    }, [currentUser, refreshData, toast]);

    const fetchAllData = useCallback(async () => {
        if (!currentUser) return;
        setIsLoadingData(true);
        try {
            setLoadingMessage("Wczytywanie danych...");
            const [employeesData, settingsData, inspectionsData, nonEmployeesData, equipmentData, notificationsData] = await Promise.all([
                getEmployees(),
                getSettings(),
                getInspections(),
                getNonEmployees(),
                getEquipment(),
                getNotifications()
            ]);

            setAllEmployees(employeesData);
            setSettings(settingsData);
            setAllInspections(inspectionsData);
            setAllNonEmployees(nonEmployeesData);
            setAllEquipment(equipmentData);
            setAllNotifications(notificationsData);

        } catch (error) {
             console.error("Critical data loading error:", error);
            toast({
                variant: "destructive",
                title: "Błąd krytyczny ładowania danych",
                description: `Nie udało się pobrać podstawowych danych z serwera. ${error instanceof Error ? error.message : ''}`,
                duration: 10000,
            });
             return;
        } finally {
             setIsLoadingData(false);
        }
    }, [currentUser, toast]);

    useEffect(() => {
        if (currentUser) {
            fetchAllData();
            // This is an expensive operation, so we only run it once on initial load.
            handleRefreshStatuses(false);
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
        } catch(e) {
            setSettings(originalSettings); // Revert on error
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zapisać ustawień." });
        }
    }, [settings, currentUser, toast]);
    
    const handleAddInspection = useCallback(async (inspectionData: Omit<Inspection, 'id'>) => {
        const tempId = `temp-insp-${Date.now()}`;
        const newInspection: Inspection = { ...inspectionData, id: tempId };

        setAllInspections(prev => [newInspection, ...(prev || [])]);

        try {
            await addInspection(inspectionData);
            toast({ title: "Sukces", description: "Nowa inspekcja została dodana." });
            await refreshData(false);
        } catch(e) {
            setAllInspections(prev => prev!.filter(i => i.id !== tempId));
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się dodać inspekcji." });
        }
    }, [refreshData, toast]);

    const handleUpdateInspection = useCallback(async (id: string, inspectionData: Omit<Inspection, 'id'>) => {
        const originalInspections = allInspections;
        const updatedInspection = { ...inspectionData, id };

        setAllInspections(prev => prev!.map(i => i.id === id ? updatedInspection : i));

        try {
            await updateInspection(id, inspectionData);
            toast({ title: "Sukces", description: "Inspekcja została zaktualizowana." });
        } catch (e) {
            setAllInspections(originalInspections);
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zaktualizować inspekcji." });
        }
    }, [allInspections, toast]);

    const handleDeleteInspection = useCallback(async (id: string) => {
        const originalInspections = allInspections;
        setAllInspections(prev => prev!.filter(i => i.id !== id));

        try {
            await deleteInspection(id);
            toast({ title: "Sukces", description: "Inspekcja została usunięta." });
        } catch(e) {
            setAllInspections(originalInspections);
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć inspekcji." });
        }
    }, [allInspections, toast]);

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

    const handleDismissEmployee = useCallback(async (employeeId: string) => {
        if (!currentUser) return false;
        
        const originalEmployees = allEmployees;
        const updatedData: Partial<Employee> = { status: 'dismissed', checkOutDate: new Date().toISOString().split('T')[0] };

        setAllEmployees(prev => prev!.map(e => e.id === employeeId ? Object.assign({}, e, updatedData) : e));

        try {
            await updateEmployee(employeeId, updatedData, currentUser.uid);
            toast({ title: "Sukces", description: "Pracownik został zwolniony." });
            return true;
        } catch(e) {
            setAllEmployees(originalEmployees);
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zwolnić pracownika." });
            return false;
        }
    }, [currentUser, allEmployees, toast]);

    const handleRestoreEmployee = useCallback(async (employeeId: string) => {
        if (!currentUser) return false;
        
        const originalEmployees = allEmployees;
        const updatedData: Partial<Employee> = { status: 'active', checkOutDate: null };
        
        setAllEmployees(prev => prev!.map(e => e.id === employeeId ? Object.assign({}, e, updatedData) : e));
        
        try {
            await updateEmployee(employeeId, updatedData, currentUser.uid);
            toast({ title: "Sukces", description: "Pracownik został przywrócony." });
            return true;
        } catch(e) {
            setAllEmployees(originalEmployees);
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się przywrócić pracownika." });
            return false;
        }
    }, [currentUser, allEmployees, toast]);
    
    const handleDeleteEmployee = useCallback(async (employeeId: string) => {
        if (!currentUser) return;
        const originalEmployees = allEmployees;
        setAllEmployees(prev => prev!.filter(e => e.id !== employeeId));
        try {
            await deleteEmployee(employeeId, currentUser.uid);
            toast({ title: "Sukces", description: "Pracownik został trwale usunięty."});
        } catch (e) {
            setAllEmployees(originalEmployees);
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć pracownika." });
        }
    }, [currentUser, allEmployees, toast]);

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
    
     const handleBulkImport = useCallback(async (fileData: ArrayBuffer) => {
        if (!currentUser?.isAdmin) {
            return { success: false, message: "Brak uprawnień do importu." };
        }
        try {
            const result = await bulkImportEmployees(fileData, currentUser.uid);
            await refreshData(false);
            return result;
        } catch (e: unknown) {
            return { success: false, message: e instanceof Error ? e.message : "Wystąpił nieznany błąd podczas przetwarzania pliku." };
        }
    }, [currentUser, refreshData]);
    
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
        handleDismissEmployee,
        handleRestoreEmployee,
        handleDeleteEmployee,
        handleBulkDeleteEmployees,
        handleAddEmployeeClick,
        handleUpdateSettings,
        refreshData,
        handleBulkImport,
        handleAddNonEmployeeClick,
        handleEditNonEmployeeClick,
        handleDeleteNonEmployee,
        handleAddInspection,
        handleUpdateInspection,
        handleDeleteInspection,
        handleAddEquipment,
        handleUpdateEquipment,
        handleDeleteEquipment,
        handleRefreshStatuses
    }), [
        allEmployees,
        allNonEmployees,
        allInspections,
        allEquipment,
        settings,
        currentUser,
        selectedCoordinatorId,
        setSelectedCoordinatorId,
        handleEditEmployeeClick,
        handleDismissEmployee,
        handleRestoreEmployee,
        handleDeleteEmployee,
        handleBulkDeleteEmployees,
        handleAddEmployeeClick,
        handleUpdateSettings,
        refreshData,
        handleBulkImport,
        handleAddNonEmployeeClick,
        handleEditNonEmployeeClick,
        handleDeleteNonEmployee,
        handleAddInspection,
        handleUpdateInspection,
        handleDeleteInspection,
        handleAddEquipment,
        handleUpdateEquipment,
        handleDeleteEquipment,
        handleRefreshStatuses
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
                            <span className="font-semibold text-xl group-data-[collapsible=icon]:hidden">SmartHouse</span>
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
                                            disabled={item.view === 'settings' && !currentUser?.isAdmin}
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
                        notifications={filteredNotifications} 
                        onNotificationClick={(n) => handleNotificationClick(n, n.employeeId)} 
                        onLogout={handleLogout} 
                        onClearNotifications={handleClearNotifications}
                    />}
                    <main className="flex-1 overflow-y-auto px-2 sm:px-6 pb-6 pt-4">
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
                    onSave={handleSaveNonEmployee}
                    settings={settings}
                    nonEmployee={editingNonEmployee}
                />
            )}
        </MainLayoutContext.Provider>
        </SidebarProvider>
    );
}
