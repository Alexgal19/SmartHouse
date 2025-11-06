

"use client"

import React, { useState, useMemo, useTransition, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Employee, Settings, NonEmployee, SessionData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, SlidersHorizontal, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, X, Users, UserX, LayoutGrid, List, Trash2, FileUp, UploadCloud, Copy } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

const ITEMS_PER_PAGE = 20;

const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
        // Use regex to check for YYYY-MM-DD format and add time to avoid timezone issues
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return format(new Date(dateString + 'T00:00:00'), 'dd-MM-yyyy');
        }
        return format(new Date(dateString), 'dd-MM-yyyy');
    } catch {
        return 'Invalid Date';
    }
}

type Entity = Employee | NonEmployee;

const isEmployee = (entity: Entity): entity is Employee => 'zaklad' in entity;

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
    const { copyToClipboard } = useCopyToClipboard();

    const handleCopy = () => {
        const dataToCopy = [
            entity.fullName,
            entity.address,
            `pok. ${entity.roomNumber}`,
            `zameld. ${formatDate(entity.checkInDate)}`
        ].join(', ');
        copyToClipboard(dataToCopy, 'Skopiowano dane mieszkańca.');
    }

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
            <DropdownMenuItem onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                Kopiuj dane
            </DropdownMenuItem>
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
              <TableHead>Płeć</TableHead>
              <TableHead>Koordynator</TableHead>
              <TableHead>Narodowość</TableHead>
              <TableHead>Adres</TableHead>
              <TableHead>Stary adres</TableHead>
              <TableHead>Data zmiany adresu</TableHead>
              <TableHead>Pokój</TableHead>
              <TableHead>Zakład</TableHead>
              <TableHead>Data zameldowania</TableHead>
              <TableHead>Data wymeldowania</TableHead>
              <TableHead>Umowa od</TableHead>
              <TableHead>Umowa do</TableHead>
              <TableHead>Zgłosz. wyjazdu</TableHead>
              <TableHead>Komentarze</TableHead>
              <TableHead><span className="sr-only">Akcje</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entities.length > 0 ? (
              entities.map((entity) => (
                <TableRow key={entity.id} onClick={() => onEdit(entity)} className="cursor-pointer">
                  <TableCell className="font-medium">{entity.fullName}</TableCell>
                   <TableCell>{entity.gender || "N/A"}</TableCell>
                  <TableCell>{getCoordinatorName(entity.coordinatorId)}</TableCell>
                  <TableCell>{entity.nationality || "N/A"}</TableCell>
                  <TableCell>{entity.address}</TableCell>
                  <TableCell>{isEmployee(entity) ? entity.oldAddress : "N/A"}</TableCell>
                  <TableCell>{isEmployee(entity) ? formatDate(entity.addressChangeDate) : "N/A"}</TableCell>
                  <TableCell>{entity.roomNumber}</TableCell>
                  <TableCell>{isEmployee(entity) ? entity.zaklad : "N/A"}</TableCell>
                  <TableCell>{formatDate(entity.checkInDate)}</TableCell>
                  <TableCell>{formatDate(entity.checkOutDate)}</TableCell>
                  <TableCell>{isEmployee(entity) ? formatDate(entity.contractStartDate) : "N/A"}</TableCell>
                  <TableCell>{isEmployee(entity) ? formatDate(entity.contractEndDate) : "N/A"}</TableCell>
                  <TableCell>{formatDate(entity.departureReportDate)}</TableCell>
                  <TableCell className="max-w-xs truncate">{entity.comments}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <EntityActions {...{ entity, onEdit, onDismiss, onRestore, onPermanentDelete, isDismissed }} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={16} className="text-center">Brak danych do wyświetlenia.</TableCell>
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
                                {getCoordinatorName(entity.coordinatorId)}
                             </CardDescription>
                           </div>
                           <div onClick={(e) => e.stopPropagation()}>
                                <EntityActions {...{ entity, onEdit, onDismiss, onRestore, onPermanentDelete, isDismissed }} />
                           </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <p><span className="font-semibold text-muted-foreground">Adres:</span> {entity.address}, pok. {entity.roomNumber}</p>
                            {isEmployee(entity) && <p><span className="font-semibold text-muted-foreground">Zakład:</span> {entity.zaklad}</p>}
                            <p><span className="font-semibold text-muted-foreground">Narodowość:</span> {entity.nationality}</p>
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
    
    const sortedCoordinators = useMemo(() => [...settings.coordinators].sort((a, b) => a.name.localeCompare(b.name)), [settings.coordinators]);
    const sortedAddresses = useMemo(() => [...settings.addresses].sort((a, b) => a.name.localeCompare(b.name)), [settings.addresses]);
    const sortedDepartments = useMemo(() => [...settings.departments].sort((a, b) => a.localeCompare(b)), [settings.departments]);
    const sortedNationalities = useMemo(() => [...settings.nationalities].sort((a, b) => a.localeCompare(b)), [settings.nationalities]);

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
                            {sortedCoordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label>Adres</Label>
                        <Select value={filters.address} onValueChange={(v) => handleFilterChange('address', v)}>
                        <SelectTrigger><SelectValue placeholder="Filtruj wg adresu" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie adresy</SelectItem>
                            {sortedAddresses.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label>Zakład</Label>
                        <Select value={filters.department} onValueChange={(v) => handleFilterChange('department', v)}>
                        <SelectTrigger><SelectValue placeholder="Filtruj wg zakładu" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie zakłady</SelectItem>
                            {sortedDepartments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label>Narodowość</Label>
                        <Select value={filters.nationality} onValueChange={(v) => handleFilterChange('nationality', v)}>
                        <SelectTrigger><SelectValue placeholder="Filtruj wg narodowości" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie narodowości</SelectItem>
                            {sortedNationalities.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
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

const FileUploader = ({ onFileUpload, isImporting }: { onFileUpload: (file: File) => void; isImporting: boolean }) => {
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onFileUpload(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            onFileUpload(e.target.files[0]);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Importuj pracowników z Excela</DialogTitle>
                <DialogDescription>
                    Przeciągnij i upuść plik .xlsx lub .xls tutaj, aby zaimportować dane pracowników. Upewnij się, że plik ma odpowiednie kolumny.
                </DialogDescription>
            </DialogHeader>
            <form id="form-file-upload" onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()} className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input ref={inputRef} type="file" id="input-file-upload" multiple={false} accept=".xlsx, .xls" className="hidden" onChange={handleChange} />
                <label htmlFor="input-file-upload" className={cn("flex flex-col items-center justify-center w-full h-full", { 'bg-muted/50': dragActive })}>
                    <UploadCloud className="w-10 h-10 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                        <span className="font-semibold">Kliknij, aby wybrać</span> lub przeciągnij i upuść plik
                    </p>
                </label>
                {dragActive && <div className="absolute w-full h-full" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div>}
            </form>
             {isImporting && (
                <div className="w-full flex items-center justify-center p-4">
                    <p className="text-sm text-muted-foreground animate-pulse">Trwa importowanie...</p>
                </div>
            )}
        </DialogContent>
    );
};


const ControlPanel = ({
    search,
    onSearch,
    onAdd,
    onFilter,
    onViewChange,
    viewMode,
    isFilterActive,
    onResetFilters,
    onImport,
    showImport
}: {
    search: string;
    onSearch: (value: string) => void;
    onAdd: (type: 'employee' | 'non-employee') => void;
    onFilter: () => void;
    onViewChange: (mode: 'list' | 'grid') => void;
    viewMode: 'list' | 'grid';
    isFilterActive: boolean;
    onResetFilters: () => void;
    onImport: () => void;
    showImport: boolean;
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
                    {showImport && (
                        <Button variant="outline" onClick={onImport}>
                            <FileUp className="mr-2 h-4 w-4" />
                            Importuj
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

export default function EntityView({ currentUser: _currentUser }: { currentUser: SessionData }) {
    const {
        allEmployees,
        allNonEmployees,
        settings,
        currentUser,
        selectedCoordinatorId,
        handleDismissEmployee,
        handleRestoreEmployee,
        handleDeleteEmployee,
        handleEditEmployeeClick,
        handleEditNonEmployeeClick,
        handleAddEmployeeClick,
        handleAddNonEmployeeClick,
        handleDeleteNonEmployee,
        handleImportEmployees,
    } = useMainLayout();

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const { isMobile, isMounted } = useIsMobile();
    const { toast } = useToast();
    
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
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

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

    // Derived data
    const filteredEmployees = useMemo(() => {
        if (!allEmployees) return [];
        return allEmployees.filter(employee => {
            const searchMatch = search === '' || employee.fullName.toLowerCase().includes(search.toLowerCase());
            const coordinatorMatch = filters.coordinator === 'all' || employee.coordinatorId === filters.coordinator;
            const addressMatch = filters.address === 'all' || employee.address === filters.address;
            const departmentMatch = filters.department === 'all' || employee.zaklad === filters.department;
            const nationalityMatch = filters.nationality === 'all' || employee.nationality === filters.nationality;
            return searchMatch && coordinatorMatch && addressMatch && departmentMatch && nationalityMatch;
        });
    }, [allEmployees, search, filters]);

    const activeEmployees = useMemo(() => filteredEmployees.filter(e => e.status === 'active'), [filteredEmployees]);
    const dismissedEmployees = useMemo(() => filteredEmployees.filter(e => e.status === 'dismissed'), [filteredEmployees]);
    
    const filteredNonEmployees = useMemo(() => {
        if (!allNonEmployees) return [];
        return allNonEmployees.filter(person => {
            const searchMatch = search === '' || person.fullName.toLowerCase().includes(search.toLowerCase());
            const addressMatch = filters.address === 'all' || person.address === filters.address;
            const coordinatorMatch = filters.coordinator === 'all' || !person.coordinatorId || person.coordinatorId === filters.coordinator;
            const nationalityMatch = filters.nationality === 'all' || person.nationality === filters.nationality;
            return searchMatch && addressMatch && coordinatorMatch && nationalityMatch;
        });
    }, [allNonEmployees, search, filters]);

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
    
    const filterDialogSettings = useMemo(() => {
        if (!settings) return null;
        
        let availableAddresses = settings.addresses;
        if (selectedCoordinatorId !== 'all') {
            availableAddresses = settings.addresses.filter(addr => addr.coordinatorIds.includes(selectedCoordinatorId));
        }

        return {
            ...settings,
            addresses: availableAddresses,
        };
    }, [settings, selectedCoordinatorId]);

    if (!settings || !allEmployees || !allNonEmployees || !filterDialogSettings || !currentUser) {
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
    
    const onFileSelect = async (file: File) => {
        setIsImporting(true);
        try {
            await handleImportEmployees(file);
            setIsImportOpen(false);
        } catch (e: unknown) {
             toast({
                variant: "destructive",
                title: "Błąd importu",
                description: e instanceof Error ? e.message : "Wystąpił nieznany błąd.",
            });
        } finally {
            setIsImporting(false);
        }
    };

    const EntityListComponent = viewMode === 'grid' || isMobile ? EntityCardList : EntityTable;

    const renderContent = () => {
        const isEmployeeTab = tab === 'active' || tab === 'dismissed';

        const listProps: Record<string, unknown> = {
            entities: paginatedData,
            settings: settings,
            onEdit: handleEdit,
            onPermanentDelete: handlePermanentDelete,
            isDismissed: tab === 'dismissed',
        };
        
        if (isEmployeeTab) {
            listProps.onDismiss = (id: string) => handleAction('dismiss', id);
            listProps.onRestore = (id: string) => handleAction('restore', id);
        }

        return (
            <>
                <ScrollArea className="h-[calc(100vh-22rem)] sm:h-[55vh] overflow-x-auto" style={{ opacity: isPending ? 0.6 : 1 }}>
                    {isMounted ? <EntityListComponent 
                        entities={paginatedData}
                        settings={settings} 
                        isDismissed={tab === 'dismissed'}
                        onEdit={handleEdit} 
                        onPermanentDelete={handlePermanentDelete} {...listProps} /> : <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}
                </ScrollArea>
                 <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={(p) => updateSearchParams({ page: p })} isDisabled={isPending} />
            </>
        );
    };

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
                    onImport={() => setIsImportOpen(true)}
                    showImport={currentUser.isAdmin}
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
                settings={filterDialogSettings}
                initialFilters={filters}
                onApply={(f) => updateSearchParams({ ...f, page: 1 })}
            />
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <FileUploader onFileUpload={onFileSelect} isImporting={isImporting} />
            </Dialog>
        </Card>
    )
}
