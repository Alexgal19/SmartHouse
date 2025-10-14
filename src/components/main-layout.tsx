
"use client";

import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider
} from '@/components/ui/sidebar';
import Header from './header';
import { MobileNav } from './mobile-nav';
import type { View, Notification, Coordinator, Employee, Settings, NonEmployee, Inspection } from '@/types';
import { Building, ClipboardList, Home, Settings as SettingsIcon, Users, Globe, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { clearAllNotifications, markNotificationAsRead, getNotifications, getEmployees, getSettings, addEmployee, updateEmployee, updateSettings, getInspections, addInspection, updateInspection, deleteInspection, transferEmployees, bulkDeleteEmployees, bulkImportEmployees, getNonEmployees, addNonEmployee, updateNonEmployee, deleteNonEmployee, checkAndUpdateEmployeeStatuses } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { Button } from './ui/button';
import Link from 'next/link';
import { AddEmployeeForm, type EmployeeFormData } from '@/components/add-employee-form';
import { AddNonEmployeeForm } from '@/components/add-non-employee-form';


const navItems: { view: View; icon: React.ElementType; label: string }[] = [
    { view: 'dashboard', icon: Home, label: 'pulpit' },
    { view: 'employees', icon: Users, label: 'employees' },
    { view: 'inspections', icon: ClipboardList, label: 'inspections' },
    { view: 'settings', icon: SettingsIcon, label: 'settings' },
];

const locales = [
    { code: 'pl', name: 'Polski' },
    { code: 'en', name: 'English' },
    { code: 'uk', name: 'Українська' },
    { code: 'es', name: 'Español' },
];

type MainLayoutContextType = {
    allEmployees: Employee[] | null;
    allNonEmployees: NonEmployee[] | null;
    allInspections: Inspection[] | null;
    settings: Settings | null;
    currentUser: Coordinator | null;
    selectedCoordinatorId: string;
    setSelectedCoordinatorId: React.Dispatch<React.SetStateAction<string>>;
    handleEditEmployeeClick: (employee: Employee) => void;
    handleDismissEmployee: (employeeId: string) => Promise<boolean>;
    handleRestoreEmployee: (employeeId: string) => Promise<boolean>;
    handleBulkDeleteEmployees: (status: "active" | "dismissed") => Promise<boolean>;
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
};

const MainLayoutContext = createContext<MainLayoutContextType | null>(null);

export const useMainLayout = () => {
    const context = useContext(MainLayoutContext);
    if (!context) {
        throw new Error('useMainLayout must be used within a MainLayout');
    }
    return context;
};

const LanguageSwitcher = () => {
    const t = useTranslations('LanguageSwitcher');
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentLocale = pathname.split('/')[1];

    const getLocalizedPath = (locale: string) => {
        const pathWithoutLocale = pathname.startsWith(`/${currentLocale}`)
            ? pathname.substring(`/${currentLocale}`.length)
            : pathname;
        
        const newPath = `/${locale}${pathWithoutLocale || '/'}`;
        
        const currentSearchParams = new URLSearchParams(searchParams.toString());
        const queryString = currentSearchParams.toString();

        return queryString ? `${newPath}?${queryString}` : newPath;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Globe className="h-5 w-5" />
                    <span className="sr-only">{t('title')}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {locales.map((locale) => (
                    <Link href={getLocalizedPath(locale.code)} key={locale.code} passHref>
                        <DropdownMenuItem className={currentLocale === locale.code ? 'font-bold' : ''}>
                           {locale.name}
                        </DropdownMenuItem>
                    </Link>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};


export default function MainLayout({
  children
}: {
  children: React.ReactNode;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { toast } = useToast();
    const t = useTranslations('Navigation');
    const t_dashboard = useTranslations('Dashboard');
    const t_loading = useTranslations('LoadingScreen');
    const editEmployeeId = searchParams.get('edit');

    const [currentUser, setCurrentUser] = useState<Coordinator | null>(null);
    const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
    
    const [allEmployees, setAllEmployees] = useState<Employee[] | null>(null);
    const [allNonEmployees, setAllNonEmployees] = useState<NonEmployee[] | null>(null);
    const [allInspections, setAllInspections] = useState<Inspection[] | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isNonEmployeeFormOpen, setIsNonEmployeeFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [editingNonEmployee, setEditingNonEmployee] = useState<NonEmployee | null>(null);
    const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('all');
    
    const [isAuthenticating, setIsAuthenticating] = useState(true);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState(t_loading('authenticating'));
    
    const activeView = useMemo(() => {
        return (searchParams.get('view') as View) || 'dashboard';
    }, [searchParams]);

    useEffect(() => {
        try {
            const loggedInUser = sessionStorage.getItem('currentUser');
            if (loggedInUser) {
                const user = JSON.parse(loggedInUser);
                setCurrentUser(user);
                if (!user.isAdmin) {
                    setSelectedCoordinatorId(user.uid);
                }
            } else {
                router.push('/');
            }
        } catch (error) {
            router.push('/');
        } finally {
            setIsAuthenticating(false);
        }
    }, [router]);

    const handleLogout = () => {
        sessionStorage.removeItem('currentUser');
        setCurrentUser(null);
        router.push('/');
    };

    const handleNotificationClick = async (notification: Notification, employeeId?: string) => {
        if (employeeId) {
             const currentSearchParams = new URLSearchParams(searchParams.toString());
             currentSearchParams.set('view', 'employees');
             currentSearchParams.set('edit', employeeId);
             router.push(`${pathname}?${currentSearchParams.toString()}`);
        }
        
        if (!notification.isRead) {
            setAllNotifications(prev => prev.map(n => n.id === notification.id ? {...n, isRead: true} : n));
            await markNotificationAsRead(notification.id);
        }
    };

     const handleClearNotifications = async () => {
        if (!currentUser?.isAdmin) {
             toast({ variant: "destructive", title: t('toast.permissionErrorTitle'), description: t('toast.permissionErrorDescription') });
             return;
        }
        try {
            await clearAllNotifications();
            setAllNotifications([]);
            toast({ title: t('toast.success'), description: t('toast.clearNotificationsSuccess') });
        } catch (e: any) {
             toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.clearNotificationsError') });
        }
    }


    const filteredNotifications = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.isAdmin) {
            return allNotifications;
        }
        return allNotifications.filter(n => n.coordinatorId === currentUser.uid);
    }, [currentUser, allNotifications]);

    const visibleNavItems = useMemo(() => {
        if (currentUser?.isAdmin) {
            return navItems;
        }
        return navItems.filter(item => item.view !== 'settings');
    }, [currentUser]);

    const refreshData = useCallback(async (showToast = true) => {
        if (!currentUser) return;
        try {
            const coordinatorIdToFetch = currentUser.isAdmin ? undefined : currentUser.uid;
            
            const { updated } = await checkAndUpdateEmployeeStatuses(currentUser);
            if (updated > 0) {
                 if (showToast) {
                    toast({ title: t_dashboard('toast.statusUpdateSuccessTitle'), description: t_dashboard('toast.statusUpdateSuccessDescription', {count: updated})});
                 }
            }

            const [employeesData, settingsData, inspectionsData, nonEmployeesData] = await Promise.all([
                getEmployees(coordinatorIdToFetch),
                getSettings(),
                getInspections(coordinatorIdToFetch),
                getNonEmployees(),
            ]);

            setAllEmployees(employeesData);
            setAllInspections(inspectionsData);
            setAllNonEmployees(nonEmployeesData);
            setSettings(settingsData);
            
            if(showToast) {
                toast({ title: t_dashboard('toast.refreshSuccessTitle'), description: t_dashboard('toast.refreshSuccessDescription') });
            }
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: t_dashboard('toast.refreshErrorTitle'),
                description: `${t_dashboard('toast.refreshErrorDescription')} ${error instanceof Error ? error.message : ''}`,
            });
        }
    }, [toast, currentUser, t_dashboard]);

    const fetchAllData = useCallback(async () => {
        if (!currentUser) return;
        setIsLoadingData(true);
        try {
            setLoadingMessage(t_loading('loadingSettings'));
            const settingsData = await getSettings();
            setSettings(settingsData);
            
            setLoadingMessage(t_loading('loadingData'));
            const coordinatorIdToFetch = currentUser.isAdmin ? undefined : currentUser.uid;
            
            const { updated } = await checkAndUpdateEmployeeStatuses(currentUser);
            if (updated > 0) {
                toast({ title: t_dashboard('toast.statusUpdateSuccessTitle'), description: t_dashboard('toast.statusUpdateSuccessDescription', {count: updated})});
            }

            const [employeesData, inspectionsData, nonEmployeesData, notificationsData] = await Promise.all([
                getEmployees(coordinatorIdToFetch),
                getInspections(coordinatorIdToFetch),
                getNonEmployees(),
                getNotifications()
            ]);

            setAllEmployees(employeesData);
            setAllInspections(inspectionsData);
            setAllNonEmployees(nonEmployeesData);
            setAllNotifications(notificationsData.map((n:any) => ({...n, createdAt: new Date(n.createdAt)})));
            
        } catch (error) {
             console.error("Critical data loading error:", error);
            toast({
                variant: "destructive",
                title: t_dashboard('toast.criticalErrorTitle'),
                description: `${t_dashboard('toast.criticalErrorDescription')} ${error instanceof Error ? error.message : ''}`,
                duration: 10000,
            });
             return;
        } finally {
             setIsLoadingData(false);
        }
    }, [toast, currentUser, t_dashboard, t_loading]);

    useEffect(() => {
        if (!isAuthenticating && currentUser) {
            fetchAllData();
        }
    }, [isAuthenticating, currentUser, fetchAllData]);

    useEffect(() => {
        if (editEmployeeId && allEmployees) {
            const employeeToEdit = allEmployees.find(e => e.id === editEmployeeId);
            if (employeeToEdit) {
                setEditingEmployee(employeeToEdit);
                setIsFormOpen(true);
                
                const currentSearchParams = new URLSearchParams(searchParams.toString());
                currentSearchParams.delete('edit');
                router.replace(`${pathname}?${currentSearchParams.toString()}`, { scroll: false });

            }
        }
    }, [editEmployeeId, allEmployees, router, searchParams, pathname]);

    const handleSaveEmployee = async (data: EmployeeFormData) => {
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
                
                await updateEmployee(editingEmployee.id, updatedData, currentUser)
                toast({ title: t_dashboard('toast.success'), description: t_dashboard('toast.employeeUpdated') });
            } else {
                await addEmployee(data, currentUser);
                toast({ title: t_dashboard('toast.success'), description: t_dashboard('toast.employeeAdded') });
            }
            await refreshData(false);
        } catch (e: any) {
            toast({ variant: "destructive", title: t_dashboard('toast.error'), description: e.message || t_dashboard('toast.employeeSaveError') });
        }
    };

    const handleSaveNonEmployee = async (data: Omit<NonEmployee, 'id'>) => {
        if (editingNonEmployee) {
            try {
                await updateNonEmployee(editingNonEmployee.id, data);
                toast({ title: t_dashboard('toast.success'), description: t_dashboard('toast.nonEmployeeUpdated') });
            } catch(e: any) {
                toast({ variant: "destructive", title: t_dashboard('toast.error'), description: e.message || t_dashboard('toast.nonEmployeeSaveError') });
            }
        } else {
             try {
                await addNonEmployee(data);
                toast({ title: t_dashboard('toast.success'), description: t_dashboard('toast.nonEmployeeAdded') });
            } catch (e: any) {
                toast({ variant: "destructive", title: t_dashboard('toast.error'), description: e.message || t_dashboard('toast.nonEmployeeAddError') });
            }
        }
        await refreshData(false);
    }
    
    const handleDeleteNonEmployee = async (id: string) => {
        const originalNonEmployees = allNonEmployees;
        
        setAllNonEmployees(prev => prev!.filter(ne => ne.id !== id));
        
        try {
            await deleteNonEmployee(id);
            toast({ title: t_dashboard('toast.success'), description: t_dashboard('toast.nonEmployeeDeleted') });
        } catch(e: any) {
            setAllNonEmployees(originalNonEmployees); // Revert
            toast({ variant: "destructive", title: t_dashboard('toast.error'), description: e.message || t_dashboard('toast.nonEmployeeDeleteError') });
        }
    }
    
    const handleUpdateSettings = async (newSettings: Partial<Settings>) => {
        if (!settings || !currentUser?.isAdmin) {
             toast({ variant: "destructive", title: t_dashboard('toast.permissionErrorTitle'), description: t_dashboard('toast.permissionErrorDescription') });
            return;
        }

        const originalSettings = settings;
        setSettings(prev => ({ ...prev!, ...newSettings }));

        try {
            await updateSettings(newSettings);
            toast({ title: t_dashboard('toast.success'), description: t_dashboard('toast.settingsUpdated') });
        } catch(e: any) {
            setSettings(originalSettings); // Revert on error
            toast({ variant: "destructive", title: t_dashboard('toast.error'), description: e.message || t_dashboard('toast.settingsUpdateError') });
        }
    };
    
    const handleAddInspection = async (inspectionData: Omit<Inspection, 'id'>) => {
        try {
            await addInspection(inspectionData);
            toast({ title: t_dashboard('toast.success'), description: t_dashboard('toast.inspectionAdded') });
            await refreshData(false);
        } catch(e: any) {
            toast({ variant: "destructive", title: t_dashboard('toast.error'), description: e.message || t_dashboard('toast.inspectionAddError') });
        }
    };

    const handleUpdateInspection = async (id: string, inspectionData: Omit<Inspection, 'id'>) => {
        const originalInspections = allInspections;
        const updatedInspection = { ...inspectionData, id };
        setAllInspections(prev => prev!.map(i => i.id === id ? updatedInspection : i));

        try {
            await updateInspection(id, inspectionData);
            toast({ title: t_dashboard('toast.success'), description: t_dashboard('toast.inspectionUpdated') });
            await refreshData(false);
        } catch (e: any) {
            setAllInspections(originalInspections);
            toast({ variant: "destructive", title: t_dashboard('toast.error'), description: e.message || t_dashboard('toast.inspectionUpdateError') });
        }
    };

    const handleDeleteInspection = async (id: string) => {
        const originalInspections = allInspections;
        setAllInspections(prev => prev!.filter(i => i.id !== id));

        try {
            await deleteInspection(id);
            toast({ title: t_dashboard('toast.success'), description: t_dashboard('toast.inspectionDeleted') });
        } catch(e: any) {
            setAllInspections(originalInspections);
            toast({ variant: "destructive", title: t_dashboard('toast.error'), description: e.message || t_dashboard('toast.inspectionDeleteError') });
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

    const handleDismissEmployee = async (employeeId: string) => {
        if (!currentUser) return false;
        
        const originalEmployees = allEmployees;
        const updatedData: Partial<Employee> = { status: 'dismissed', checkOutDate: new Date().toISOString().split('T')[0] };

        setAllEmployees(prev => prev!.map(e => e.id === employeeId ? Object.assign({}, e, updatedData) : e));

        try {
            await updateEmployee(employeeId, updatedData, currentUser);
            toast({ title: t_dashboard('toast.success'), description: t_dashboard('toast.employeeDismissed') });
            return true;
        } catch(e: any) {
            setAllEmployees(originalEmployees);
            toast({ variant: "destructive", title: t_dashboard('toast.error'), description: e.message || t_dashboard('toast.employeeDismissError') });
            return false;
        }
    };

    const handleRestoreEmployee = async (employeeId: string) => {
        if (!currentUser) return false;
        
        const originalEmployees = allEmployees;
        const updatedData: Partial<Employee> = { status: 'active', checkOutDate: null };
        
        setAllEmployees(prev => prev!.map(e => e.id === employeeId ? Object.assign({}, e, updatedData) : e));
        
        try {
            await updateEmployee(employeeId, updatedData, currentUser);
            toast({ title: t_dashboard('toast.success'), description: t_dashboard('toast.employeeRestored') });
            return true;
        } catch(e: any) {
            setAllEmployees(originalEmployees);
            toast({ variant: "destructive", title: t_dashboard('toast.error'), description: e.message || t_dashboard('toast.employeeRestoreError') });
            return false;
        }
    };
    
    const handleBulkDeleteEmployees = async (status: 'active' | 'dismissed') => {
        if (!currentUser || !currentUser.isAdmin) {
             toast({ variant: "destructive", title: t_dashboard('toast.permissionErrorTitle'), description: t_dashboard('toast.permissionErrorDescription') });
            return false;
        }
        
         try {
            await bulkDeleteEmployees(status, currentUser);
            toast({ title: t_dashboard('toast.success'), description: t_dashboard('toast.bulkDeleteSuccess', {status: status === 'active' ? t_dashboard('active') : t_dashboard('dismissed')}) });
            await refreshData(false);
             return true;
        } catch(e: any) {
            toast({ variant: "destructive", title: t_dashboard('toast.error'), description: e.message || t_dashboard('toast.bulkDeleteError') });
             return false;
        }
    }
    
    const handleBulkImport = async (fileData: ArrayBuffer) => {
      try {
          const result = await bulkImportEmployees(fileData, settings?.coordinators || [], currentUser as Coordinator);
          await refreshData(false);
          return result;
      } catch (e: any) {
          return { success: false, message: e.message || t_dashboard('toast.unknownError') };
      }
    };

    if (isAuthenticating || isLoadingData) {
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
    
    const contextValue: MainLayoutContextType = {
        allEmployees,
        allNonEmployees,
        allInspections,
        settings,
        currentUser,
        selectedCoordinatorId,
        setSelectedCoordinatorId,
        handleEditEmployeeClick,
        handleDismissEmployee,
        handleRestoreEmployee,
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
        handleDeleteInspection
    };

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
                                    <Link href={`?view=${item.view}`} passHref>
                                        <SidebarMenuButton 
                                            isActive={activeView === item.view}
                                            tooltip={t(item.label)}
                                            disabled={item.view === 'settings' && !currentUser?.isAdmin}
                                            asChild
                                        >
                                            <div>
                                                <item.icon />
                                                <span>{t(item.label)}</span>
                                            </div>
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
                        languageSwitcher={<LanguageSwitcher />}
                    />}
                    <main className="flex-1 overflow-y-auto px-2 sm:px-6 pb-6 pt-4">
                        {children}
                    </main>
                </div>
                
                {currentUser && <MobileNav activeView={activeView} setActiveView={(v) => router.push(`?view=${v}`)} navItems={visibleNavItems} currentUser={currentUser}/>}
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
