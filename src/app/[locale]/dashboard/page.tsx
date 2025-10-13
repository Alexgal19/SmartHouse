

"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DashboardView from '@/components/dashboard-view';
import EmployeesView from '@/components/employees-view';
import SettingsView from '@/components/settings-view';
import InspectionsView from '@/components/inspections-view';
import { AddEmployeeForm, type EmployeeFormData } from '@/components/add-employee-form';
import { AddNonEmployeeForm } from '@/components/add-non-employee-form';
import { getEmployees, getSettings, addEmployee, updateEmployee, updateSettings, getInspections, addInspection, updateInspection, deleteInspection, transferEmployees, bulkDeleteEmployees, bulkImportEmployees, getNonEmployees, addNonEmployee, updateNonEmployee, deleteNonEmployee, checkAndUpdateEmployeeStatuses } from '@/lib/actions';
import type { Employee, Settings, View, Coordinator, Inspection, NonEmployee } from '@/types';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/main-layout';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';

function DashboardPageContent() {
    const t = useTranslations('Dashboard');
    const searchParams = useSearchParams();
    const router = useRouter();
    const view = (searchParams.get('view') as View) || 'dashboard';
    const editEmployeeId = searchParams.get('edit');

    const [allEmployees, setAllEmployees] = useState<Employee[] | null>(null);
    const [allNonEmployees, setAllNonEmployees] = useState<NonEmployee[] | null>(null);
    const [allInspections, setAllInspections] = useState<Inspection[] | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState(t('loadingSettings'));
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isNonEmployeeFormOpen, setIsNonEmployeeFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [editingNonEmployee, setEditingNonEmployee] = useState<NonEmployee | null>(null);
    const [currentUser, setCurrentUser] = useState<Coordinator | null>(null);
    const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('all');
    
    const { toast } = useToast();
    
    useEffect(() => {
        // Ensure this runs only on the client
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
    }, [router]);

    const refreshData = useCallback(async (showToast = true) => {
        if (!currentUser) return;
        try {
            const coordinatorIdToFetch = currentUser.isAdmin ? undefined : currentUser.uid;
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
                toast({ title: t('toast.refreshSuccessTitle'), description: t('toast.refreshSuccessDescription') });
            }
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: t('toast.refreshErrorTitle'),
                description: `${t('toast.refreshErrorDescription')} ${error instanceof Error ? error.message : ''}`,
            });
        }
    }, [toast, currentUser, t]);

    const handleRefreshStatuses = useCallback(async (showNoChangesToast = true) => {
        if (!currentUser) return;
        try {
            const { updated } = await checkAndUpdateEmployeeStatuses(currentUser);
            if (updated > 0) {
                toast({ title: t('toast.statusUpdateSuccessTitle'), description: t('toast.statusUpdateSuccessDescription', {count: updated})});
                await refreshData(false);
            } else if (showNoChangesToast) {
                 toast({ title: t('toast.statusUpdateNoChangesTitle'), description: t('toast.statusUpdateNoChangesDescription')});
            }
        } catch (e: any) {
            toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.statusUpdateError') });
        }
    }, [currentUser, refreshData, toast, t]);

    const fetchAllData = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            setLoadingMessage(t('loadingSettings'));
            const settingsData = await getSettings();
            setSettings(settingsData);
            
            setLoadingMessage(t('loadingData'));
            const coordinatorIdToFetch = currentUser.isAdmin ? undefined : currentUser.uid;

            const [employeesData, inspectionsData, nonEmployeesData] = await Promise.all([
                getEmployees(coordinatorIdToFetch),
                getInspections(coordinatorIdToFetch),
                getNonEmployees(),
            ]);

            setAllEmployees(employeesData);
            setAllInspections(inspectionsData);
            setAllNonEmployees(nonEmployeesData);
            
        } catch (error) {
             console.error("Critical data loading error:", error);
            toast({
                variant: "destructive",
                title: t('toast.criticalErrorTitle'),
                description: `${t('toast.criticalErrorDescription')} ${error instanceof Error ? error.message : ''}`,
                duration: 10000,
            });
             return;
        } finally {
             setIsLoading(false);
        }
    }, [toast, currentUser, t]);

    useEffect(() => {
        if (currentUser) {
            fetchAllData().then(() => {
                handleRefreshStatuses(false);
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

    
    useEffect(() => {
        if (editEmployeeId && allEmployees) {
            const employeeToEdit = allEmployees.find(e => e.id === editEmployeeId);
            if (employeeToEdit) {
                setEditingEmployee(employeeToEdit);
                setIsFormOpen(true);
                router.replace('/dashboard?view=employees', { scroll: false });
            }
        }
    }, [editEmployeeId, allEmployees, router]);


    const filteredEmployees = useMemo(() => {
        if (!currentUser || !allEmployees) return [];
        if (currentUser.isAdmin) {
            if (selectedCoordinatorId === 'all') {
                return allEmployees;
            }
            return allEmployees.filter(e => e.coordinatorId === selectedCoordinatorId);
        }
        return allEmployees.filter(e => e.coordinatorId === currentUser.uid);
    }, [currentUser, allEmployees, selectedCoordinatorId]);

    const filteredNonEmployees = useMemo(() => {
        if (!currentUser || !allNonEmployees || !allEmployees) return [];
        if (currentUser.isAdmin && selectedCoordinatorId !== 'all') {
             const coordinatorAddresses = new Set(
                allEmployees
                    .filter(e => e.coordinatorId === selectedCoordinatorId)
                    .map(e => e.address)
            );
             return allNonEmployees.filter(ne => ne.address && coordinatorAddresses.has(ne.address));
        }
       return allNonEmployees;
   }, [currentUser, allNonEmployees, allEmployees, selectedCoordinatorId]);

    const filteredInspections = useMemo(() => {
        if (!currentUser || !allInspections) return [];
        if (currentUser.isAdmin) {
            if (selectedCoordinatorId === 'all') {
                return allInspections;
            }
            return allInspections.filter(i => i.coordinatorId === selectedCoordinatorId);
        }
        return allInspections.filter(i => i.coordinatorId === currentUser.uid);
    }, [currentUser, allInspections, selectedCoordinatorId]);


    const handleSaveEmployee = async (data: EmployeeFormData) => {
        if (!currentUser) return;
        
        try {
            if (editingEmployee) {
                const updatedData: Partial<Employee> = { ...data };
                if (editingEmployee && data.address !== editingEmployee.address) {
                  updatedData.oldAddress = editingEmployee.address;
                } else if (editingEmployee) {
                  updatedData.oldAddress = editingEmployee.oldAddress;
                }
                
                await updateEmployee(editingEmployee.id, updatedData, currentUser)
                toast({ title: t('toast.success'), description: t('toast.employeeUpdated') });
            } else {
                await addEmployee(data, currentUser);
                toast({ title: t('toast.success'), description: t('toast.employeeAdded') });
            }
            await refreshData(false);
        } catch (e: any) {
            toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.employeeSaveError') });
        }
    };

    const handleSaveNonEmployee = async (data: Omit<NonEmployee, 'id'>) => {
        if (editingNonEmployee) {
            try {
                await updateNonEmployee(editingNonEmployee.id, data);
                toast({ title: t('toast.success'), description: t('toast.nonEmployeeUpdated') });
            } catch(e: any) {
                toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.nonEmployeeSaveError') });
            }
        } else {
             try {
                await addNonEmployee(data);
                toast({ title: t('toast.success'), description: t('toast.nonEmployeeAdded') });
            } catch (e: any) {
                toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.nonEmployeeAddError') });
            }
        }
        await refreshData(false);
    }
    
    const handleDeleteNonEmployee = async (id: string) => {
        const originalNonEmployees = allNonEmployees;
        
        setAllNonEmployees(prev => prev!.filter(ne => ne.id !== id));
        
        try {
            await deleteNonEmployee(id);
            toast({ title: t('toast.success'), description: t('toast.nonEmployeeDeleted') });
        } catch(e: any) {
            setAllNonEmployees(originalNonEmployees); // Revert
            toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.nonEmployeeDeleteError') });
        }
    }
    
    const handleUpdateSettings = async (newSettings: Partial<Settings>) => {
        if (!settings || !currentUser?.isAdmin) {
             toast({ variant: "destructive", title: t('toast.permissionErrorTitle'), description: t('toast.permissionErrorDescription') });
            return;
        }

        const originalSettings = settings;
        setSettings(prev => ({ ...prev!, ...newSettings }));

        try {
            await updateSettings(newSettings);
            toast({ title: t('toast.success'), description: t('toast.settingsUpdated') });
        } catch(e: any) {
            setSettings(originalSettings); // Revert on error
            toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.settingsUpdateError') });
        }
    };
    
    const handleAddInspection = async (inspectionData: Omit<Inspection, 'id'>) => {
        try {
            await addInspection(inspectionData);
            toast({ title: t('toast.success'), description: t('toast.inspectionAdded') });
            await refreshData(false);
        } catch(e: any) {
            toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.inspectionAddError') });
        }
    };

    const handleUpdateInspection = async (id: string, inspectionData: Omit<Inspection, 'id'>) => {
        const originalInspections = allInspections;
        const updatedInspection = { ...inspectionData, id };
        setAllInspections(prev => prev!.map(i => i.id === id ? updatedInspection : i));

        try {
            await updateInspection(id, inspectionData);
            toast({ title: t('toast.success'), description: t('toast.inspectionUpdated') });
            await refreshData(false);
        } catch (e: any) {
            setAllInspections(originalInspections);
            toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.inspectionUpdateError') });
        }
    };

    const handleDeleteInspection = async (id: string) => {
        const originalInspections = allInspections;
        setAllInspections(prev => prev!.filter(i => i.id !== id));

        try {
            await deleteInspection(id);
            toast({ title: t('toast.success'), description: t('toast.inspectionDeleted') });
        } catch(e: any) {
            setAllInspections(originalInspections);
            toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.inspectionDeleteError') });
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

        // Optimistic update
        setAllEmployees(prev => prev!.map(e => e.id === employeeId ? Object.assign({}, e, updatedData) : e));

        try {
            await updateEmployee(employeeId, updatedData, currentUser);
            toast({ title: t('toast.success'), description: t('toast.employeeDismissed') });
            return true;
        } catch(e: any) {
            setAllEmployees(originalEmployees); // Revert
            toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.employeeDismissError') });
            return false;
        }
    };

    const handleRestoreEmployee = async (employeeId: string) => {
        if (!currentUser) return false;
        
        const originalEmployees = allEmployees;
        const updatedData: Partial<Employee> = { status: 'active', checkOutDate: null };
        
        // Optimistic update
        setAllEmployees(prev => prev!.map(e => e.id === employeeId ? Object.assign({}, e, updatedData) : e));
        
        try {
            await updateEmployee(employeeId, updatedData, currentUser);
            toast({ title: t('toast.success'), description: t('toast.employeeRestored') });
            return true;
        } catch(e: any) {
            setAllEmployees(originalEmployees); // Revert
            toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.employeeRestoreError') });
            return false;
        }
    };
    
    const handleBulkDeleteEmployees = async (status: 'active' | 'dismissed') => {
        if (!currentUser || !currentUser.isAdmin) {
             toast({ variant: "destructive", title: t('toast.permissionErrorTitle'), description: t('toast.permissionErrorDescription') });
            return false;
        }
        
         try {
            await bulkDeleteEmployees(status, currentUser);
            toast({ title: t('toast.success'), description: t('toast.bulkDeleteSuccess', {status: status === 'active' ? t('active') : t('dismissed')}) });
            await refreshData(false);
             return true;
        } catch(e: any) {
            toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.bulkDeleteError') });
             return false;
        }
    }
    
    const handleBulkImport = async (fileData: ArrayBuffer) => {
      try {
          const result = await bulkImportEmployees(fileData, settings?.coordinators || [], currentUser as Coordinator);
          await refreshData(false);
          return result;
      } catch (e: any) {
          return { success: false, message: e.message || t('toast.unknownError') };
      }
    };

    if (isLoading || !currentUser || !settings) {
        return (
             <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex animate-fade-in flex-col items-center gap-6">
                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent drop-shadow-sm">
                        SmartHouse
                    </h1>
                    <p className="text-muted-foreground">{loadingMessage}</p>
                </div>
            </div>
        )
    }

    const renderView = () => {
        switch (view) {
            case 'dashboard':
                return <DashboardView employees={filteredEmployees} allEmployees={allEmployees || []} nonEmployees={filteredNonEmployees || []} settings={settings} onEditEmployee={handleEditEmployeeClick} currentUser={currentUser} selectedCoordinatorId={selectedCoordinatorId} onSelectCoordinator={setSelectedCoordinatorId} onDataRefresh={() => handleRefreshStatuses(true)} />;
            case 'employees':
                return <EmployeesView employees={filteredEmployees} nonEmployees={filteredNonEmployees || []} settings={settings} onAddEmployee={handleAddEmployeeClick} onEditEmployee={handleEditEmployeeClick} onDismissEmployee={handleDismissEmployee} onRestoreEmployee={handleRestoreEmployee} onBulkDelete={handleBulkDeleteEmployees} currentUser={currentUser} onAddNonEmployee={handleAddNonEmployeeClick} onEditNonEmployee={handleEditNonEmployeeClick} onDeleteNonEmployee={handleDeleteNonEmployee} />;
            case 'settings':
                if (!currentUser.isAdmin) {
                    return <div className="p-4 text-center text-red-500">{t('noPermission')}</div>;
                }
                return <SettingsView settings={settings} onUpdateSettings={handleUpdateSettings} allEmployees={allEmployees || []} currentUser={currentUser} onDataRefresh={() => refreshData(false)} onBulkImport={handleBulkImport}/>;
            case 'inspections':
                 return <InspectionsView 
                    inspections={filteredInspections || []} 
                    settings={settings}
                    currentUser={currentUser}
                    onAddInspection={handleAddInspection}
                    onUpdateInspection={handleUpdateInspection}
                    onDeleteInspection={handleDeleteInspection}
                />;
            default:
                return <DashboardView employees={filteredEmployees} allEmployees={allEmployees || []} nonEmployees={filteredNonEmployees || []} settings={settings} onEditEmployee={handleEditEmployeeClick} currentUser={currentUser} selectedCoordinatorId={selectedCoordinatorId} onSelectCoordinator={setSelectedCoordinatorId} onDataRefresh={() => handleRefreshStatuses(true)} />;
        }
    };

    return (
        <MainLayout>
            <div key={view} className={cn("animate-in fade-in-0 duration-300")}>
                {renderView()}
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
        </MainLayout>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DashboardPageContent />
        </Suspense>
    )
}
