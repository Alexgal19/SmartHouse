
"use client"
import React, { useState, useMemo, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Employee, Settings, NonEmployee, SessionData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, SlidersHorizontal, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, X, Users, UserX, LayoutGrid, List, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useMainLayout } from '@/components/main-layout';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const ITEMS_PER_PAGE = 20;

const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
        return format(new Date(dateString + 'T00:00:00'), 'dd-MM-yyyy');
    } catch {
        return 'Invalid Date';
    }
}

type Entity = Employee | NonEmployee;

const isEmployee = (entity: Entity): entity is Employee => 'coordinatorId' in entity && 'zaklad' in entity;

const EntityActions = ({
  entity,
  onEdit,
  onDismiss,
  onRestore,
  onPermanentDelete,
  isDismissed,
}: {
  entity: Entity;
  onEdit: (entity: Entity) => void;
  onDismiss?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete: (id: string, type: 'employee' | 'non-employee') => void;
  isDismissed: boolean;
}) => {
  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Otwórz menu</span>
            <MoreHorizontal className="h-4 w-4" />
        </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(entity)}>Edytuj</DropdownMenuItem>
            {isEmployee(entity) && (
                isDismissed 
                ? <DropdownMenuItem onClick={() => onRestore?.(entity.id)}>Przywróć</DropdownMenuItem>
                : <DropdownMenuItem onClick={() => onDismiss?.(entity.id)}>Zwolnij</DropdownMenuItem>
            )}
             <DropdownMenuSeparator />
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <DropdownMenuItem 
                        className="text-destructive"
                        onSelect={(e) => e.preventDefault()}
                    >
                       <Trash2 className="mr-2 h-4 w-4" />
                        Usuń na zawsze
                    </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Czy na pewno chcesz trwale usunąć ten wpis?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Ta operacja jest nieodwracalna. Wszystkie dane powiązane z <span className="font-bold">{entity.fullName}</span> zostaną usunięte na zawsze.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Anuluj</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                             onClick={() => onPermanentDelete(entity.id, isEmployee(entity) ? 'employee' : 'non-employee')}
                        >
                            Potwierdź i usuń
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DropdownMenuContent>
    </DropdownMenu>
  );
};

const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
    isDisabled,
}: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    isDisabled: boolean;
}) => {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center space-x-2 py-4">
            <Button variant="outline" size="icon" onClick={() => onPageChange(1)} disabled={isDisabled || currentPage === 1}>
                <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage - 1)} disabled={isDisabled || currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
                Strona {currentPage} z {totalPages}
            </span>
            <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage + 1)} disabled={isDisabled || currentPage === totalPages}>
                <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => onPageChange(totalPages)} disabled={isDisabled || currentPage === totalPages}>
                <ChevronsRight className="h-4 w-4" />
            </Button>
        </div>
    );
};

