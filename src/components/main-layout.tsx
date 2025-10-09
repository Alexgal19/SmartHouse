
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
import { getEmployees, getSettings, addEmployee, updateEmployee, updateSettings, getNotifications, markNotificationAsRead, getInspections, addInspection, updateInspection, deleteInspection, transferEmployees, bulkDeleteEmployees, bulkImportEmployees, clearAllNotifications, getNonEmployees, addNonEmployee, updateNonEmployee, deleteNonEmployee } from '@/lib/actions';
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
            // Data will be fetched by the useEffect that watches currentUser
        } else {
             // If no user, we only need settings for the login page
            getSettings()
                .then(setSettings)
                .catch(console.error)
                .finally(() => setIsLoading(false)); // Stop loading once we know there's no user and we tried getting settings
        }
    }, []);

    useEffect(() => {
        if (currentUser) {
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            if(!currentUser.isAdmin) {
                setSelectedCoordinatorId(currentUser.uid);
            }
            fetchData(true); // Fetch all data only after user is confirmed
        }
    }, [currentUser, fetchData]);

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
        if (selectedCoordinatorId === 'all') {
            return allNonEmployees;
        }

        const coordinatorAddresses = new Set(
            allEmployees
                .filter(e => e.coordinatorId === selectedCoordinatorId)
                .map(e => e.address)
        );

        if (currentUser.isAdmin) {
             return allNonEmployees.filter(ne => coordinatorAddresses.has(ne.address));
        }

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
                setSelectedCoordinatorId('all');
                // Data will be fetched by the useEffect that watches currentUser
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
        
        if (!coordinator.password) { // First login, set password
            try {
                const updatedCoordinators = settings.coordinators.map(c => 
                    c.uid === coordinator.uid ? { ...c, password } : c
                );
                
                const userWithPassword = { ...coordinator, password };

                await updateSettings({ coordinators: updatedCoordinators });
                setSettings(prevSettings => prevSettings ? {...prevSettings, coordinators: updatedCoordinators} : null);
                setCurrentUser(userWithPassword);
                toast({ title: "Sukces", description: "Twoje hasło zostało ustawione." });
            } catch (error) {
                (window as any).setLoginError('Nie udało się ustawić hasła. Spróbuj ponownie.');
                 setCurrentUser(null);
                 sessionStorage.removeItem('currentUser');
            }
        } else { // Subsequent logins
            if (coordinator.password === password) {
                setCurrentUser(coordinator);
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
        try {
            if (editingEmployee) {
                await updateEmployee(editingEmployee.id, data, currentUser);
                toast({ title: "Sukces", description: "Dane pracownika zostały zaktualizowane." });
            } else {
                await addEmployee(data, currentUser);
                toast({ title: "Sukces", description: "Nowy pracownik został dodany." });
            }
            fetchData();
        } catch(e: any) {
             toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zapisać pracownika." });
        }
    };

    const handleSaveNonEmployee = async (data: Omit<NonEmployee, 'id'>) => {
      try {
        if(editingNonEmployee) {
          await updateNonEmployee(editingNonEmployee.id, data);
          toast({ title: "Sukces", description: "Dane mieszkańca zostały zaktualizowane." });
        } else {
          await addNonEmployee(data);
          toast({ title: "Sukces", description: "Nowy mieszkaniec został dodany." });
        }
        fetchData();
      } catch (e: any) {
        toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zapisać mieszkańca." });
      }
    }
    
    const handleDeleteNonEmployee = async (id: string) => {
      try {
        await deleteNonEmployee(id);
        toast({ title: "Sukces", description: "Mieszkaniec został usunięty." });
        fetchData();
      } catch(e: any) {
        toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się usunąć mieszkańca." });
      }
    }
    
    const handleUpdateSettings = async (newSettings: Partial<Settings>) => {
        if (!settings || !currentUser?.isAdmin) {
             toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administrator może zmieniać ustawienia." });
            return;
        }
        try {
            await updateSettings(newSettings);
            toast({ title: "Sukces", description: "Ustawienia zostały zaktualizowane." });
            fetchData();
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zapisać ustawień." });
        }
    };
    
    const handleAddInspection = async (inspectionData: Omit<Inspection, 'id'>) => {
        try {
            await addInspection(inspectionData);
            toast({ title: "Sukces", description: "Nowa inspekcja została dodana." });
            fetchData();
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się dodać inspekcji." });
        }
    };

    const handleUpdateInspection = async (id: string, inspectionData: Omit<Inspection, 'id'>) => {
        try {
            await updateInspection(id, inspectionData);
            toast({ title: "Sukces", description: "Inspekcja została zaktualizowana." });
            fetchData();
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zaktualizować inspekcji." });
        }
    };

    const handleDeleteInspection = async (id: string) => {
        try {
            await deleteInspection(id);
            toast({ title: "Sukces", description: "Inspekcja została usunięta." });
            fetchData();
        } catch(e: any) {
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
        const employeeToEdit = allEmployees.find(e => e.id === notification.employeeId);
        if (employeeToEdit) {
            handleEditEmployeeClick(employeeToEdit);
        }
        
        if (!notification.isRead) {
            await markNotificationAsRead(notification.id);
            fetchData();
        }
    };
    
    const handleClearNotifications = async () => {
        if (!currentUser?.isAdmin) {
             toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administrator może usuwać powiadomienia." });
             return;
        }
        try {
            await clearAllNotifications();
            toast({ title: "Sukces", description: "Wszystkie powiadomienia zostały usunięte." });
            fetchData();
        } catch (e: any) {
             toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się usunąć powiadomień." });
        }
    }

    const handleDismissEmployee = async (employeeId: string) => {
        if (!currentUser) return;
        try {
            await updateEmployee(employeeId, { status: 'dismissed', checkOutDate: new Date() }, currentUser);
            toast({ title: "Sukces", description: "Pracownik został zwolniony." });
            fetchData();
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zwolnić pracownika." });
        }
    };

    const handleRestoreEmployee = async (employeeId: string) => {
        if (!currentUser) return;
        try {
            await updateEmployee(employeeId, { status: 'active', checkOutDate: null }, currentUser);
            toast({ title: "Sukces", description: "Pracownik został przywrócony." });
            fetchData();
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się przywrócić pracownika." });
        }
    };
    
    const handleBulkDeleteEmployees = async (status: 'active' | 'dismissed') => {
        if (!currentUser || !currentUser.isAdmin) {
             toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administrator może usuwać pracowników." });
            return;
        }
         try {
            await bulkDeleteEmployees(status, currentUser);
            toast({ title: "Sukces", description: `Wszyscy ${status === 'active' ? 'aktywni' : 'zwolnieni'} pracownicy zostali usunięci.` });
            fetchData();
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || `Nie udało się usunąć pracowników.` });
        }
    }

    
    const handleBulkImport = async (fileData: ArrayBuffer) => {
      try {
          const result = await bulkImportEmployees(fileData, settings?.coordinators || [], currentUser as Coordinator);
          fetchData();
          return result;
      } catch (e: any) {
          return { success: false, message: e.message || "Wystąpił nieznany błąd." };
      }
  };

    const renderView = () => {
        if (!currentUser || !settings) {
            return null; // Should be covered by the top-level isLoading/LoginView checks
        }

        switch (activeView) {
            case 'dashboard':
                return <DashboardView employees={filteredEmployees} nonEmployees={filteredNonEmployees} settings={settings} onEditEmployee={handleEditEmployeeClick} currentUser={currentUser} selectedCoordinatorId={selectedCoordinatorId} onSelectCoordinator={setSelectedCoordinatorId} onDataRefresh={fetchData} />;
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
                return <DashboardView employees={filteredEmployees} nonEmployees={filteredNonEmployees} settings={settings} onEditEmployee={handleEditEmployeeClick} currentUser={currentUser} selectedCoordinatorId={selectedCoordinatorId} onSelectCoordinator={setSelectedCoordinatorId} onDataRefresh={fetchData} />;
        }
    };
    
    const visibleNavItems = useMemo(() => {
        if (currentUser?.isAdmin) {
            return navItems;
        }
        // For non-admins, we still return all items, but the component will disable the settings tab.
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
        // If settings are also not loaded, show loading screen (or a more specific error)
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
    
    if (!settings) { // Should not happen if logic is correct, but as a fallback
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
                    {/* Could add a user profile button here for desktop */}
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
