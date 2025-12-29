

"use client"
import React, { useState, useMemo, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Employee, Settings, NonEmployee, SessionData, AddressHistory } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, SlidersHorizontal, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, X, Users, UserX, LayoutGrid, List, Trash2, ArrowUp, ArrowDown, History, UserPlus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useMainLayout } from '@/components/main-layout';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 20;

const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return format(new Date(dateString + 'T00:00:00'), 'dd-MM-yyyy');
        }
        return format(new Date(dateString), 'dd-MM-yyyy');
    } catch {
        return 'Invalid Date';
    }
}

type Entity = Employee | NonEmployee;
type SortableField = 'fullName' | 'coordinatorId' | 'address' | 'roomNumber' | 'checkInDate' | 'checkOutDate' | 'employeeName' | 'coordinatorName' | 'department' | 'bokStatus';


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
  onRestore?: (entity: Entity) => void;
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
            {isDismissed 
                ? <DropdownMenuItem onClick={() => onRestore?.(entity)}>Przywróć</DropdownMenuItem>
                : (isEmployee(entity) && <DropdownMenuItem onClick={() => onDismiss?.(entity.id)}>Zwolnij</DropdownMenuItem>)
            }
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

const SortableHeader = ({
  label,
  field,
  currentSortBy,
  currentSortOrder,
  onSort,
}: {
  label: string;
  field: SortableField;
  currentSortBy: SortableField | null;
  currentSortOrder: 'asc' | 'desc';
  onSort: (field: SortableField) => void;
}) => {
  const isSorted = currentSortBy === field;
  return (
    <TableHead>
        <Button variant="ghost" onClick={() => onSort(field)} className="px-2 py-1 h-auto -ml-2">
            {label}
            {isSorted && (currentSortOrder === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />)}
        </Button>
    </TableHead>
  );
};

