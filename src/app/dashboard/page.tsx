
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

function DashboardPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const view = (searchParams.get('view') as View) || 'dashboard';
    const editEmployeeId = searchParams.get('edit');

    const [allEmployees, setAllEmployees] = useState<Employee[] | null>(null);
    const [allNonEmployees, setAllNonEmployees] = useState<NonEmployee[] | null>(null);
    const [allInspections, setAllInspections] = useState<Inspection[] | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('Ładowanie ustawień...');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isNonEmployeeFormOpen, setIsNonEmployeeFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [editingNonEmployee, setEditingNonEmployee] = useState<NonEmployee | null>(null);
    const [currentUser, setCurrentUser] = useState<Coordinator | null>(null);
    const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('all');
    
    const { toast } = useToast();
    
    useEffect(() => {
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

    const fetchAllData = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            setLoadingMessage('Ładowanie ustawień...');
            const settingsData = await getSettings();
            setSettings(settingsData);
            
            setLoadingMessage('Ładowanie danych...');
            const coordinatorIdToFetch = currentUser.isAdmin ? undefined : currentUser.uid;

            const [employeesData, inspectionsData, nonEmployeesData] = await Promise.all([
                getEmployees(coordinatorIdToFetch),
                getInspections(coordinatorIdToFetch),
                getNonEmployees(), // Non-employees are not tied to coordinators
            ]);

            setAllEmployees(employeesData);
            setAllInspections(inspectionsData);
            setAllNonEmployees(nonEmployeesData);
            
        } catch (error) {
             console.error("Critical data loading error:", error);
            toast({
                variant: "destructive",
                title: "Błąd krytyczny ładowania danych",
                description: `Nie udało się pobrać podstawowych danych z serwera. ${error instanceof Error ? error.message : ''}`,
                duration: 10000,
            });
             // Keep loading state on critical error to prevent broken UI
             return;
        } finally {
             setIsLoading(false);
        }
    }, [toast, currentUser]);

    useEffect(() => {
        if (currentUser) {
            fetchAllData();
        }
    }, [currentUser, fetchAllData]);

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
                toast({ title: "Sukces", description: "Dane zostały odświeżone." });
            }
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Błąd odświeżania danych",
                description: `Nie udało się pobrać danych z serwera. ${error instanceof Error ? error.message : ''}`,
            });
        }
    }, [toast, currentUser]);
    
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
                toast({ title: "Sukces", description: "Dane pracownika zostały zaktualizowane." });
            } else {
                await addEmployee(data, currentUser);
                toast({ title: "Sukces", description: "Nowy pracownik został dodany." });
            }
            await refreshData(false);
        } catch (e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zapisać pracownika." });
        }
    };

    const handleSaveNonEmployee = async (data: Omit<NonEmployee, 'id'>) => {
        if (editingNonEmployee) {
            try {
                await updateNonEmployee(editingNonEmployee.id, data);
                toast({ title: "Sukces", description: "Dane mieszkańca zostały zaktualizowane." });
            } catch(e: any) {
                toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zapisać mieszkańca." });
            }
        } else {
             try {
                await addNonEmployee(data);
                toast({ title: "Sukces", description: "Nowy mieszkaniec został dodany." });
            } catch (e: any) {
                toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się dodać mieszkańca." });
            }
        }
        await refreshData(false);
    }
    
    const handleDeleteNonEmployee = async (id: string) => {
        const originalNonEmployees = allNonEmployees;
        
        setAllNonEmployees(prev => prev!.filter(ne => ne.id !== id));
        
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
        setSettings(prev => ({ ...prev!, ...newSettings }));

        try {
            await updateSettings(newSettings);
            toast({ title: "Sukces", description: "Ustawienia zostały zaktualizowane." });
        } catch(e: any) {
            setSettings(originalSettings); // Revert on error
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zapisać ustawień." });
        }
    };
    
    const handleAddInspection = async (inspectionData: Omit<Inspection, 'id'>) => {
        try {
            await addInspection(inspectionData);
            toast({ title: "Sukces", description: "Nowa inspekcja została dodana." });
            await refreshData(false);
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się dodać inspekcji." });
        }
    };

    const handleUpdateInspection = async (id: string, inspectionData: Omit<Inspection, 'id'>) => {
        const originalInspections = allInspections;
        const updatedInspection = { ...inspectionData, id };
        setAllInspections(prev => prev!.map(i => i.id === id ? updatedInspection : i));

        try {
            await updateInspection(id, inspectionData);
            toast({ title: "Sukces", description: "Inspekcja została zaktualizowana." });
            await refreshData(false);
        } catch (e: any) {
            setAllInspections(originalInspections);
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zaktualizować inspekcji." });
        }
    };

    const handleDeleteInspection = async (id: string) => {
        const originalInspections = allInspections;
        setAllInspections(prev => prev!.filter(i => i.id !== id));

        try {
            await deleteInspection(id);
            toast({ title: "Sukces", description: "Inspekcja została usunięta." });
        } catch(e: any) {
            setAllInspections(originalInspections);
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

    const handleDismissEmployee = async (employeeId: string) => {
        if (!currentUser) return false;
        
        const originalEmployees = allEmployees;
        const updatedData: Partial<Employee> = { status: 'dismissed', checkOutDate: new Date().toISOString().split('T')[0] };

        // Optimistic update
        setAllEmployees(prev => prev!.map(e => e.id === employeeId ? Object.assign({}, e, updatedData) : e));

        try {
            await updateEmployee(employeeId, updatedData, currentUser);
            toast({ title: "Sukces", description: "Pracownik został zwolniony." });
            return true;
        } catch(e: any) {
            setAllEmployees(originalEmployees); // Revert
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zwolnić pracownika." });
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
            toast({ title: "Sukces", description: "Pracownik został przywrócony." });
            return true;
        } catch(e: any) {
            setAllEmployees(originalEmployees); // Revert
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się przywrócić pracownika." });
            return false;
        }
    };
    
    const handleBulkDeleteEmployees = async (status: 'active' | 'dismissed') => {
        if (!currentUser || !currentUser.isAdmin) {
             toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administrator może usuwać pracowników." });
            return false;
        }
        
         try {
            await bulkDeleteEmployees(status, currentUser);
            toast({ title: "Sukces", description: `Wszyscy ${status === 'active' ? 'aktywni' : 'zwolnieni'} pracownicy zostali usunięci.` });
            await refreshData(false);
             return true;
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || `Nie udało się usunąć pracowników.` });
             return false;
        }
    }

    const handleRefreshStatuses = async () => {
        if (!currentUser) return;
        try {
            const { updated } = await checkAndUpdateEmployeeStatuses(currentUser);
            if (updated > 0) {
                toast({ title: "Sukces", description: `Zaktualizowano statusy dla ${updated} pracowników.`});
                await refreshData(false);
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
          await refreshData(false);
          return result;
      } catch (e: any) {
          return { success: false, message: e.message || "Wystąpił nieznany błąd." };
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
                return <DashboardView employees={filteredEmployees} allEmployees={allEmployees || []} nonEmployees={filteredNonEmployees || []} settings={settings} onEditEmployee={handleEditEmployeeClick} currentUser={currentUser} selectedCoordinatorId={selectedCoordinatorId} onSelectCoordinator={setSelectedCoordinatorId} onDataRefresh={handleRefreshStatuses} />;
            case 'employees':
                return <EmployeesView employees={filteredEmployees} nonEmployees={filteredNonEmployees || []} settings={settings} onAddEmployee={handleAddEmployeeClick} onEditEmployee={handleEditEmployeeClick} onDismissEmployee={handleDismissEmployee} onRestoreEmployee={handleRestoreEmployee} onBulkDelete={handleBulkDeleteEmployees} currentUser={currentUser} onAddNonEmployee={handleAddNonEmployeeClick} onEditNonEmployee={handleEditNonEmployeeClick} onDeleteNonEmployee={handleDeleteNonEmployee} />;
            case 'settings':
                if (!currentUser.isAdmin) {
                    return <div className="p-4 text-center text-red-500">Brak uprawnień do przeglądania tej strony.</div>;
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
                return <DashboardView employees={filteredEmployees} allEmployees={allEmployees || []} nonEmployees={filteredNonEmployees || []} settings={settings} onEditEmployee={handleEditEmployeeClick} currentUser={currentUser} selectedCoordinatorId={selectedCoordinatorId} onSelectCoordinator={setSelectedCoordinatorId} onDataRefresh={handleRefreshStatuses} />;
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
        <React.Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-background"><p>Ładowanie komponentów...</p></div>}>
             <DashboardPageContent />
        </React.Suspense>
    )
}
