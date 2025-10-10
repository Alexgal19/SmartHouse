
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar
} from '@/components/ui/sidebar';
import Header from './header';
import { MobileNav } from './mobile-nav';
import DashboardView from './dashboard-view';
import EmployeesView from './employees-view';
import SettingsView from './settings-view';
import InspectionsView from './inspections-view';
import { AddEmployeeForm } from './add-employee-form';
import { AddNonEmployeeForm } from './add-non-employee-form';
import { LoginView } from './login-view';
import { getEmployees, getSettings, addEmployee, updateEmployee, updateSettings, getNotifications, markNotificationAsRead, getInspections, addInspection, updateInspection, deleteInspection, transferEmployees, bulkDeleteEmployees, bulkImportEmployees, clearAllNotifications, getNonEmployees, addNonEmployee, updateNonEmployee, deleteNonEmployee, checkAndUpdateEmployeeStatuses } from '@/lib/actions';
import type { Employee, Settings, User, View, Notification, Coordinator, Inspection, NonEmployee } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Building, ClipboardList, Home, Settings as SettingsIcon, Users } from 'lucide-react';

const navItems: { view: View; icon: React.ElementType; label: string }[] = [
    { view: 'dashboard', icon: Home, label: 'Pulpit' },
    { view: 'employees', icon: Users, label: 'Pracownicy' },
    { view: 'inspections', icon: ClipboardList, label: 'Inspekcje' },
    { view: 'settings', icon: SettingsIcon, label: 'Ustawienia' },
];