const EntityTable = ({ entities, onEdit, onDismiss, onRestore, isDismissed, settings, onPermanentDelete, onSort, sortBy, sortOrder, tab }: { entities: Entity[]; settings: Settings; isDismissed: boolean; onEdit: (e: Entity) => void; onDismiss?: (id: string) => void; onRestore?: (entity: Entity) => void; onPermanentDelete: (id: string, type: 'employee' | 'non-employee') => void; onSort: (field: SortableField) => void; sortBy: SortableField | null; sortOrder: 'asc' | 'desc'; tab: string; }) => {
  const getCoordinatorName = (id: string) => {
    if (id === 'BOK') return 'BOK (Planowane)';
    return settings.coordinators.find(c => c.uid === id)?.name || 'N/A';
  }
  
  return (
    <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader label="Imię i nazwisko" field="fullName" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />
              {tab !== 'bok' && <TableHead>Typ</TableHead>}
              <SortableHeader label="Koordynator" field="coordinatorId" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />
              {tab === 'bok' && <SortableHeader label="Status BOK" field="bokStatus" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />}
              <SortableHeader label="Adres" field="address" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />
              <SortableHeader label="Pokój" field="roomNumber" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />
              <SortableHeader label="Data zameldowania" field="checkInDate" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />
              <SortableHeader label="Data wymeldowania" field="checkOutDate" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />
              <TableHead><span className="sr-only">Akcje</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entities.length > 0 ? (
              entities.map((entity) => (
                <TableRow key={entity.id} onClick={() => onEdit(entity)} className="cursor-pointer">
                  <TableCell className="font-medium">{entity.fullName}</TableCell>
                   {tab !== 'bok' && <TableCell>{isEmployee(entity) ? "Pracownik" : "Mieszkaniec (NZ)"}</TableCell>}
                  <TableCell>{getCoordinatorName(entity.coordinatorId)}</TableCell>
                  {tab === 'bok' && <TableCell>{entity.bokStatus || 'N/A'}</TableCell>}
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
                <TableCell colSpan={tab === 'bok' ? 8 : 8} className="text-center">Brak danych do wyświetlenia.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
    </div>
  );
};

const HistoryTable = ({ history, onSort, sortBy, sortOrder, onDelete }: { history: AddressHistory[]; onSort: (field: SortableField) => void; sortBy: SortableField | null; sortOrder: 'asc' | 'desc'; onDelete: (id: string) => void; }) => {
  return (
    <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader label="Imię i nazwisko" field="employeeName" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />
              <SortableHeader label="Koordynator" field="coordinatorName" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />
              <SortableHeader label="Zakład" field="department" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />
              <SortableHeader label="Adres" field="address" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />
              <SortableHeader label="Data zameldowania" field="checkInDate" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />
              <SortableHeader label="Data wymeldowania" field="checkOutDate" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={onSort} />
              <TableHead><span className="sr-only">Akcje</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length > 0 ? (
              history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.employeeName}</TableCell>
                  <TableCell>{entry.coordinatorName || 'N/A'}</TableCell>
                  <TableCell>{entry.department || 'N/A'}</TableCell>
                  <TableCell>{entry.address}</TableCell>
                  <TableCell>{formatDate(entry.checkInDate)}</TableCell>
                  <TableCell>{formatDate(entry.checkOutDate)}</TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Czy na pewno chcesz usunąć ten wpis z historii?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Ta operacja jest nieodwracalna i usunie wpis o pobycie <span className="font-bold">{entry.employeeName}</span> pod adresem <span className="font-bold">{entry.address}</span>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Anuluj</AlertDialogCancel>
                          <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => onDelete(entry.id)}
                          >
                              Potwierdź i usuń
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center">Brak danych do wyświetlenia.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
    </div>
  );
};

const EntityCardList = ({ entities, onEdit, onDismiss, onRestore, isDismissed, settings, onPermanentDelete }: { entities: Entity[]; settings: Settings; isDismissed: boolean; onEdit: (e: Entity) => void; onDismiss?: (id: string) => void; onRestore?: (entity: Entity) => void; onPermanentDelete: (id: string, type: 'employee' | 'non-employee') => void; }) => {
    const getCoordinatorName = (id: string) => {
      if (id === 'BOK') return 'BOK (Planowane)';
      return settings.coordinators.find(c => c.uid === id)?.name || 'N/A';
    }
    
    return (
        <div className="space-y-4">
             {entities.length > 0 ? (
                entities.map((entity, index) => (
                    <Card 
                        key={entity.id} 
                        onClick={() => onEdit(entity)} 
                        className="cursor-pointer animate-fade-in-up"
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                    >
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
                            {entity.coordinatorId === 'BOK' && entity.bokStatus && (
                                <p><span className="font-semibold text-muted-foreground">Status BOK:</span> {entity.bokStatus}</p>
                            )}
                            <p><span className="font-semibold text-muted-foreground">Adres:</span> {entity.address || 'Brak'}, pok. {entity.roomNumber || 'Brak'}</p>
                            <p><span className="font-semibold text-muted-foreground">Narodowość:</span> {entity.nationality || 'Brak'}</p>
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

const HistoryCardList = ({ history, onDelete }: { history: AddressHistory[]; onDelete: (id: string) => void; }) => {
    return (
        <div className="space-y-4">
            {history.length > 0 ? (
                history.map((entry, index) => (
                    <Card 
                        key={entry.id} 
                        className="animate-fade-in-up"
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                    >
                        <CardHeader className="flex flex-row items-start justify-between pb-4">
                           <div>
                             <CardTitle className="text-base">{entry.employeeName}</CardTitle>
                             <CardDescription>
                                {entry.coordinatorName} - {entry.department}
                             </CardDescription>
                           </div>
                           <div onClick={(e) => e.stopPropagation()}>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Czy na pewno chcesz usunąć ten wpis z historii?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Ta operacja jest nieodwracalna i usunie wpis o pobycie <span className="font-bold">{entry.employeeName}</span> pod adresem <span className="font-bold">{entry.address}</span>.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                      <AlertDialogAction
                                          className="bg-destructive hover:bg-destructive/90"
                                          onClick={() => onDelete(entry.id)}
                                      >
                                          Potwierdź i usuń
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                           </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <p><span className="font-semibold text-muted-foreground">Adres:</span> {entry.address}</p>
                            <p><span className="font-semibold text-muted-foreground">Okres:</span> {formatDate(entry.checkInDate)} - {formatDate(entry.checkOutDate)}</p>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="text-center text-muted-foreground py-8">Brak danych do wyświetlenia.</div>
            )}
        </div>
    );
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
    showAddButton,
}: {
    search: string;
    onSearch: (value: string) => void;
    onAdd: () => void;
    onFilter: () => void;
    onViewChange: (mode: 'list' | 'grid') => void;
    viewMode: 'list' | 'grid';
    isFilterActive: boolean;
    onResetFilters: () => void;
    showAddButton: boolean;
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
                    {showAddButton && (
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
                    )}
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
        addressHistory,
        settings,
        handleDismissEmployee,
        handleRestoreEmployee,
        handleRestoreNonEmployee,
        handleDeleteEmployee,
        handleEditEmployeeClick,
        handleEditNonEmployeeClick,
        handleAddEmployeeClick,
        handleAddNonEmployeeClick,
        handleDeleteNonEmployee,
        handleDeleteAddressHistory,
    } = useMainLayout();

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const { isMobile, isMounted } = useIsMobile();
    
    const tab = (searchParams.get('tab') as 'active' | 'bok' | 'dismissed' | 'history') || 'active';
    const page = Number(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';
    const viewMode = (searchParams.get('viewMode') as 'list' | 'grid') || (isMobile ? 'grid' : 'list');
    
    const defaultSortField = useMemo(() => {
        switch (tab) {
            case 'active':
                return 'checkInDate';
            case 'bok':
                return 'bokStatusDate';
            case 'dismissed':
            case 'history':
                return 'checkOutDate';
            default:
                return 'checkInDate';
        }
    }, [tab]);

    const sortBy = (searchParams.get('sortBy') as SortableField) || defaultSortField;
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

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
            if (Object.keys(newParams).some(k => k !== 'page')) {
                current.delete('page');
            }
            router.push(`${pathname}?${current.toString()}`);
        });
    };
    
    const handleSort = (field: SortableField) => {
        const newSortOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
        updateSearchParams({ sortBy: field, sortOrder: newSortOrder });
    }

    const sortedData = useMemo(() => {
        const getCoordinatorName = (id: string) => settings?.coordinators.find(c => c.uid === id)?.name || 'N/A';

        let dataToSort: (Entity | AddressHistory)[] = [];
        switch (tab) {
            case 'active':
                dataToSort = [...(allEmployees?.filter(e => e.status === 'active' && e.coordinatorId !== 'BOK') || []), ...(allNonEmployees?.filter(ne => ne.status === 'active' && ne.coordinatorId !== 'BOK') || [])];
                break;
            case 'bok':
                 dataToSort = [...(allEmployees?.filter(e => e.coordinatorId === 'BOK') || []), ...(allNonEmployees?.filter(ne => ne.coordinatorId === 'BOK') || [])];
                break;
            case 'dismissed':
                dataToSort = [
                    ...(allEmployees?.filter(e => e.status === 'dismissed') || []),
                    ...(allNonEmployees?.filter(ne => ne.status === 'dismissed') || [])
                ];
                break;
            case 'history':
                dataToSort = addressHistory || [];
                break;
        }

        if (!dataToSort) return [];

        const sorted = [...dataToSort].sort((a, b) => {
            let valA: string | number | null | undefined;
            let valB: string | number | null | undefined;

            if (sortBy === 'coordinatorId' && 'coordinatorId' in a && 'coordinatorId' in b) {
                 valA = getCoordinatorName(a.coordinatorId);
                 valB = getCoordinatorName(b.coordinatorId);
            } else if ('employeeName' in a && sortBy === 'employeeName') { // For history tab
                valA = a.employeeName;
                valB = (b as AddressHistory).employeeName;
            } else {
                valA = (a as any)[sortBy];
                valB = (b as any)[sortBy];
            }


            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;
            
            if (sortBy.includes('Date')) {
                 const dateA = valA ? parseISO(valA as string).getTime() : 0;
                 const dateB = valB ? parseISO(valB as string).getTime() : 0;
                 return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            }

            return String(valA).localeCompare(String(valB), 'pl', { numeric: true }) * (sortOrder === 'asc' ? 1 : -1);
        });
        return sorted;

    }, [allEmployees, allNonEmployees, addressHistory, tab, sortBy, sortOrder, settings]);


    const filteredData = useMemo(() => {
        if (!sortedData) return [];
        return sortedData.filter(entity => {
            const searchField = 'employeeName' in entity ? entity.employeeName : entity.fullName;
            const searchMatch = search === '' || (searchField && searchField.toLowerCase().includes(search.toLowerCase()));

            if (tab === 'history') return searchMatch;

            const addressMatch = filters.address === 'all' || ('address' in entity && entity.address === filters.address);
            const nationalityMatch = filters.nationality === 'all' || ('nationality' in entity && entity.nationality === filters.nationality);
            const departmentMatch = !isEmployee(entity) || filters.department === 'all' || ('zaklad' in entity && entity.zaklad === filters.department);
            
            return searchMatch && addressMatch && nationalityMatch && departmentMatch;
        });
    }, [sortedData, search, filters, tab]);

    const activeCount = useMemo(() => (allEmployees?.filter(e => e.status === 'active' && e.coordinatorId !== 'BOK').length || 0) + (allNonEmployees?.filter(ne => ne.status === 'active' && ne.coordinatorId !== 'BOK').length || 0), [allEmployees, allNonEmployees]);
    const bokCount = useMemo(() => (allEmployees?.filter(e => e.coordinatorId === 'BOK').length || 0) + (allNonEmployees?.filter(ne => ne.coordinatorId === 'BOK').length || 0), [allEmployees, allNonEmployees]);
    const dismissedCount = useMemo(() => (allEmployees?.filter(e => e.status === 'dismissed').length || 0) + (allNonEmployees?.filter(ne => ne.status === 'dismissed').length || 0), [allEmployees, allNonEmployees]);


    const totalPages = Math.ceil((filteredData?.length || 0) / ITEMS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return filteredData?.slice(start, end) || [];
    }, [filteredData, page]);

    const isFilterActive = Object.values(filters).some(v => v !== 'all') || search !== '';

    if (!settings || !allEmployees || !allNonEmployees || !addressHistory) {
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
    
    const handleRestore = async (entity: Entity) => {
        if (isEmployee(entity)) {
            await handleRestoreEmployee(entity);
        } else {
            await handleRestoreNonEmployee(entity);
        }
    };

    const handlePermanentDelete = async (id: string, type: 'employee' | 'non-employee') => {
        if (type === 'employee') {
            await handleDeleteEmployee(id, currentUser.uid);
        } else {
            await handleDeleteNonEmployee(id, currentUser.uid);
        }
    };

    const handleEdit = (entity: Entity) => {
        if(isEmployee(entity)) {
            handleEditEmployeeClick(entity);
        } else {
            handleEditNonEmployeeClick(entity as NonEmployee);
        }
    }

    const handleAdd = (type: 'employee' | 'non-employee') => {
        if (type === 'non-employee') {
            handleAddNonEmployeeClick();
        } else {
            handleAddEmployeeClick();
        }
    }

    const renderContent = () => (
        <>
            <ScrollArea className="h-[55vh] overflow-x-auto" style={{ opacity: isPending ? 0.6 : 1 }}>
                {isMounted ? 
                    (viewMode === 'list' ? 
                        <EntityTable 
                            entities={paginatedData as Entity[]}
                            settings={settings}
                            onEdit={handleEdit}
                            onDismiss={(id) => handleDismissEmployee(id, new Date())}
                            onRestore={handleRestore}
                            onPermanentDelete={handlePermanentDelete}
                            isDismissed={tab === 'dismissed'}
                            onSort={handleSort}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            tab={tab}
                        /> :
                        <EntityCardList 
                             entities={paginatedData as Entity[]}
                            settings={settings}
                            onEdit={handleEdit}
                            onDismiss={(id) => handleDismissEmployee(id, new Date())}
                            onRestore={handleRestore}
                            onPermanentDelete={handlePermanentDelete}
                            isDismissed={tab === 'dismissed'}
                        />
                    )
                 : <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}
            </ScrollArea>
             <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={(p) => updateSearchParams({ page: p })} isDisabled={isPending} />
        </>
    );

     const renderHistoryContent = () => (
        <>
            <ScrollArea className="h-[55vh] overflow-x-auto" style={{ opacity: isPending ? 0.6 : 1 }}>
                {isMounted ? (
                    isMobile ? (
                        <HistoryCardList
                            history={paginatedData as AddressHistory[]}
                            onDelete={(id) => handleDeleteAddressHistory(id, currentUser.uid)}
                        />
                    ) : (
                        <HistoryTable
                            history={paginatedData as AddressHistory[]}
                            onSort={handleSort}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onDelete={(id) => handleDeleteAddressHistory(id, currentUser.uid)}
                        />
                    )
                ) : (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                )}
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
                    onAdd={handleAdd}
                    onFilter={() => setIsFilterOpen(true)}
                    viewMode={viewMode}
                    onViewChange={(mode) => updateSearchParams({ viewMode: mode })}
                    isFilterActive={isFilterActive}
                    onResetFilters={() => updateSearchParams({ search: '', page: 1, coordinator: '', address: '', department: '', nationality: ''})}
                    showAddButton={tab !== 'history'}
                />
            </CardHeader>
            <CardContent>
                 <Tabs value={tab} onValueChange={(v) => updateSearchParams({ tab: v, page: 1, sortBy: '', sortOrder: '' })}>
                    <TabsList className={cn("grid w-full", currentUser.isAdmin ? "grid-cols-4" : "grid-cols-3")}>
                        <TabsTrigger value="active" disabled={isPending}>
                            <Users className="mr-2 h-4 w-4" />Aktywni ({activeCount})
                        </TabsTrigger>
                        <TabsTrigger value="bok" disabled={isPending}>
                            <UserPlus className="mr-2 h-4 w-4" />Planowane osoby ({bokCount})
                        </TabsTrigger>
                         <TabsTrigger value="dismissed" disabled={isPending}>
                            <UserX className="mr-2 h-4 w-4" />Zwolnieni ({dismissedCount})
                        </TabsTrigger>
                        {currentUser.isAdmin && (
                            <TabsTrigger value="history" disabled={isPending}>
                                <History className="mr-2 h-4 w-4" />Historia Adresów ({addressHistory.length})
                            </TabsTrigger>
                        )}
                    </TabsList>
                    <TabsContent value="active" className="mt-4">{renderContent()}</TabsContent>
                    <TabsContent value="bok" className="mt-4">{renderContent()}</TabsContent>
                    <TabsContent value="dismissed" className="mt-4">{renderContent()}</TabsContent>
                    {currentUser.isAdmin && <TabsContent value="history" className="mt-4">{renderHistoryContent()}</TabsContent>}
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
