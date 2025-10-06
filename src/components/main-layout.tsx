"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Skeleton } from './ui/skeleton';
import { getEmployees, getSettings, addEmployee, updateEmployee, updateSettings, getNotifications, markNotificationAsRead, getInspections, addInspection, updateInspection, deleteInspection } from '@/lib/actions';
import { runMigration } from '@/lib/migration';
import type { Employee, Settings, User, View, Notification, Coordinator, Inspection } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Building, ClipboardList, Home, Settings as SettingsIcon, Users } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from './ui/button';

const mockUser: User & Coordinator = {
    uid: 'admin-user-01',
    name: 'Admin User',
    email: 'admin@example.com',
    avatarUrl: PlaceHolderImages.find(img => img.id === 'user1')?.imageUrl || '',
    isAdmin: true,
};

const navItems: { view: View; icon: React.ElementType; label: string }[] = [
    { view: 'dashboard', icon: Home, label: 'Pulpit' },
    { view: 'employees', icon: Users, label: 'Pracownicy' },
    { view: 'inspections', icon: ClipboardList, label: 'Inspekcje' },
    { view: 'settings', icon: SettingsIcon, label: 'Ustawienia' },
];

function MainContent() {
    const [activeView, setActiveView] = useState<View>('dashboard');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

    const { toast } = useToast();
    const { isMobile } = useSidebar();
    
    // --- MIGRATION LOGIC ---
    useEffect(() => {
        // This key will be used to check if migration has already been run.
        const MIGRATION_KEY = 'v1_migration_done';

        const performMigration = async () => {
            if (localStorage.getItem(MIGRATION_KEY)) {
                setMigrationStatus('already_done');
                return;
            }
            
            setMigrationStatus('running');
            toast({ title: "Міграція даних...", description: "Оновлюємо структуру даних. Це може зайняти хвилину." });

            const result = await runMigration();
            
            if (result.success) {
                toast({ title: "Міграція успішна!", description: result.message });
                localStorage.setItem(MIGRATION_KEY, 'true');
                setMigrationStatus('success');
                // We reload to ensure the app fetches with the new data structure.
                window.location.reload();
            } else {
                toast({ variant: "destructive", title: "Помилка міграції", description: result.message });
                setMigrationStatus('failed');
            }
        };
        
        // Uncomment the line below to run migration
        // performMigration();

    }, [toast]);
    // --- END MIGRATION LOGIC ---

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [employeesData, settingsData, notificationsData, inspectionsData] = await Promise.all([
                getEmployees(), 
                getSettings(),
                getNotifications(),
                getInspections(),
            ]);
            setEmployees(employeesData.map(e => ({
                ...e,
                checkInDate: new Date(e.checkInDate),
                checkOutDate: e.checkOutDate ? new Date(e.checkOutDate) : null,
                contractStartDate: e.contractStartDate ? new Date(e.contractStartDate) : null,
                contractEndDate: e.contractEndDate ? new Date(e.contractEndDate) : null,
                departureReportDate: e.departureReportDate ? new Date(e.departureReportDate) : null,
            })));
            setSettings(settingsData);
            setNotifications(notificationsData.map(n => ({...n, createdAt: new Date(n.createdAt)})));
            setInspections(inspectionsData.map(i => ({...i, date: new Date(i.date)})));
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Błąd ładowania danych",
                description: `Nie udało się pobrać danych z serwera. ${error instanceof Error ? error.message : ''}`,
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    const pollNotifications = useCallback(async () => {
        try {
            const notificationsData = await getNotifications();
            setNotifications(notificationsData.map(n => ({...n, createdAt: new Date(n.createdAt)})));
        } catch (error) {
            console.error("Failed to poll notifications", error);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
      const interval = setInterval(() => {
        pollNotifications();
      }, 30000); 
      return () => clearInterval(interval);
    }, [pollNotifications]);

    const handleSaveEmployee = async (data: Omit<Employee, 'id' | 'status'> & { oldAddress?: string | null }) => {
        try {
            if (editingEmployee) {
                const updatedEmployee = await updateEmployee(editingEmployee.id, data, mockUser);
                setEmployees(prev => prev.map(e => e.id === editingEmployee.id ? {
                    ...updatedEmployee,
                    checkInDate: new Date(updatedEmployee.checkInDate),
                    checkOutDate: updatedEmployee.checkOutDate ? new Date(updatedEmployee.checkOutDate) : null,
                    contractStartDate: updatedEmployee.contractStartDate ? new Date(updatedEmployee.contractStartDate) : null,
                    contractEndDate: updatedEmployee.contractEndDate ? new Date(updatedEmployee.contractEndDate) : null,
                    departureReportDate: updatedEmployee.departureReportDate ? new Date(updatedEmployee.departureReportDate) : null,
                } : e));
                toast({ title: "Sukces", description: "Dane pracownika zostały zaktualizowane." });
            } else {
                const newEmployee = await addEmployee(data, mockUser);
                setEmployees(prev => [...prev, {...newEmployee,
                    checkInDate: new Date(newEmployee.checkInDate),
                    checkOutDate: newEmployee.checkOutDate ? new Date(newEmployee.checkOutDate) : null,
                    contractStartDate: newEmployee.contractStartDate ? new Date(newEmployee.contractStartDate) : null,
                    contractEndDate: newEmployee.contractEndDate ? new Date(newEmployee.contractEndDate) : null,
                    departureReportDate: newEmployee.departureReportDate ? new Date(newEmployee.departureReportDate) : null,
                }]);
                toast({ title: "Sukces", description: "Nowy pracownik został dodany." });
            }
            await pollNotifications();
            await fetchData(); // Refetch all data to be sure
        } catch(e: any) {
             toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zapisać pracownika." });
        }
    };
    
    const handleUpdateSettings = async (newSettings: Partial<Settings>) => {
        if (!settings) return;
        try {
            const updated = await updateSettings(newSettings);
            setSettings(updated);
            toast({ title: "Sukces", description: "Ustawienia zostały zaktualizowane." });
            await fetchData(); // Refetch all data
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zapisać ustawień." });
        }
    };
    
    const handleAddInspection = async (inspectionData: Omit<Inspection, 'id'>) => {
        try {
            await addInspection(inspectionData);
            toast({ title: "Sukces", description: "Nowa inspekcja została dodana." });
            await fetchData();
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się dodać inspekcji." });
        }
    };

    const handleUpdateInspection = async (id: string, inspectionData: Omit<Inspection, 'id'>) => {
        try {
            await updateInspection(id, inspectionData);
            toast({ title: "Sukces", description: "Inspekcja została zaktualizowana." });
            await fetchData();
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zaktualizować inspekcji." });
        }
    };

    const handleDeleteInspection = async (id: string) => {
        try {
            await deleteInspection(id);
            toast({ title: "Sukces", description: "Inspekcja została usunięta." });
            await fetchData();
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się usunąć inspekcji." });
        }
    };

    const handleAddEmployeeClick = () => {
        setEditingEmployee(null);
        setIsFormOpen(true);
    };

    const handleEditEmployeeClick = (employee: Employee) => {
        setEditingEmployee(employee);
        setIsFormOpen(true);
    };
    
    const handleNotificationClick = async (notification: Notification) => {
        const employeeToEdit = employees.find(e => e.id === notification.employeeId);
        if (employeeToEdit) {
            handleEditEmployeeClick(employeeToEdit);
        }
        
        if (!notification.isRead) {
            await markNotificationAsRead(notification.id);
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
        }
    };

    const handleDismissEmployee = async (employeeId: string) => {
        try {
            const updatedEmployee = await updateEmployee(employeeId, { status: 'dismissed', checkOutDate: new Date() }, mockUser);
            setEmployees(prev => prev.map(e => e.id === employeeId ? {
                ...updatedEmployee,
                checkOutDate: updatedEmployee.checkOutDate ? new Date(updatedEmployee.checkOutDate) : null,
                contractStartDate: updatedEmployee.contractStartDate ? new Date(updatedEmployee.contractStartDate) : null,
                contractEndDate: updatedEmployee.contractEndDate ? new Date(updatedEmployee.contractEndDate) : null,
                departureReportDate: updatedEmployee.departureReportDate ? new Date(updatedEmployee.departureReportDate) : null,
            } : e));
            toast({ title: "Sukces", description: "Pracownik został zwolniony." });
            await pollNotifications();
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zwolnić pracownika." });
        }
    };

    const handleRestoreEmployee = async (employeeId: string) => {
        try {
            const updatedEmployee = await updateEmployee(employeeId, { status: 'active', checkOutDate: null }, mockUser);
            setEmployees(prev => prev.map(e => e.id === employeeId ? {
                ...updatedEmployee,
                checkOutDate: null,
                contractStartDate: updatedEmployee.contractStartDate ? new Date(updatedEmployee.contractStartDate) : null,
                contractEndDate: updatedEmployee.contractEndDate ? new Date(updatedEmployee.contractEndDate) : null,
                departureReportDate: updatedEmployee.departureReportDate ? new Date(updatedEmployee.departureReportDate) : null,
            } : e));
            toast({ title: "Sukces", description: "Pracownik został przywrócony." });
            await pollNotifications();
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się przywrócić pracownika." });
        }
    };
    
    const renderView = () => {
        if (isLoading || !settings) {
            return (
                <div className="space-y-4 p-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            )
        }
        
        switch (activeView) {
            case 'dashboard':
                return <DashboardView employees={employees} settings={settings} onEditEmployee={handleEditEmployeeClick} />;
            case 'employees':
                return <EmployeesView employees={employees} settings={settings} onAddEmployee={handleAddEmployeeClick} onEditEmployee={handleEditEmployeeClick} onDismissEmployee={handleDismissEmployee} onRestoreEmployee={handleRestoreEmployee} />;
            case 'settings':
                return <SettingsView settings={settings} onUpdateSettings={handleUpdateSettings} />;
            case 'inspections':
                 return <InspectionsView 
                    inspections={inspections} 
                    settings={settings}
                    currentUser={mockUser}
                    onAddInspection={handleAddInspection}
                    onUpdateInspection={handleUpdateInspection}
                    onDeleteInspection={handleDeleteInspection}
                />;
            default:
                return <DashboardView employees={employees} settings={settings} onEditEmployee={handleEditEmployeeClick} />;
        }
    };

    if (migrationStatus === 'running') {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <p className="text-lg font-semibold">Триває міграція даних...</p>
                    <p className="text-muted-foreground">Будь ласка, не закривайте цю вкладку.</p>
                </div>
            </div>
        );
    }
     if (migrationStatus === 'failed') {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center max-w-md p-4 border rounded-lg bg-destructive/10 text-destructive-foreground">
                    <p className="text-lg font-semibold">Помилка міграції</p>
                    <p>Не вдалося перенести дані. Спробуйте оновити сторінку або зв'яжіться з підтримкою.</p>
                    <Button onClick={() => window.location.reload()} className="mt-4">Оновити</Button>
                </div>
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
                        {navItems.map(item => (
                             <SidebarMenuItem key={item.view}>
                                <SidebarMenuButton 
                                    onClick={() => setActiveView(item.view)} 
                                    isActive={activeView === item.view}
                                    tooltip={item.label}
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
                <Header user={mockUser} activeView={activeView} notifications={notifications} onNotificationClick={handleNotificationClick} />
                <main className="flex-1 overflow-y-auto px-2 sm:px-6 pb-6 pt-4">
                    {renderView()}
                </main>
            </div>
            
            {isMobile && <MobileNav activeView={activeView} setActiveView={setActiveView} />}
            
            {settings && (
                 <AddEmployeeForm
                    isOpen={isFormOpen}
                    onOpenChange={setIsFormOpen}
                    onSave={handleSaveEmployee}
                    settings={settings}
                    employee={editingEmployee}
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