function MainContent() {
    const [activeView, setActiveView] = useState<View>('dashboard');
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [allNonEmployees, setAllNonEmployees] = useState<NonEmployee[]>([]);
    const [allInspections, setAllInspections] = useState<Inspection[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isNonEmployeeFormOpen, setIsNonEmployeeFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [editingNonEmployee, setEditingNonEmployee] = useState<NonEmployee | null>(null);
    const [currentUser, setCurrentUser] = useState<Coordinator | null>(null);
    const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('all');
    
    const { toast } = useToast();
    const { isMobile } = useSidebar();
    
    const fetchData = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) setIsLoading(true);
        try {
            const [employeesData, settingsData, notificationsData, inspectionsData, nonEmployeesData] = await Promise.all([
                getEmployees(), 
                getSettings(),
                getNotifications(),
                getInspections(),
                getNonEmployees(),
            ]);
            setAllEmployees(employeesData.map((e: any) => ({
                ...e,
                checkInDate: new Date(e.checkInDate),
                checkOutDate: e.checkOutDate ? new Date(e.checkOutDate) : null,
                contractStartDate: e.contractStartDate ? new Date(e.contractStartDate) : null,
                contractEndDate: e.contractEndDate ? new Date(e.contractEndDate) : null,
                departureReportDate: e.departureReportDate ? new Date(e.departureReportDate) : null,
            })));
            setAllNonEmployees(nonEmployeesData.map((ne: any) => ({
                ...ne,
                checkInDate: new Date(ne.checkInDate),
                checkOutDate: ne.checkOutDate ? new Date(ne.checkOutDate) : null,
            })));
            setSettings(settingsData);
            setAllNotifications(notificationsData.map((n:any) => ({...n, createdAt: new Date(n.createdAt)})));
            setAllInspections(inspectionsData.map((i: any) => ({...i, date: new Date(i.date)})));
        } catch (error) {
            console.error(error);
            if (isInitialLoad) {
                toast({
                    variant: "destructive",
                    title: "Błąd ładowania danych",
                    description: `Nie udało się pobrać danych z serwera. ${error instanceof Error ? error.message : ''}`,
                });
            }
        } finally {
            if (isInitialLoad) setIsLoading(false);
        }
    }, [toast]);
    
     useEffect(() => {
        const loggedInUser = sessionStorage.getItem('currentUser');
        if (loggedInUser) {
            const user = JSON.parse(loggedInUser);
            setCurrentUser(user);
            fetchData(true);
        } else {
             setIsLoading(true);
             getSettings()
                .then(setSettings)
                .catch(console.error)
                .finally(() => setIsLoading(false));
        }
    }, []);

    const filteredEmployees = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.isAdmin) {
            if (selectedCoordinatorId === 'all') {
                return allEmployees;
            }
            return allEmployees.filter(e => e.coordinatorId === selectedCoordinatorId);
        }
        return allEmployees.filter(e => e.coordinatorId === currentUser.uid);
    }, [currentUser, allEmployees, selectedCoordinatorId]);

    const filteredNonEmployees = useMemo(() => {
        if (!currentUser) return [];
        if (selectedCoordinatorId === 'all' || !currentUser.isAdmin) {
            return allNonEmployees;
        }

        const coordinatorAddresses = new Set(
            allEmployees
                .filter(e => e.coordinatorId === selectedCoordinatorId)
                .map(e => e.address)
        );

        return allNonEmployees.filter(ne => ne.address && coordinatorAddresses.has(ne.address));
   }, [currentUser, allNonEmployees, allEmployees, selectedCoordinatorId]);

    const filteredInspections = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.isAdmin) {
            if (selectedCoordinatorId === 'all') {
                return allInspections;
            }
            return allInspections.filter(i => i.coordinatorId === selectedCoordinatorId);
        }
        return allInspections.filter(i => i.coordinatorId === currentUser.uid);
    }, [currentUser, allInspections, selectedCoordinatorId]);

    const filteredNotifications = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.isAdmin) {
            return allNotifications;
        }
        return allNotifications.filter(n => n.coordinatorId === currentUser.uid);
    }, [currentUser, allNotifications]);

    const handleLogin = async (user: {name: string}, password?: string) => {
        if (!settings) return;
        
        const adminLogin = process.env.ADMIN_LOGIN || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'password';
        const lowerCaseName = user.name.toLowerCase();

        if (lowerCaseName === adminLogin.toLowerCase()) {
            if (password === adminPassword) {
                 const adminUser = {
                    uid: 'admin-super-user',
                    name: 'Admin',
                    isAdmin: true,
                    password: ''
                };
                setCurrentUser(adminUser);
                sessionStorage.setItem('currentUser', JSON.stringify(adminUser));
                setSelectedCoordinatorId('all');
                await fetchData(true);
            } else {
                 (window as any).setLoginError('Nieprawidłowe hasło administratora.');
            }
            return;
        }

        const coordinator = settings.coordinators.find(c => c.name.toLowerCase() === lowerCaseName);

        if (!coordinator) {
            (window as any).setLoginError('Brak dostępu. Sprawdź, czy Twoje imię i nazwisko są poprawne.');
            return;
        }

        if (!password) {
            (window as any).setLoginError('Hasło jest wymagane.');
            return;
        }
        
        const loginAction = async (coord: Coordinator) => {
            setCurrentUser(coord);
            sessionStorage.setItem('currentUser', JSON.stringify(coord));
            if(!coord.isAdmin) {
                setSelectedCoordinatorId(coord.uid);
            }
            await fetchData(true);
        };

        if (!coordinator.password) { // First login, set password
            try {
                const updatedCoordinators = settings.coordinators.map(c => 
                    c.uid === coordinator.uid ? { ...c, password } : c
                );
                
                await updateSettings({ coordinators: updatedCoordinators });
                setSettings(prevSettings => prevSettings ? {...prevSettings, coordinators: updatedCoordinators} : null);
                
                const userWithPassword = { ...coordinator, password };
                await loginAction(userWithPassword);
                toast({ title: "Sukces", description: "Twoje hasło zostało ustawione." });
            } catch (error) {
                (window as any).setLoginError('Nie udało się ustawić hasła. Spróbuj ponownie.');
                 setCurrentUser(null);
                 sessionStorage.removeItem('currentUser');
            }
        } else { // Subsequent logins
            if (coordinator.password === password) {
                await loginAction(coordinator);
            } else {
                (window as any).setLoginError('Nieprawidłowe hasło.');
            }
        }
    };

    const handleLogout = () => {
        setCurrentUser(null);
        sessionStorage.removeItem('currentUser');
        setAllEmployees([]);
        setAllInspections([]);
        setAllNonEmployees([]);
        setAllNotifications([]);
        setActiveView('dashboard');
        setSelectedCoordinatorId('all');
    };

    const handleSaveEmployee = async (data: Omit<Employee, 'id' | 'status'> & { oldAddress?: string | null }) => {
        if (!currentUser) return;
        
        // Optimistic update
        if (editingEmployee) {
            const updatedEmployee = { ...editingEmployee, ...data };
            setAllEmployees(prev => prev.map(e => e.id === editingEmployee.id ? updatedEmployee : e));
        } else {
            const tempId = `temp-${Date.now()}`;
            const newEmployee: Employee = {
                ...data,
                id: tempId,
                status: 'active',
            };
            setAllEmployees(prev => [newEmployee, ...prev]);
        }
        
        try {
            const savedEmployee = await (editingEmployee
                ? updateEmployee(editingEmployee.id, data, currentUser)
                : addEmployee(data, currentUser));

            // Replace temp employee with saved one or update existing
            setAllEmployees(prev => prev.map(e => e.id === (editingEmployee?.id || savedEmployee.id) || e.id.startsWith('temp-') ? savedEmployee : e));
            toast({ title: "Sukces", description: editingEmployee ? "Dane pracownika zostały zaktualizowane." : "Nowy pracownik został dodany." });
            
            // Light refetch for notifications
            getNotifications().then(notificationsData => setAllNotifications(notificationsData.map((n:any) => ({...n, createdAt: new Date(n.createdAt)}))));

        } catch(e: any) {
             toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zapisać pracownika." });
             fetchData(true); // Revert optimistic update on error
        }
    };

    const handleSaveNonEmployee = async (data: Omit<NonEmployee, 'id'>) => {
        if (editingNonEmployee) {
            const updatedNonEmployee = { ...editingNonEmployee, ...data };
            setAllNonEmployees(prev => prev.map(ne => ne.id === editingNonEmployee.id ? updatedNonEmployee : ne));
        } else {
            const tempId = `temp-ne-${Date.now()}`;
            const newNonEmployee: NonEmployee = { ...data, id: tempId };
            setAllNonEmployees(prev => [newNonEmployee, ...prev]);
        }

        try {
            const savedNonEmployee = await (editingNonEmployee
                ? updateNonEmployee(editingNonEmployee.id, data)
                : addNonEmployee(data));
            
            setAllNonEmployees(prev => prev.map(ne => ne.id === (editingNonEmployee?.id || savedNonEmployee.id) || ne.id.startsWith('temp-') ? savedNonEmployee : ne));
            toast({ title: "Sukces", description: editingNonEmployee ? "Dane mieszkańca zostały zaktualizowane." : "Nowy mieszkaniec został dodany." });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zapisać mieszkańca." });
            fetchData(true); // Revert
        }
    }
    
    const handleDeleteNonEmployee = async (id: string) => {
        const originalNonEmployees = allNonEmployees;
        setAllNonEmployees(prev => prev.filter(ne => ne.id !== id));
        
        try {
            await deleteNonEmployee(id);
            toast({ title: "Sukces", description: "Mieszkaniec został usunięty." });
        } catch(e: any) {
            setAllNonEmployees(originalNonEmployees); // Revert
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się usunąć mieszkańca." });
        }
    }
    
    const handleUpdateSettings = async (newSettings: Partial<Settings>) => {
        if (!settings || !currentUser?.isAdmin) {
             toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administrator może zmieniać ustawienia." });
            return;
        }
        
        const originalSettings = settings;
        setSettings({ ...originalSettings, ...newSettings });

        try {
            await updateSettings(newSettings);
            toast({ title: "Sukces", description: "Ustawienia zostały zaktualizowane." });
            // Refetch settings to confirm changes from server
            getSettings().then(setSettings);
        } catch(e: any) {
            setSettings(originalSettings); // Revert
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zapisać ustawień." });
        }
    };
    
    const handleAddInspection = async (inspectionData: Omit<Inspection, 'id'>) => {
        const tempId = `temp-insp-${Date.now()}`;
        const newInspection: Inspection = { ...inspectionData, id: tempId };
        setAllInspections(prev => [newInspection, ...prev].sort((a, b) => b.date.getTime() - a.date.getTime()));

        try {
            await addInspection(inspectionData);
            toast({ title: "Sukces", description: "Nowa inspekcja została dodana." });
            getInspections().then(data => setAllInspections(data.map((i: any) => ({...i, date: new Date(i.date)})))); // light refetch
        } catch(e: any) {
            setAllInspections(prev => prev.filter(i => i.id !== tempId)); // Revert
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się dodać inspekcji." });
        }
    };

    const handleUpdateInspection = async (id: string, inspectionData: Omit<Inspection, 'id'>) => {
        const updatedInspection: Inspection = { ...inspectionData, id };
        setAllInspections(prev => prev.map(i => i.id === id ? updatedInspection : i));

        try {
            await updateInspection(id, inspectionData);
            toast({ title: "Sukces", description: "Inspekcja została zaktualizowana." });
            getInspections().then(data => setAllInspections(data.map((i: any) => ({...i, date: new Date(i.date)})))); // light refetch
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zaktualizować inspekcji." });
            await fetchData(true); // Revert
        }
    };

    const handleDeleteInspection = async (id: string) => {
        const originalInspections = allInspections;
        setAllInspections(prev => prev.filter(i => i.id !== id));

        try {
            await deleteInspection(id);
            toast({ title: "Sukces", description: "Inspekcja została usunięta." });
        } catch(e: any) {
            setAllInspections(originalInspections); // Revert
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się usunąć inspekcji." });
        }
    };

    const handleAddEmployeeClick = () => {
        setEditingEmployee(null);
        setIsFormOpen(true);
    };

    const handleAddNonEmployeeClick = () => {
      setEditingNonEmployee(null);
      setIsNonEmployeeFormOpen(true);
    }

    const handleEditEmployeeClick = (employee: Employee) => {
        setEditingEmployee(employee);
        setIsFormOpen(true);
    };

    const handleEditNonEmployeeClick = (nonEmployee: NonEmployee) => {
      setEditingNonEmployee(nonEmployee);
      setIsNonEmployeeFormOpen(true);
    }
    
    const handleNotificationClick = async (notification: Notification) => {
        if (notification.employeeId) {
            const employeeToEdit = allEmployees.find(e => e.id === notification.employeeId);
            if (employeeToEdit) {
                handleEditEmployeeClick(employeeToEdit);
            }
        }
        
        if (!notification.isRead) {
            setAllNotifications(prev => prev.map(n => n.id === notification.id ? {...n, isRead: true} : n));
            await markNotificationAsRead(notification.id);
            // No full refetch needed
        }
    };
    
    const handleClearNotifications = async () => {
        if (!currentUser?.isAdmin) {
             toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administrator może usuwać powiadomienia." });
             return;
        }
        const originalNotifications = allNotifications;
        setAllNotifications([]);
        try {
            await clearAllNotifications();
            toast({ title: "Sukces", description: "Wszystkie powiadomienia zostały usunięte." });
        } catch (e: any) {
             setAllNotifications(originalNotifications); // Revert
             toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się usunąć powiadomień." });
        }
    }

    const handleDismissEmployee = async (employeeId: string) => {
        if (!currentUser) return;
        const originalEmployees = allEmployees;
        setAllEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, status: 'dismissed', checkOutDate: new Date() } : e));

        try {
            await updateEmployee(employeeId, { status: 'dismissed', checkOutDate: new Date() }, currentUser);
            toast({ title: "Sukces", description: "Pracownik został zwolniony." });
        } catch(e: any) {
            setAllEmployees(originalEmployees); // Revert
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zwolnić pracownika." });
        }
    };

    const handleRestoreEmployee = async (employeeId: string) => {
        if (!currentUser) return;
        const originalEmployees = allEmployees;
        setAllEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, status: 'active', checkOutDate: null } : e));

        try {
            await updateEmployee(employeeId, { status: 'active', checkOutDate: null }, currentUser);
            toast({ title: "Sukces", description: "Pracownik został przywrócony." });
        } catch(e: any) {
            setAllEmployees(originalEmployees); // Revert
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się przywrócić pracownika." });
        }
    };
    
    const handleBulkDeleteEmployees = async (status: 'active' | 'dismissed') => {
        if (!currentUser || !currentUser.isAdmin) {
             toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administrator może usuwać pracowników." });
            return;
        }
        
        const originalEmployees = allEmployees;
        const employeesToDelete = originalEmployees.filter(e => e.status === status);
        setAllEmployees(prev => prev.filter(e => e.status !== status));

         try {
            await bulkDeleteEmployees(status, currentUser);
            toast({ title: "Sukces", description: `Wszyscy ${status === 'active' ? 'aktywni' : 'zwolnieni'} pracownicy (${employeesToDelete.length}) zostali usunięci.` });
        } catch(e: any) {
            setAllEmployees(originalEmployees); // Revert
            toast({ variant: "destructive", title: "Błąd", description: e.message || `Nie udało się usunąć pracowników.` });
        }
    }

    const handleRefreshStatuses = async () => {
        if (!currentUser) return;
        try {
            const { updated } = await checkAndUpdateEmployeeStatuses(currentUser);
            if (updated > 0) {
                toast({ title: "Sukces", description: `Zaktualizowano statusy dla ${updated} pracowników.`});
                const [employeesData, notificationsData] = await Promise.all([
                    getEmployees(),
                    getNotifications()
                ]);
                 setAllEmployees(employeesData.map((e: any) => ({
                    ...e,
                    checkInDate: new Date(e.checkInDate),
                    checkOutDate: e.checkOutDate ? new Date(e.checkOutDate) : null,
                    contractStartDate: e.contractStartDate ? new Date(e.contractStartDate) : null,
                    contractEndDate: e.contractEndDate ? new Date(e.contractEndDate) : null,
                    departureReportDate: e.departureReportDate ? new Date(e.departureReportDate) : null,
                })));
                 setAllNotifications(notificationsData.map((n:any) => ({...n, createdAt: new Date(n.createdAt)})));
            } else {
                 toast({ title: "Brak zmian", description: "Wszyscy pracownicy mają aktualne statusy."});
            }
        } catch (e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się odświeżyć statusów." });
        }
    };
    
    const handleBulkImport = async (fileData: ArrayBuffer) => {
      try {
          const result = await bulkImportEmployees(fileData, settings?.coordinators || [], currentUser as Coordinator);
          await fetchData(true); // Full refresh after import
          return result;
      } catch (e: any) {
          return { success: false, message: e.message || "Wystąpił nieznany błąd." };
      }
    };

    const renderView = () => {
        if (!currentUser || !settings) {
            return null;
        }

        switch (activeView) {
            case 'dashboard':
                return <DashboardView employees={filteredEmployees} nonEmployees={filteredNonEmployees} settings={settings} onEditEmployee={handleEditEmployeeClick} currentUser={currentUser} selectedCoordinatorId={selectedCoordinatorId} onSelectCoordinator={setSelectedCoordinatorId} onDataRefresh={handleRefreshStatuses} />;
            case 'employees':
                return <EmployeesView employees={filteredEmployees} nonEmployees={filteredNonEmployees} settings={settings} onAddEmployee={handleAddEmployeeClick} onEditEmployee={handleEditEmployeeClick} onDismissEmployee={handleDismissEmployee} onRestoreEmployee={handleRestoreEmployee} onBulkDelete={handleBulkDeleteEmployees} currentUser={currentUser} onAddNonEmployee={handleAddNonEmployeeClick} onEditNonEmployee={handleEditNonEmployeeClick} onDeleteNonEmployee={handleDeleteNonEmployee} />;
            case 'settings':
                if (!currentUser.isAdmin) {
                    return <div className="p-4 text-center text-red-500">Brak uprawnień do przeglądania tej strony.</div>;
                }
                return <SettingsView settings={settings} onUpdateSettings={handleUpdateSettings} allEmployees={allEmployees} currentUser={currentUser} onDataRefresh={fetchData} onBulkImport={handleBulkImport}/>;
            case 'inspections':
                 return <InspectionsView 
                    inspections={filteredInspections} 
                    settings={settings}
                    currentUser={currentUser}
                    onAddInspection={handleAddInspection}
                    onUpdateInspection={handleUpdateInspection}
                    onDeleteInspection={handleDeleteInspection}
                />;
            default:
                return <DashboardView employees={filteredEmployees} nonEmployees={filteredNonEmployees} settings={settings} onEditEmployee={handleEditEmployeeClick} currentUser={currentUser} selectedCoordinatorId={selectedCoordinatorId} onSelectCoordinator={setSelectedCoordinatorId} onDataRefresh={handleRefreshStatuses} />;
        }
    };
    
    const visibleNavItems = useMemo(() => {
        if (currentUser?.isAdmin) {
            return navItems;
        }
        return navItems;
    }, [currentUser]);

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex animate-fade-in flex-col items-center gap-6">
                     <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent drop-shadow-sm">
                        SmartHouse
                    </h1>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        if (settings) {
            return <LoginView coordinators={settings.coordinators} onLogin={handleLogin} />;
        }
        return (
             <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex animate-fade-in flex-col items-center gap-6">
                     <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent drop-shadow-sm">
                        SmartHouse
                    </h1>
                </div>
            </div>
        );
    }
    
    if (!settings) {
        return (
           <div className="flex h-screen w-full items-center justify-center">
               <p>Błąd ładowania ustawień. Spróbuj odświeżyć stronę.</p>
           </div>
       );
   }

    return (
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
                                <SidebarMenuButton 
                                    onClick={() => {
                                        if (item.view === 'settings' && !currentUser?.isAdmin) return;
                                        setActiveView(item.view)
                                    }} 
                                    isActive={activeView === item.view}
                                    tooltip={item.label}
                                    disabled={item.view === 'settings' && !currentUser?.isAdmin}
                                >
                                    <item.icon />
                                    <span>{item.label}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter>
                </SidebarFooter>
            </Sidebar>
            <div className="flex flex-1 flex-col">
                <Header user={currentUser} activeView={activeView} notifications={filteredNotifications} onNotificationClick={handleNotificationClick} onLogout={handleLogout} onClearNotifications={handleClearNotifications} />
                <main className="flex-1 overflow-y-auto px-2 sm:px-6 pb-6 pt-4">
                    {renderView()}
                </main>
            </div>
            
            {isMobile && <MobileNav activeView={activeView} setActiveView={setActiveView} navItems={visibleNavItems} currentUser={currentUser}/>}
            
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
        </div>
    );
}

export default function MainLayout() {
    return (
        <SidebarProvider>
            <MainContent />
        </SidebarProvider>
    );
}
