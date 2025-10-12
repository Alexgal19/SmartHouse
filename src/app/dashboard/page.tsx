
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DashboardView from '@/components/dashboard-view';
import EmployeesView from '@/components/employees-view';
import SettingsView from '@/components/settings-view';
import InspectionsView from '@/components/inspections-view';
import { AddEmployeeForm } from '@/components/add-employee-form';
import { AddNonEmployeeForm } from '@/components/add-non-employee-form';
import { getAllEmployees, getSettings, addEmployee, updateEmployee, updateSettings, getInspections, addInspection, updateInspection, deleteInspection, transferEmployees, bulkDeleteEmployees, bulkImportEmployees, getNonEmployees, addNonEmployee, updateNonEmployee, deleteNonEmployee, checkAndUpdateEmployeeStatuses } from '@/lib/actions';
import type { Employee, Settings, View, Coordinator, Inspection, NonEmployee } from '@/types';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/main-layout';
import { cn } from '@/lib/utils';

function DashboardPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const view = (searchParams.get('view') as View) || 'dashboard';
    const editEmployeeId = searchParams.get('edit');

    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [allNonEmployees, setAllNonEmployees] = useState<NonEmployee[]>([]);
    const [allInspections, setAllInspections] = useState<Inspection[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isNonEmployeeFormOpen, setIsNonEmployeeFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [editingNonEmployee, setEditingNonEmployee] = useState<NonEmployee | null>(null);
    const [currentUser, setCurrentUser] = useState<Coordinator | null>(null);
    const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('all');
    
    const { toast } = useToast();
    
    const fetchData = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) setIsLoading(true);
        try {
            const [employeesData, settingsData, inspectionsData, nonEmployeesData] = await Promise.all([
                getAllEmployees(), 
                getSettings(),
                getInspections(),
                getNonEmployees(),
            ]);
            setAllEmployees(employeesData);
            setAllNonEmployees(nonEmployeesData);
            setSettings(settingsData);
            setAllInspections(inspectionsData.map((i: any) => ({...i, date: new Date(i.date)})));
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Błąd ładowania danych",
                description: `Nie udało się pobrać danych z serwera. ${error instanceof Error ? error.message : ''}`,
            });
        } finally {
            if (isInitialLoad) setIsLoading(false);
        }
    }, [toast]);
    
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

    useEffect(() => {
        if (currentUser) {
            fetchData(true);
        }
    }, [currentUser, fetchData]);

    useEffect(() => {
        if (editEmployeeId) {
            const employeeToEdit = allEmployees.find(e => e.id === editEmployeeId);
            if (employeeToEdit) {
                setEditingEmployee(employeeToEdit);
                setIsFormOpen(true);
                // Clean the URL
                router.replace('/dashboard?view=employees', { scroll: false });
            }
        }
    }, [editEmployeeId, allEmployees, router]);


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
        if (!currentUser) return [];
        if (currentUser.isAdmin) {
            if (selectedCoordinatorId === 'all') {
                return allInspections;
            }
            return allInspections.filter(i => i.coordinatorId === selectedCoordinatorId);
        }
        return allInspections.filter(i => i.coordinatorId === currentUser.uid);
    }, [currentUser, allInspections, selectedCoordinatorId]);


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
            if (editingNonEmployee) {
                await updateNonEmployee(editingNonEmployee.id, data)
            } else {
                await addNonEmployee(data);
            }
            toast({ title: "Sukces", description: editingNonEmployee ? "Dane mieszkańca zostały zaktualizowane." : "Nowy mieszkaniec został dodany." });
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

    const handleDismissEmployee = async (employeeId: string) => {
        if (!currentUser) return false;
        try {
            await updateEmployee(employeeId, { status: 'dismissed', checkOutDate: new Date().toISOString().split('T')[0] }, currentUser);
            toast({ title: "Sukces", description: "Pracownik został zwolniony." });
            fetchData();
            return true;
        } catch(e: any) {
            toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się zwolnić pracownika." });
            return false;
        }
    };

    const handleRestoreEmployee = async (employeeId: string) => {
        if (!currentUser) return false;
        try {
            await updateEmployee(employeeId, { status: 'active', checkOutDate: null }, currentUser);
            toast({ title: "Sukces", description: "Pracownik został przywrócony." });
            fetchData();
            return true;
        } catch(e: any) {
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
            fetchData();
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
                fetchData();
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

    if (isLoading || !currentUser || !settings) {
        return (
             <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex animate-fade-in flex-col items-center gap-6">
                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent drop-shadow-sm">
                        SmartHouse
                    </h1>
                    <p className="text-muted-foreground">Ładowanie danych...</p>
                </div>
            </div>
        )
    }

    const renderView = () => {
        switch (view) {
            case 'dashboard':
                return <DashboardView employees={filteredEmployees} allEmployees={allEmployees} nonEmployees={filteredNonEmployees} settings={settings} onEditEmployee={handleEditEmployeeClick} currentUser={currentUser} selectedCoordinatorId={selectedCoordinatorId} onSelectCoordinator={setSelectedCoordinatorId} onDataRefresh={handleRefreshStatuses} />;
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
                return <DashboardView employees={filteredEmployees} allEmployees={allEmployees} nonEmployees={filteredNonEmployees} settings={settings} onEditEmployee={handleEditEmployeeClick} currentUser={currentUser} selectedCoordinatorId={selectedCoordinatorId} onSelectCoordinator={setSelectedCoordinatorId} onDataRefresh={handleRefreshStatuses} />;
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

    