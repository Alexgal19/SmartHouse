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
import { AddEmployeeForm } from './add-employee-form';
import { Skeleton } from './ui/skeleton';
import { getEmployees, getSettings, addEmployee, updateEmployee, updateSettings } from '@/lib/firebaseService';
import type { Employee, Settings, User, View } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Building, ClipboardList, Home, Settings as SettingsIcon, Users } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const mockUser: User = {
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
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    const { toast } = useToast();
    const { isMobile, open } = useSidebar();
    
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [employeesData, settingsData] = await Promise.all([getEmployees(), getSettings()]);
            setEmployees(employeesData);
            setSettings(settingsData);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Błąd ładowania danych",
                description: "Nie udało się pobrać danych z serwera.",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveEmployee = async (data: Omit<Employee, 'id' | 'status'> & { oldAddress?: string | null }) => {
        try {
            if (editingEmployee) {
                await updateEmployee(editingEmployee.id, data);
                toast({ title: "Sukces", description: "Dane pracownika zostały zaktualizowane." });
            } else {
                await addEmployee(data);
                toast({ title: "Sukces", description: "Nowy pracownik został dodany." });
            }
            fetchData(); // Refresh data
        } catch(e) {
             toast({ variant: "destructive", title: "Błąd", description: "Nie udało się zapisać pracownika." });
        }
    };
    
    const handleUpdateSettings = async (newSettings: Partial<Settings>) => {
        if (!settings) return;
        try {
            const updated = await updateSettings(newSettings);
            setSettings(s => ({...s!, ...updated}));
            toast({ title: "Sukces", description: "Ustawienia zostały zaktualizowane." });
        } catch(e) {
            toast({ variant: "destructive", title: "Błąd", description: "Nie udało się zapisać ustawień." });
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

    const handleDismissEmployee = async (employeeId: string) => {
        try {
            await updateEmployee(employeeId, { status: 'dismissed', checkOutDate: new Date() });
            toast({ title: "Sukces", description: "Pracownik został zwolniony." });
            fetchData();
        } catch(e) {
            toast({ variant: "destructive", title: "Błąd", description: "Nie udało się zwolnić pracownika." });
        }
    };

    const handleRestoreEmployee = async (employeeId: string) => {
        try {
            await updateEmployee(employeeId, { status: 'active', checkOutDate: null });
            toast({ title: "Sukces", description: "Pracownik został przywrócony." });
            fetchData();
        } catch(e) {
            toast({ variant: "destructive", title: "Błąd", description: "Nie udało się przywrócić pracownika." });
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
                return <div className="text-center p-8 text-muted-foreground">Widok inspekcji jest w budowie.</div>;
            default:
                return <DashboardView employees={employees} settings={settings} onEditEmployee={handleEditEmployeeClick} />;
        }
    };

    return (
        <div className="flex h-screen w-full bg-background">
             <Sidebar>
                <SidebarHeader>
                    <div className="flex items-center gap-2 p-4">
                        <Building className="h-8 w-8 text-primary" />
                        <span className="font-semibold text-xl group-data-[collapsible=icon]:hidden">HR Housing Hub</span>
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
                <Header user={mockUser} activeView={activeView} />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
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
