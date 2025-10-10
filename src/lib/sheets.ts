
"use server";
import 'dotenv/config';
// src/lib/sheets.ts
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Employee, Settings, Notification, Coordinator, NotificationChange, HousingAddress, Room, Inspection, InspectionCategory, InspectionCategoryItem, Photo, InspectionDetail, NonEmployee, DeductionReason } from '@/types';
import { format, isValid, parse } from 'date-fns';

// ⚙️ Константа для формату дати в Google Sheets
// ПРИМІТКА: Якщо дати зберігаються в іншому форматі (наприклад, 'yyyy-MM-dd' або 'MM/dd/yyyy'),
// цю константу потрібно буде змінити.
const SHEET_DATE_FORMAT = 'dd.MM.yyyy'; 

// 🎯 Хелпер функція для безпечного парсингу дати
const parseDateString = (dateString: string | undefined): string | undefined => {
    if (!dateString) {
        return undefined;
    }

    // 1. Спроба парсингу
    const parsedDate = parse(dateString, SHEET_DATE_FORMAT, new Date());
    
    // 2. Валідація
    if (isValid(parsedDate)) {
        // Повертаємо дату у стандартному форматі ISO для безпечного використання в TypeScript/JS
        return format(parsedDate, 'yyyy-MM-dd'); 
    }
    
    // Якщо парсинг за форматом не вдався, спробуємо нативний Date() як резервний варіант
    const nativeDate = new Date(dateString);
    if(isValid(nativeDate)) {
         return format(nativeDate, 'yyyy-MM-dd');
    }

    console.warn(`Invalid or unrecognized date format for string: ${dateString}`);
    return undefined;
};


const SPREADSHEET_ID = '1UYe8N29Q3Eus-6UEOkzCNfzwSKmQ-kpITgj4SWWhpbw';
const SHEET_NAME_EMPLOYEES = 'Employees';
const SHEET_NAME_NON_EMPLOYEES = 'NonEmployees';
const SHEET_NAME_NOTIFICATIONS = 'Powiadomienia';
const SHEET_NAME_ADDRESSES = 'Addresses';
const SHEET_NAME_ROOMS = 'Rooms';
const SHEET_NAME_NATIONALITIES = 'Nationalities';
const SHEET_NAME_DEPARTMENTS = 'Departments';
const SHEET_NAME_COORDINATORS = 'Coordinators';
const SHEET_NAME_GENDERS = 'Genders';
const SHEET_NAME_INSPECTIONS = 'Inspections';
const SHEET_NAME_INSPECTION_DETAILS = 'InspectionDetails';


const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

const deserializeEmployee = (row: any): Employee | null => {
    const id = row.get('id');
    const fullName = row.get('fullName');
    
    // Ignore empty rows
    if (!id && !fullName) {
        return null;
    }

    // ✅ Використовуємо parseDateString для надійної обробки
    const checkInDate = parseDateString(row.get('checkInDate'));
    if (!checkInDate) {
        console.warn(`Invalid or missing checkInDate for employee row, but loading anyway: ${id || fullName}`);
    }

    const deductionReasonRaw = row.get('deductionReason');
    let deductionReason: DeductionReason[] | undefined = undefined;
    if (deductionReasonRaw && typeof deductionReasonRaw === 'string') {
        try {
            const parsed = JSON.parse(deductionReasonRaw);
            if(Array.isArray(parsed)) {
                deductionReason = parsed;
            }
        } catch(e) {
            // It's probably an old string array, try to adapt it
            try {
                // Оскільки JSON.parse('[...некоректний_рядок...]') може впасти
                // Ми залишаємо цю складну логіку для міграції, але вона ризикована.
                const oldArray = JSON.parse(`[${deductionReasonRaw}]`);
                 if(Array.isArray(oldArray)){
                    deductionReason = oldArray.map((name: string) => ({ name, checked: true, amount: null }));
                 }
            } catch (e2) {
                 // Or just a single string
                 if(deductionReasonRaw.trim()) {
                    deductionReason = [{ name: deductionReasonRaw, checked: true, amount: null }];
                 }
            }
        }
    }

    return {
        id: id,
        fullName: fullName,
        coordinatorId: row.get('coordinatorId'),
        nationality: row.get('nationality'),
        gender: row.get('gender') as string,
        address: row.get('address'),
        roomNumber: row.get('roomNumber'),
        zaklad: row.get('zaklad'),
        checkInDate: checkInDate || '', // Залишаємо fallback до порожнього рядка, якщо тип Employee['checkInDate'] це дозволяє
        checkOutDate: parseDateString(row.get('checkOutDate')),
        contractStartDate: parseDateString(row.get('contractStartDate')),
        contractEndDate: parseDateString(row.get('contractEndDate')),
        departureReportDate: parseDateString(row.get('departureReportDate')),
        comments: row.get('comments'),
        status: row.get('status') as 'active' | 'dismissed',
        oldAddress: row.get('oldAddress') || undefined,
        depositReturned: row.get('depositReturned') as Employee['depositReturned'] || null,
        depositReturnAmount: row.get('depositReturnAmount') ? parseFloat(row.get('depositReturnAmount')) : null,
        deductionRegulation: row.get('deductionRegulation') ? parseFloat(row.get('deductionRegulation')) : null,
        deductionNo4Months: row.get('deductionNo4Months') ? parseFloat(row.get('deductionNo4Months')) : null,
        deductionNo30Days: row.get('deductionNo30Days') ? parseFloat(row.get('deductionNo30Days')) : null,
        deductionReason: deductionReason,
    };
};