const EntityTable = ({ entities, onEdit, onDismiss, onRestore, isDismissed, settings, onPermanentDelete }: { entities: Entity[]; settings: Settings; isDismissed: boolean; onEdit: (e: Entity) => void; onDismiss?: (id: string) => void; onRestore?: (id: string) => void; onPermanentDelete: (id: string, type: 'employee' | 'non-employee') => void; }) => {
  const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || 'N/A';
  
  return (
    <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Koordynator</TableHead>
              <TableHead>Adres</TableHead>
              <TableHead>Pokój</TableHead>
              <TableHead>Data zameldowania</TableHead>
              <TableHead>Data wymeldowania</TableHead>
              <TableHead><span className="sr-only">Akcje</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entities.length > 0 ? (
              entities.map((entity) => (
                <TableRow key={entity.id} onClick={() => onEdit(entity)} className="cursor-pointer">
                  <TableCell className="font-medium">{entity.fullName}</TableCell>
                  <TableCell>{isEmployee(entity) ? "Pracownik" : "Mieszkaniec (NZ)"}</TableCell>
                  <TableCell>{isEmployee(entity) ? getCoordinatorName(entity.coordinatorId) : "N/A"}</TableCell>
                  <TableCell>{entity.address}</TableCell>
                  <TableCell>{entity.roomNumber}</TableCell>
                  <TableCell>{formatDate(entity.checkInDate)}</TableCell>
                  <TableCell>{formatDate(entity.checkOutDate)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <EntityActions {...{ entity, onEdit, onDismiss, onRestore, onPermanentDelete, isDismissed }} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center">Brak danych do wyświetlenia.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
    </div>
  );
};

const EntityCardList = ({ entities, onEdit, onDismiss, onRestore, isDismissed, settings, onPermanentDelete }: { entities: Entity[]; settings: Settings; isDismissed: boolean; onEdit: (e: Entity) => void; onDismiss?: (id: string) => void; onRestore?: (id: string) => void; onPermanentDelete: (id: string, type: 'employee' | 'non-employee') => void; }) => {
    const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || 'N/A';
    
    return (
        <div className="space-y-4">
             {entities.length > 0 ? (
                entities.map((entity) => (
                    <Card key={entity.id} onClick={() => onEdit(entity)} className="cursor-pointer animate-in fade-in-0 duration-300">
                        <CardHeader className="flex flex-row items-start justify-between pb-4">
                           <div>
                             <CardTitle className="text-base">{entity.fullName}</CardTitle>
                             <CardDescription>
                                {isEmployee(entity) ? getCoordinatorName(entity.coordinatorId) : "Mieszkaniec (NZ)"}
                             </CardDescription>
                           </div>
                           <div onClick={(e) => e.stopPropagation()}>
                                <EntityActions {...{ entity, onEdit, onDismiss, onRestore, onPermanentDelete, isDismissed }} />
                           </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <p><span className="font-semibold text-muted-foreground">Adres:</span> {entity.address}, pok. {entity.roomNumber}</p>
                            {isEmployee(entity) && <p><span className="font-semibold text-muted-foreground">Narodowość:</span> {entity.nationality}</p>}
                            <p><span className="font-semibold text-muted-foreground">Zameldowanie:</span> {formatDate(entity.checkInDate)}</p>
                        </CardContent>
                    </Card>
                ))
             ) : (
                <div className="text-center text-muted-foreground py-8">Brak danych do wyświetlenia.</div>
             )}
        </div>
    )
};

const FilterDialog = ({ isOpen, onOpenChange, settings, onApply, initialFilters }: { isOpen: boolean; onOpenChange: (open: boolean) => void; settings: Settings; onApply: (filters: Record<string, string>) => void; initialFilters: Record<string, string>; }) => {
    const [filters, setFilters] = useState(initialFilters);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({...prev, [key]: value}));
    }
    
    const handleReset = () => {
        const resetFilters = {
            coordinator: 'all',
            address: 'all',
            department: 'all',
            nationality: 'all'
        };
        setFilters(resetFilters);
        onApply(resetFilters);
        onOpenChange(false);
    }
    
    const handleApply = () => {
        onApply(filters);
        onOpenChange(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
                <DialogHeader>
                    <DialogTitle>Filtruj</DialogTitle>
                    <DialogDescription>Zawęź listę, aby znaleźć to, czego szukasz.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                  <div className="grid gap-4 p-4">
                      <div className="space-y-2">
                        <Label>Koordynator</Label>
                        <Select value={filters.coordinator} onValueChange={(v) => handleFilterChange('coordinator', v)}>
                        <SelectTrigger><SelectValue placeholder="Filtruj wg koordynatora" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszyscy koordynatorzy</SelectItem>
                            {settings.coordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label>Adres</Label>
                        <Select value={filters.address} onValueChange={(v) => handleFilterChange('address', v)}>
                        <SelectTrigger><SelectValue placeholder="Filtruj wg adresu" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie adresy</SelectItem>
                            {settings.addresses.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label>Zakład</Label>
                        <Select value={filters.department} onValueChange={(v) => handleFilterChange('department', v)}>
                        <SelectTrigger><SelectValue placeholder="Filtruj wg zakładu" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie zakłady</SelectItem>
                            {settings.departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label>Narodowość</Label>
                        <Select value={filters.nationality} onValueChange={(v) => handleFilterChange('nationality', v)}>
                        <SelectTrigger><SelectValue placeholder="Filtruj wg narodowości" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie narodowości</SelectItem>
                            {settings.nationalities.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                  </div>
                </ScrollArea>
                <DialogFooter className="flex-row !justify-between p-6 pt-0">
                     <Button variant="ghost" onClick={handleReset}>Wyczyść wszystko</Button>
                    <Button onClick={handleApply}>Zastosuj</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const ControlPanel = ({
    search,
    onSearch,
    onAdd,
    onFilter,
    onViewChange,
    viewMode,
    isFilterActive,
    onResetFilters,
}: {
    search: string;
    onSearch: (value: string) => void;
    onAdd: (type: 'employee' | 'non-employee') => void;
    onFilter: () => void;
    onViewChange: (mode: 'list' | 'grid') => void;
    viewMode: 'list' | 'grid';
    isFilterActive: boolean;
    onResetFilters: () => void;
}) => {
    const { isMobile } = useIsMobile();
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>Zarządzanie mieszkańcami</CardTitle>
            <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap">
                <Input
                    placeholder="Szukaj po nazwisku..."
                    value={search}
                    onChange={(e) => onSearch(e.target.value)}
                    className="w-full sm:w-auto flex-1"
                />
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={onFilter}>
                        <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                    {isFilterActive && (
                        <Button variant="ghost" size="icon" onClick={onResetFilters} className="text-muted-foreground">
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size={isMobile ? "icon" : "default"}>
                                <PlusCircle className={isMobile ? "h-5 w-5" : "mr-2 h-4 w-4"} />
                                <span className="hidden sm:inline">Dodaj</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => onAdd('employee')}>Dodaj pracownika</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAdd('non-employee')}>Dodaj mieszkańca (NZ)</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {!isMobile && (
                        <>
                            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => onViewChange('list')}>
                                <List className="h-4 w-4"/>
                            </Button>
                            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => onViewChange('grid')}>
                                <LayoutGrid className="h-4 w-4"/>
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function EntityView({ currentUser }: { currentUser: SessionData }) {
    const {
        allEmployees,
        allNonEmployees,
        settings,
        handleDismissEmployee,
        handleRestoreEmployee,
        handleDeleteEmployee,
        handleEditEmployeeClick,
        handleEditNonEmployeeClick,
        handleAddEmployeeClick,
        handleAddNonEmployeeClick,
        handleDeleteNonEmployee
    } = useMainLayout();

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const { isMobile, isMounted } = useIsMobile();
    
    // Params from URL
    const tab = (searchParams.get('tab') as 'active' | 'dismissed' | 'non-employees') || 'active';
    const page = Number(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';
    const viewMode = (searchParams.get('viewMode') as 'list' | 'grid') || (isMobile ? 'grid' : 'list');
    const filters = useMemo(() => ({
        coordinator: (searchParams.get('coordinator')) || 'all',
        address: (searchParams.get('address')) || 'all',
        department: (searchParams.get('department')) || 'all',
        nationality: (searchParams.get('nationality')) || 'all',
    }), [searchParams]);

    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const updateSearchParams = (newParams: Record<string, string | number>) => {
        startTransition(() => {
            const current = new URLSearchParams(Array.from(searchParams.entries()));
            for (const [key, value] of Object.entries(newParams)) {
                if (value) {
                    current.set(key, String(value));
                } else {
                    current.delete(key);
                }
            }
             // Reset page on any filter change
            if (Object.keys(newParams).some(k => k !== 'page')) {
                current.delete('page');
            }
            router.push(`${pathname}?${current.toString()}`);
        });
    };

    const applyFilters = (data: Entity[], localFilters: typeof filters, searchTerm: string) => {
        return data.filter(entity => {
            const searchMatch = searchTerm === '' || entity.fullName.toLowerCase().includes(searchTerm.toLowerCase());
            const addressMatch = localFilters.address === 'all' || entity.address === localFilters.address;
            
            if (isEmployee(entity)) {
                const coordinatorMatch = localFilters.coordinator === 'all' || entity.coordinatorId === localFilters.coordinator;
                const departmentMatch = localFilters.department === 'all' || entity.zaklad === localFilters.department;
                const nationalityMatch = localFilters.nationality === 'all' || entity.nationality === localFilters.nationality;
                return searchMatch && coordinatorMatch && addressMatch && departmentMatch && nationalityMatch;
            }
            
            return searchMatch && addressMatch;
        });
    }

    const filteredEmployees = useMemo(() => {
        if (!allEmployees) return [];
        return applyFilters(allEmployees, filters, search);
    }, [allEmployees, filters, search]);
    
    const filteredNonEmployees = useMemo(() => {
        if (!allNonEmployees) return [];
        return applyFilters(allNonEmployees, filters, search);
    }, [allNonEmployees, filters, search]);

    const activeEmployees = useMemo(() => filteredEmployees.filter(e => e.status === 'active'), [filteredEmployees]);
    const dismissedEmployees = useMemo(() => filteredEmployees.filter(e => e.status === 'dismissed'), [filteredEmployees]);
    
    const dataMap = useMemo(() => ({
        active: activeEmployees,
        dismissed: dismissedEmployees,
        'non-employees': filteredNonEmployees,
    }), [activeEmployees, dismissedEmployees, filteredNonEmployees]);

    const currentData = dataMap[tab];
    const totalPages = Math.ceil((currentData?.length || 0) / ITEMS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return currentData?.slice(start, end) || [];
    }, [currentData, page]);

    const isFilterActive = Object.values(filters).some(v => v !== 'all') || search !== '';

    if (!settings || !allEmployees || !allNonEmployees) {
        return (
            <Card>
                <CardHeader>
                     <Skeleton className="h-8 w-1/3" />
                </CardHeader>
                <CardContent>
                     <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    const handleAction = async (action: 'dismiss' | 'restore', employeeId: string) => {
        if (action === 'dismiss') {
            await handleDismissEmployee(employeeId);
        } else {
            await handleRestoreEmployee(employeeId);
        }
    };

    const handlePermanentDelete = async (id: string, type: 'employee' | 'non-employee') => {
        if (type === 'employee') {
            await handleDeleteEmployee(id);
        } else {
            await handleDeleteNonEmployee(id);
        }
    };

    const handleEdit = (entity: Entity) => {
        if(isEmployee(entity)) {
            handleEditEmployeeClick(entity);
        } else {
            handleEditNonEmployeeClick(entity);
        }
    }

    const EntityListComponent = viewMode === 'grid' ? EntityCardList : EntityTable;

    const renderContent = () => (
        <>
            <ScrollArea className="h-[55vh] overflow-x-auto" style={{ opacity: isPending ? 0.6 : 1 }}>
                {isMounted ? <EntityListComponent 
                    entities={paginatedData}
                    settings={settings}
                    onEdit={handleEdit}
                    onDismiss={(id) => handleAction('dismiss', id)}
                    onRestore={(id) => handleAction('restore', id)}
                    onPermanentDelete={handlePermanentDelete}
                    isDismissed={tab === 'dismissed'}
                /> : <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}
            </ScrollArea>
             <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={(p) => updateSearchParams({ page: p })} isDisabled={isPending} />
        </>
    );

    return (
        <Card>
            <CardHeader>
                <ControlPanel 
                    search={search}
                    onSearch={(val) => updateSearchParams({ search: val, page: 1 })}
                    onAdd={(type) => type === 'employee' ? handleAddEmployeeClick() : handleAddNonEmployeeClick()}
                    onFilter={() => setIsFilterOpen(true)}
                    viewMode={viewMode}
                    onViewChange={(mode) => updateSearchParams({ viewMode: mode })}
                    isFilterActive={isFilterActive}
                    onResetFilters={() => updateSearchParams({ search: '', page: 1, coordinator: '', address: '', department: '', nationality: ''})}
                />
            </CardHeader>
            <CardContent>
                 <Tabs value={tab} onValueChange={(v) => updateSearchParams({ tab: v, page: 1 })}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="active" disabled={isPending}>
                            <Users className="mr-2 h-4 w-4" />Aktywni ({activeEmployees.length})
                        </TabsTrigger>
                        <TabsTrigger value="dismissed" disabled={isPending}>
                            <UserX className="mr-2 h-4 w-4" />Zwolnieni ({dismissedEmployees.length})
                        </TabsTrigger>
                        <TabsTrigger value="non-employees" disabled={isPending}>
                            <UserX className="mr-2 h-4 w-4" />NZ ({filteredNonEmployees.length})
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="active" className="mt-4">{renderContent()}</TabsContent>
                    <TabsContent value="dismissed" className="mt-4">{renderContent()}</TabsContent>
                    <TabsContent value="non-employees" className="mt-4">{renderContent()}</TabsContent>
                </Tabs>
            </CardContent>
            <FilterDialog
                isOpen={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                settings={settings}
                initialFilters={filters}
                onApply={(f) => updateSearchParams({ ...f, page: 1 })}
            />
        </Card>
    )
}