const deserializeNonEmployee = (row: any): NonEmployee | null => {
    const id = row.get('id');
    const fullName = row.get('fullName');
    
    if (!id && !fullName) {
        return null;
    }

    // ✅ Використовуємо parseDateString
    const checkInDate = parseDateString(row.get('checkInDate'));
    if (!checkInDate) {
        return null; // Залишаємо логіку, що NonEmployee без checkInDate ігнорується
    }

    return {
        id: id,
        fullName: fullName,
        address: row.get('address'),
        roomNumber: row.get('roomNumber'),
        checkInDate: checkInDate,
        checkOutDate: parseDateString(row.get('checkOutDate')),
        comments: row.get('comments'),
    };
};

const deserializeNotification = (row: any): Notification => {
    const createdAtString = row.get('createdAt');
    // ⚠️ Тут потрібно повернути об'єкт Date, а не рядок.
    let createdAt: Date;
    
    // Спробуємо розпарсити як Date, використовуючи обидва формати (SHEET_DATE_FORMAT та нативний)
    const parsedByFormat = parse(createdAtString, SHEET_DATE_FORMAT, new Date());
    const parsedNatively = new Date(createdAtString);

    if (isValid(parsedByFormat)) {
        createdAt = parsedByFormat;
    } else if (isValid(parsedNatively)) {
        createdAt = parsedNatively;
    } else {
        console.error(`Invalid date string for notification: ${createdAtString}`);
        createdAt = new Date(0); // Fallback до мінімальної дати
    }

    const changesString = row.get('changes');
    return {
        id: row.get('id'),
        message: row.get('message'),
        employeeId: row.get('employeeId'),
        employeeName: row.get('employeeName'),
        coordinatorId: row.get('coordinatorId'),
        coordinatorName: row.get('coordinatorName'),
        createdAt: createdAt,
        isRead: row.get('isRead') === 'TRUE',
        changes: changesString ? JSON.parse(changesString) : [],
    };
};

const EMPLOYEE_HEADERS = [
    'id', 'fullName', 'coordinatorId', 'nationality', 'gender', 'address', 'roomNumber', 
    'zaklad', 'checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 
    'departureReportDate', 'comments', 'status', 'oldAddress',
    'depositReturned', 'depositReturnAmount', 'deductionRegulation', 'deductionNo4Months', 'deductionNo30Days', 'deductionReason'
];

const NON_EMPLOYEE_HEADERS = [
    'id', 'fullName', 'address', 'roomNumber', 'checkInDate', 'checkOutDate', 'comments'
];

const COORDINATOR_HEADERS = ['uid', 'name', 'isAdmin', 'password'];

export async function getSheet(title: string, headers: string[]): Promise<GoogleSpreadsheetWorksheet> {
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        sheet = await doc.addSheet({ title, headerValues: headers });
    } else {
        await sheet.loadHeaderRow();
        const currentHeaders = sheet.headerValues;
        const missingHeaders = headers.filter(h => !currentHeaders.includes(h));
        if(missingHeaders.length > 0) {
            await sheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
        }
    }
    return sheet;
}


export async function getEmployeesFromSheet({
    page = 1,
    limit = 50,
    filters = {},
    searchTerm = '',
    status = 'all',
    all = false
}: {
    page?: number;
    limit?: number;
    filters?: Record<string, string>;
    searchTerm?: string;
    status?: 'active' | 'dismissed' | 'all';
    all?: boolean;
} = {}): Promise<{ employees: Employee[], total: number }> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        
        const allEmployees = rows.map(deserializeEmployee).filter((e): e is Employee => e !== null);

        if (all) {
            return { employees: allEmployees, total: allEmployees.length };
        }

        const filtered = allEmployees.filter(employee => {
          _fetchData(false);
        }
    }, [fetchData]);

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
        
        try {
            if (editingEmployee) {
                await updateEmployee(editingEmployee.id, data, currentUser);
                 toast({ title: "Sukces", description: "Dane pracownika zostały zaktualizowane." });
            } else {
                 await addEmployee(data, currentUser);
                 toast({ title: "Sukces", description: "Nowy pracownik został dodany." });
            }
            // Refetch all data to ensure UI consistency
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
        try {
            await clearAllNotifications();
            setAllNotifications([]);
            toast({ title: "Sukces", description: "Wszystkie powiadomienia zostały usunięte." });
        } catch (e: any) {
             toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się usunąć powiadomień." });
        }
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

    const renderView = () => {
        if (!currentUser || !settings) {
            return null;
        }

        switch (activeView) {
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
