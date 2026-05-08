

// DESIGN LOCKED: The layout and styling of this form, especially the footer buttons, is finalized (2026-02-17). Do not modify unless strictly necessary for new functionality.
"use client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Employee, Settings, SessionData } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Info, X, Loader2, Eye, AlertTriangle } from 'lucide-react';
import { AddressPreviewDialog } from '@/components/address-preview-dialog';
import { Calendar } from '@/components/ui/calendar';
import { format, isValid, parseISO } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/lib/i18n';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';
import { useMainLayout } from './main-layout';

export const formSchema = z.object({
  firstName: z.string().min(1, "Imię jest wymagane."),
  lastName: z.string().min(1, "Nazwisko jest wymagane."),
  coordinatorId: z.string().min(1, "Koordynator jest wymagany."),
  locality: z.string().min(1, "Miejscowość jest wymagana."),
  address: z.string().min(1, "Adres jest wymagany."),
  ownAddress: z.string().optional(),
  roomNumber: z.string(),
  zaklad: z.string().min(1, "Zakład jest wymagany."),
  nationality: z.string().min(1, "Narodowość jest wymagana."),
  gender: z.string().min(1, "Płeć jest wymagana."),
  checkInDate: z.date({ required_error: "Data zameldowania jest wymagana.", invalid_type_error: "Data zameldowania jest wymagana." }),
  checkOutDate: z.date().nullable().optional(),
  contractStartDate: z.date().nullable().optional(),
  contractEndDate: z.date().nullable().optional(),
  departureReportDate: z.date().nullable().optional(),
  comments: z.string().optional(),
  depositReturned: z.enum(['Tak', 'Nie', 'Nie dotyczy']).nullable().optional(),
  depositReturnAmount: z.number().nullable().optional(),
  deductionRegulation: z.number().nullable().optional(),
  deductionNo4Months: z.number().nullable().optional(),
  deductionNo30Days: z.number().nullable().optional(),
  deductionReason: z.array(z.object({
    id: z.string(),
    label: z.string(),
    amount: z.number().nullable(),
    checked: z.boolean(),
  })).optional(),
  deductionEntryDate: z.date().nullable().optional(),
}).superRefine((data, ctx) => {
  const hasDeductions =
    data.depositReturned === 'Nie' ||
    (data.depositReturnAmount ?? 0) > 0 ||
    (data.deductionRegulation ?? 0) > 0 ||
    (data.deductionNo4Months ?? 0) > 0 ||
    (data.deductionNo30Days ?? 0) > 0 ||
    (data.deductionReason || []).some(r => r.checked && (r.amount ?? 0) > 0);

  if (hasDeductions && !data.deductionEntryDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['deductionEntryDate'],
      message: 'Data jest wymagana, jeśli wprowadzono potrącenia lub kaucja nie jest zwracana.',
    });
  }

  if (data.address?.toLowerCase().includes('własne mieszkanie') && !data.ownAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ownAddress'],
      message: 'Adres własny jest wymagany, jeśli wybrano tę opcję.',
    });
  }

  if (!data.address?.toLowerCase().includes('własne mieszkanie') && !data.roomNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['roomNumber'],
      message: 'Pokój jest wymagany.',
    });
  }
});


export type EmployeeFormData = Omit<z.infer<typeof formSchema>, 'checkInDate' | 'checkOutDate' | 'contractStartDate' | 'contractEndDate' | 'departureReportDate' | 'deductionEntryDate' | 'locality'> & {
  checkInDate: string | null;
  checkOutDate?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  departureReportDate?: string | null;
  deductionEntryDate?: string | null;
};

const defaultDeductionReasons: { label: string }[] = [
  { label: 'Zgubienie kluczy' },
  { label: 'Zniszczenie mienia' },
  { label: 'Palenie w pokoju' },
  { label: 'Niestosowanie się do regulaminu' },
];

const parseDate = (dateString: string | null | undefined): Date | undefined => {
  if (!dateString) return undefined;
  const date = parseISO(dateString); // Expect YYYY-MM-DD
  return isValid(date) ? date : undefined;
};

const formatDate = (date: Date | null | undefined): string | null => {
  if (!date) return null;
  return format(date, 'yyyy-MM-dd');
}

function parseDateText(text: string): Date | null {
  const t = text.trim();
  const sep = t.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (sep) {
    const d = parseInt(sep[1], 10), m = parseInt(sep[2], 10) - 1, y = parseInt(sep[3], 10);
    const date = new Date(y, m, d);
    if (isValid(date) && date.getDate() === d && date.getMonth() === m && date.getFullYear() === y) return date;
  }
  const compact = t.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) {
    const d = parseInt(compact[1], 10), m = parseInt(compact[2], 10) - 1, y = parseInt(compact[3], 10);
    const date = new Date(y, m, d);
    if (isValid(date) && date.getDate() === d && date.getMonth() === m && date.getFullYear() === y) return date;
  }
  return null;
}

const DateInput = ({
  value,
  onChange,
  disabled,
  id,
}: {
  value?: Date | null;
  onChange: (date?: Date | null) => void;
  disabled?: (date: Date) => boolean;
  id?: string;
}) => {
  const { t, dateLocale } = useLanguage();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [textValue, setTextValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastPointerDownRef = useRef(0);

  const enterTextMode = () => {
    setIsPopoverOpen(false);
    setTextValue(value && isValid(value) ? format(value, 'dd.MM.yyyy') : '');
    setTextMode(true);
  };

  const commitText = () => {
    const parsed = parseDateText(textValue);
    if (parsed) onChange(parsed);
    setTextMode(false);
  };

  useEffect(() => {
    if (textMode) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [textMode]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const now = Date.now();
    if (now - lastPointerDownRef.current < 300) {
      e.preventDefault();
      lastPointerDownRef.current = 0;
      enterTextMode();
    } else {
      lastPointerDownRef.current = now;
    }
  };

  if (textMode) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitText(); }
            if (e.key === 'Escape') setTextMode(false);
          }}
          placeholder="dd.mm.rrrr"
          className="w-full min-h-[44px] rounded-md border border-primary bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            onPointerDown={handlePointerDown}
            className="flex w-full min-h-[44px] items-center rounded-md border border-input bg-background px-3 pr-10 text-sm text-left hover:bg-muted/30"
          >
            <span className={value && isValid(value) ? '' : 'text-muted-foreground'}>
              {value && isValid(value) ? format(value, 'yyyy-MM-dd') : 'rrrr-mm-dd'}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 max-w-[calc(100vw-2rem)]" align="center" sideOffset={5}>
          <Calendar
            locale={dateLocale}
            mode="single"
            selected={value && isValid(value) ? value : undefined}
            onSelect={(d) => { onChange(d ?? null); setIsPopoverOpen(false); }}
            disabled={disabled}
            initialFocus
            className="rounded-md border"
          />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded hover:bg-muted touch-manipulation"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (value) {
            onChange(null);
          } else {
            setIsPopoverOpen(true);
          }
        }}
        aria-label={value ? t('form.clearField') : t('form.selectDate')}
      >
        {value ? (
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        ) : (
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </div>
  );
};


export function EditEmployeeForm({
  isOpen,
  onOpenChange,
  onSave,
  settings,
  employee,
  currentUser,
  initialData
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: EmployeeFormData) => void;
  settings: Settings;
  employee: Employee | null;
  initialData?: Partial<EmployeeFormData>;
  currentUser: SessionData;
}) {
  const { t, dateLocale } = useLanguage();
  const { toast } = useToast();
  const { handleDismissEmployee, allEmployees, allNonEmployees, allBokResidents } = useMainLayout();
  const [isDismissing, setIsDismissing] = useState(false);
  const [isAddressPreviewOpen, setIsAddressPreviewOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema, {
    }),
    defaultValues: {
      firstName: '',
      lastName: '',
      coordinatorId: '',
      locality: '',
      address: '',
      ownAddress: '',
      roomNumber: '',
      zaklad: '',
      nationality: '',
      gender: '',
      checkInDate: new Date(),
      checkOutDate: null,
      contractStartDate: null,
      contractEndDate: null,
      departureReportDate: null,
      comments: '',
      depositReturned: null,
      depositReturnAmount: null,
      deductionRegulation: null,
      deductionNo4Months: null,
      deductionNo30Days: null,
      deductionReason: defaultDeductionReasons.map((reason, index) => ({
        ...reason,
        id: `reason-${index}`,
        amount: null,
        checked: false
      })),
      deductionEntryDate: null,
    },
  });

  const selectedCoordinatorId = form.watch('coordinatorId');
  const selectedLocality = form.watch('locality');
  const selectedAddress = form.watch('address');
  const watchedFirstName = form.watch('firstName');
  const watchedLastName = form.watch('lastName');
  const watchedCheckOutDate = useWatch({ control: form.control, name: 'checkOutDate' });
  const canDismiss = !!(watchedCheckOutDate instanceof Date && isValid(watchedCheckOutDate));

  const duplicateEmployee = useMemo(() => {
    if (employee) return null; // tryb edycji — nie sprawdzaj
    if (!watchedFirstName?.trim() || !watchedLastName?.trim()) return null;
    if (!allEmployees) return null;
    const coordId = selectedCoordinatorId || (currentUser.isAdmin ? '' : currentUser.uid);
    const first = watchedFirstName.trim().toLowerCase();
    const last = watchedLastName.trim().toLowerCase();
    return allEmployees.find(
      (e) =>
        e.status === 'active' &&
        e.coordinatorId === coordId &&
        e.firstName?.trim().toLowerCase() === first &&
        e.lastName?.trim().toLowerCase() === last,
    ) ?? null;
  }, [employee, watchedFirstName, watchedLastName, allEmployees, selectedCoordinatorId, currentUser]);
  const isOwnAddressSelected = selectedAddress?.toLowerCase().includes('własne mieszkanie');

  const availableLocalities = useMemo(() => {
    if (!settings.addresses) return [];
    if (!selectedCoordinatorId) return [];

    const coordinatorAddresses = settings.addresses.filter(addr =>
      addr.coordinatorIds.includes(selectedCoordinatorId)
    );
    const localities = coordinatorAddresses.map(addr => addr.locality).filter((value, index, self) => self.indexOf(value) === index);
    return localities.sort((a, b) => a.localeCompare(b));
  }, [settings.addresses, selectedCoordinatorId]);

  const localityOptions = useMemo(() => {
    return availableLocalities.map(l => ({ value: l, label: l }));
  }, [availableLocalities]);

  const availableAddresses = useMemo(() => {
    if (!selectedLocality) return [];
    if (!selectedCoordinatorId) return [];
    const filtered = settings.addresses.filter(a =>
      a.locality === selectedLocality && a.coordinatorIds.includes(selectedCoordinatorId)
    );
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [settings.addresses, selectedLocality, selectedCoordinatorId]);

  const availableRoomsWithCapacity = useMemo(() => {
    const rooms = settings.addresses.find(a => a.name === selectedAddress)?.rooms || [];
    return [...rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(room => {
      let occupied = 0;
      
      if (allEmployees) {
        occupied += allEmployees.filter(e => e.status === 'active' && e.address === selectedAddress && e.roomNumber === room.name).length;
      }
      if (allNonEmployees) {
        occupied += allNonEmployees.filter(e => e.status === 'active' && e.address === selectedAddress && e.roomNumber === room.name).length;
      }
      if (allBokResidents) {
        occupied += allBokResidents.filter(e => (e.status === 'active' || !e.status || e.status === '') && e.address === selectedAddress && e.roomNumber === room.name).length;
      }

      return {
        ...room,
        occupied,
        available: Math.max(0, room.capacity - occupied)
      };
    });
  }, [settings.addresses, selectedAddress, allEmployees, allNonEmployees, allBokResidents]);

  const availableDepartments = useMemo(() => {
    if (!selectedCoordinatorId) return [];
    const coordinator = settings.coordinators.find(c => c.uid === selectedCoordinatorId);
    return coordinator ? [...coordinator.departments].sort((a, b) => a.localeCompare(b)) : [];
  }, [settings.coordinators, selectedCoordinatorId]);

  useEffect(() => {
    if (employee) {
      const currentDeductions = employee.deductionReason || [];
      const combinedDeductions = defaultDeductionReasons.map((defaultReason, index) => {
        const existing = currentDeductions.find(r => r.label === defaultReason.label);
        return {
          id: `reason-${index}`,
          label: defaultReason.label,
          amount: existing?.amount ?? null,
          checked: existing?.checked ?? false,
        }
      });

      const employeeAddress = settings.addresses.find(a => a.name === employee.address);
      const employeeLocality = employeeAddress ? employeeAddress.locality : '';

      form.reset({
        firstName: employee.firstName ?? '',
        lastName: employee.lastName ?? '',
        coordinatorId: employee.coordinatorId ?? '',
        locality: employeeLocality,
        address: employee.address ?? '',
        ownAddress: employee.ownAddress ?? '',
        roomNumber: employee.roomNumber ?? '',
        zaklad: employee.zaklad ?? '',
        nationality: employee.nationality ?? '',
        gender: employee.gender ?? '',
        checkInDate: parseDate(employee.checkInDate) ?? new Date(),
        checkOutDate: parseDate(employee.checkOutDate) ?? null,
        contractStartDate: parseDate(employee.contractStartDate) ?? null,
        contractEndDate: parseDate(employee.contractEndDate) ?? null,
        departureReportDate: parseDate(employee.departureReportDate) ?? null,
        comments: employee.comments ?? '',
        depositReturned: employee.depositReturned ?? null,
        depositReturnAmount: employee.depositReturnAmount ?? null,
        deductionRegulation: employee.deductionRegulation ?? null,
        deductionNo4Months: employee.deductionNo4Months ?? null,
        deductionNo30Days: employee.deductionNo30Days ?? null,
        deductionReason: combinedDeductions,
        deductionEntryDate: parseDate(employee.deductionEntryDate) ?? null,
      });
    } else {
      form.reset({
        firstName: initialData?.firstName ?? '',
        lastName: initialData?.lastName ?? '',
        coordinatorId: currentUser.isAdmin ? (initialData?.coordinatorId ?? '') : currentUser.uid,
        locality: '',
        address: '',
        ownAddress: '',
        roomNumber: '',
        zaklad: initialData?.zaklad ?? '',
        nationality: initialData?.nationality ?? '',
        gender: '',
        checkInDate: new Date(),
        checkOutDate: null,
        contractStartDate: null,
        contractEndDate: null,
        departureReportDate: null,
        comments: '',
        depositReturned: null,
        depositReturnAmount: null,
        deductionRegulation: null,
        deductionNo4Months: null,
        deductionNo30Days: null,
        deductionReason: defaultDeductionReasons.map((reason, index) => ({
          ...reason,
          id: `reason-${index}`,
          amount: null,
          checked: false
        })),
        deductionEntryDate: null,
      });
    }
  }, [employee, isOpen, form, settings, currentUser, initialData]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {

    if (employee) {
      const addressChanged = values.address !== employee.address;
      const checkInDateChanged = values.checkInDate?.getTime() !== parseDate(employee.checkInDate)?.getTime();

      if (addressChanged && !checkInDateChanged) {
        toast({
          variant: 'destructive',
          title: t('common.warning') || 'Uwaga',
          description: t('form.changeCheckInToRegisterAddressChange') || 'Zmień datę zameldowania, aby poprawnie zarejestrować zmianę adresu.',
        });
        return; // Stop submission
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { locality: _, ...restOfValues } = values;

    const formData: EmployeeFormData = {
      ...restOfValues,
      checkInDate: formatDate(values.checkInDate),
      checkOutDate: formatDate(values.checkOutDate),
      contractStartDate: formatDate(values.contractStartDate),
      contractEndDate: formatDate(values.contractEndDate),
      departureReportDate: formatDate(values.departureReportDate),
      deductionEntryDate: formatDate(values.deductionEntryDate),
    };

    try {
      await onSave(formData);
      onOpenChange(false);
    } catch (e) {
      console.error('Form submission failed:', e);
    }
  };

  const handleCoordinatorChange = (value: string) => {
    form.setValue('coordinatorId', value);
    form.setValue('locality', '');
    form.setValue('address', '');
    form.setValue('ownAddress', '');
    form.setValue('roomNumber', '');
    form.setValue('zaklad', '');
  }

  const handleLocalityChange = (value: string) => {
    form.setValue('locality', value);
    form.setValue('address', '');
    form.setValue('ownAddress', '');
    form.setValue('roomNumber', '');
  }

  const handleAddressChange = (value: string) => {
    form.setValue('address', value);
    if (value.toLowerCase().includes('własne mieszkanie')) {
      form.setValue('roomNumber', '1');
    } else {
      form.setValue('ownAddress', '');
      form.setValue('roomNumber', '');
    }
  };

  const handleDismissClick = async () => {
    if (!employee || isDismissing) return;

    const checkOutDate = form.getValues('checkOutDate');

    // Validate type and existence
    if (!checkOutDate || !(checkOutDate instanceof Date) || !isValid(checkOutDate)) {
      form.setError('checkOutDate', {
        type: 'manual',
        message: t('form.dismissCheckOutInvalid'),
      });
      return;
    }



    // update the checkout date first
    const values = form.getValues();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { locality: _, ...restOfValues } = values;
    const formData: EmployeeFormData = {
      ...restOfValues,
      checkInDate: formatDate(values.checkInDate),
      checkOutDate: formatDate(values.checkOutDate),
      contractStartDate: formatDate(values.contractStartDate),
      contractEndDate: formatDate(values.contractEndDate),
      departureReportDate: formatDate(values.departureReportDate),
      deductionEntryDate: formatDate(values.deductionEntryDate),
    };

    setIsDismissing(true);
    try {
      await onSave(formData);
      await handleDismissEmployee(employee.id, checkOutDate);
      onOpenChange(false);
    } catch (e) {
      console.error('Dismiss failed:', e);
    } finally {
      setIsDismissing(false);
    }
  };

  const sortedCoordinators = useMemo(() => {
    return [...settings.coordinators].sort((a, b) => a.name.localeCompare(b.name));
  }, [settings.coordinators]);

  const sortedNationalities = useMemo(() => [...settings.nationalities].sort((a, b) => a.localeCompare(b)), [settings.nationalities]);
  const sortedGenders = useMemo(() => [...settings.genders].sort((a, b) => a.localeCompare(b)), [settings.genders]);

  const coordinatorOptions = useMemo(() => sortedCoordinators.map(c => ({ value: c.uid, label: c.name })), [sortedCoordinators]);
  const nationalityOptions = useMemo(() => sortedNationalities.map(n => ({ value: n, label: n })), [sortedNationalities]);
  const departmentOptions = useMemo(() => availableDepartments.map(d => ({ value: d, label: d })), [availableDepartments]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-4xl h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 flex-shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
              <div>
                <DialogTitle>{employee ? t('form.editEmployee') : t('form.addEmployee')}</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {employee ? t('form.fillFieldsToUpdateEmployee') : t('form.fillFieldsToAddEmployee')}
                </DialogDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => setIsAddressPreviewOpen(true)}
                  type="button"
                  className="w-full sm:w-auto h-8 text-xs sm:text-sm px-3"
                >
                  <Eye className="h-3 w-3 sm:mr-2" />
                  <span className="ml-2">{t('form.addressPreview')}</span>
                </Button>
              </div>
            </div>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <Tabs defaultValue="basic" className="w-full flex-1 flex flex-col overflow-hidden">
                <div className="px-4 sm:px-6 flex-shrink-0">
                  <TabsList className="grid w-full grid-cols-2 h-auto">
                    <TabsTrigger value="basic" className="text-xs sm:text-sm px-2 py-3">{t('form.basicData')}</TabsTrigger>
                    <TabsTrigger value="finance" className="text-xs sm:text-sm px-2 py-3">{t('form.financesAndDeductions')}</TabsTrigger>
                  </TabsList>
                </div>
                <ScrollArea className="flex-1 mt-4">
                  <TabsContent value="basic" className="mt-0 h-full">
                    <div className="space-y-4 px-4 sm:px-6 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('form.lastName2')}</FormLabel>
                              <FormControl><Input placeholder="Kowalski" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('form.firstName2')}</FormLabel>
                              <FormControl><Input placeholder="Jan" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {duplicateEmployee && (
                        <div className="flex items-start gap-3 rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                          <span>
                            {t('form.duplicateEmployeeWarning', { name: `${duplicateEmployee.firstName} ${duplicateEmployee.lastName}` })}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                        <FormField
                          control={form.control}
                          name="coordinatorId"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>{t('form.coordinator')}</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={coordinatorOptions}
                                  value={field.value}
                                  onChange={handleCoordinatorChange}
                                  placeholder={t('form.selectCoordinator')}
                                  searchPlaceholder={t('form.searchCoordinator')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="nationality"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>{t('form.nationality')}</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={nationalityOptions}
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  placeholder={t('form.selectNationality')}
                                  searchPlaceholder={t('form.searchNationality')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="gender"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('form.gender')}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl><SelectTrigger><SelectValue placeholder={t('form.selectGender')} /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {sortedGenders.filter(Boolean).map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        <FormField
                          control={form.control}
                          name="locality"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>{t('form.locality')}</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={localityOptions}
                                  value={field.value || ''}
                                  onChange={handleLocalityChange}
                                  placeholder={!selectedCoordinatorId ? t('form.firstSelectCoord') : t('form.selectLocality')}
                                  searchPlaceholder={t('form.searchLocality')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('form.address')}</FormLabel>
                              <Select onValueChange={handleAddressChange} value={field.value || ''} disabled={!selectedLocality}>
                                <FormControl><SelectTrigger><SelectValue placeholder={!selectedLocality ? t('form.firstSelectLocality') : t('form.selectAddress')} /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {availableAddresses.filter(a => a.name).map(a => (
                                    <SelectItem key={a.id} value={a.name} disabled={!a.isActive}>
                                      {a.name} {!a.isActive ? `(${t('common.unavailable')})` : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {isOwnAddressSelected && (
                          <FormField
                            control={form.control}
                            name="ownAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('form.ownAddress')}</FormLabel>
                                <FormControl><Input placeholder="np. ul. Testowa 1, 00-000 Warszawa" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        <FormField
                          control={form.control}
                          name="roomNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('form.room')}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedAddress || isOwnAddressSelected}>
                                <FormControl><SelectTrigger><SelectValue placeholder={!selectedAddress ? t('form.firstSelectAddress') : (isOwnAddressSelected ? "1" : t('form.selectRoom'))} /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {availableRoomsWithCapacity.filter(r => r.name).map(r => (
                                    <SelectItem key={r.id} value={r.name} disabled={!r.isActive || r.isLocked}>
                                      {r.name} {r.isActive ? (r.isLocked ? `(${t('housing.locked')})` : `(${t('housing.roomCapacity', { available: r.available, capacity: r.capacity })})`) : `(${t('common.unavailable')})`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="zaklad"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>{t('form.department')}</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={departmentOptions}
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  placeholder={!selectedCoordinatorId ? t('form.firstSelectCoord') : t('form.selectDept')}
                                  searchPlaceholder={t('form.searchDepartment')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                        <FormField
                          control={form.control}
                          name="checkInDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>{t('form.checkInDate')}</FormLabel>
                              <FormControl>
                                <DateInput
                                  value={field.value ?? undefined}
                                  onChange={field.onChange}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="checkOutDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>{t('form.checkOutDate')}</FormLabel>
                              <FormControl>
                                <DateInput value={field.value ?? undefined} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="departureReportDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>{t('form.departureDate')}</FormLabel>
                              <FormControl>
                                <DateInput value={field.value ?? undefined} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <FormField
                          control={form.control}
                          name="contractStartDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>{t('form.contractFrom')}</FormLabel>
                              <FormControl>
                                <DateInput value={field.value ?? undefined} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="contractEndDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>{t('form.contractTo')}</FormLabel>
                              <FormControl>
                                <DateInput value={field.value ?? undefined} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="comments"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('form.comments')}</FormLabel>
                            <FormControl><Input placeholder={t('form.additionalInfo')} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="finance" className="mt-0 h-full">
                    <div className="space-y-4 px-4 sm:px-6 pb-4">
                      <h3 className="text-lg font-medium">{t('form.financesAndDeductions')}</h3>
                      <FormField
                        control={form.control}
                        name="deductionEntryDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>{t('form.deductionEntryDate')}</FormLabel>
                            <FormControl>
                              <DateInput
                                value={field.value ?? undefined}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        <FormField
                          control={form.control}
                          name="depositReturned"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('form.depositReturned')}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl><SelectTrigger><SelectValue placeholder={t('form.depositReturnStatus')} /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="Tak">Tak</SelectItem>
                                  <SelectItem value="Nie">Nie</SelectItem>
                                  <SelectItem value="Nie dotyczy">Nie dotyczy</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="depositReturnAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('form.depositReturnAmount')}</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} value={field.value ?? ''} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                        <FormField
                          control={form.control}
                          name="deductionRegulation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center">
                                {t('form.deductionRegulation')}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild><Info className="h-3 w-3 ml-1 cursor-help" /></TooltipTrigger>
                                    <TooltipContent><p>{t('form.deductionRegulationTooltip')}</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} value={field.value ?? ''} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="deductionNo4Months"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center">
                                {t('form.deductionNo4Months')}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild><Info className="h-3 w-3 ml-1 cursor-help" /></TooltipTrigger>
                                    <TooltipContent><p>{t('form.deductionNo4MonthsTooltip')}</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} value={field.value ?? ''} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="deductionNo30Days"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center">
                                {t('form.deductionNo30Days')}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild><Info className="h-3 w-3 ml-1 cursor-help" /></TooltipTrigger>
                                    <TooltipContent><p>{t('form.deductionNo30DaysTooltip')}</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} value={field.value ?? ''} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="deductionReason"
                        render={() => (
                          <FormItem>
                            <div className="mb-4">
                              <FormLabel className="text-base">{t('form.otherDeductions')}</FormLabel>
                              <p className="text-sm text-muted-foreground">
                                {t('form.selectDeductionReasons')}
                              </p>
                            </div>
                            {(form.getValues('deductionReason') || []).map((reason, index) => (
                              <FormField
                                key={reason.id}
                                control={form.control}
                                name={`deductionReason.${index}.checked`}
                                render={({ field }) => (
                                  <FormItem
                                    key={reason.id}
                                    className="flex flex-row items-start space-x-3 space-y-0 mb-3"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        id={reason.id}
                                        checked={field.value}
                                        onCheckedChange={(checked) => {
                                          field.onChange(checked)
                                          if (!checked) {
                                            form.setValue(`deductionReason.${index}.amount`, null)
                                          }
                                        }}
                                        className="mt-1"
                                      />
                                    </FormControl>
                                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 sm:gap-x-4 w-full">
                                      <Label htmlFor={reason.id} className="font-normal text-sm">
                                        {reason.label}
                                      </Label>
                                      <FormField
                                        control={form.control}
                                        name={`deductionReason.${index}.amount`}
                                        render={({ field: amountField }) => (
                                          <Input
                                            type="number"
                                            placeholder="PLN"
                                            className="h-10 sm:h-9 min-h-[44px] sm:min-h-0"
                                            inputMode="decimal"
                                            {...amountField}
                                            onChange={e => {
                                              const value = e.target.value;
                                              const numericValue = value === '' ? null : parseFloat(value);
                                              amountField.onChange(numericValue);
                                              if (numericValue !== null && numericValue > 0) {
                                                form.setValue(`deductionReason.${index}.checked`, true);
                                              }
                                            }}
                                            value={amountField.value ?? ''}
                                          />
                                        )}
                                      />
                                    </div>
                                  </FormItem>
                                )}
                              />
                            ))}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>

              <div className="p-4 sm:p-6 pt-4 flex-shrink-0 flex flex-row items-center justify-between gap-3 bg-background border-t mt-auto">
                <div className="flex justify-start">
                  {employee && employee.status === 'active' && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDismissClick}
                      disabled={!canDismiss || isDismissing}
                      title={!canDismiss ? t('form.dismissCheckOutRequired') : undefined}
                      className="h-8 text-xs sm:text-sm px-3 sm:px-4"
                    >
                      {isDismissing && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      {t('form.dismiss')}
                    </Button>
                  )}
                </div>
                <div className="flex flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="h-8 text-xs sm:text-sm px-3 sm:px-4"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting}
                    className="h-8 text-xs sm:text-sm px-3 sm:px-4"
                  >
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    {t('common.save')}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AddressPreviewDialog
        isOpen={isAddressPreviewOpen}
        onOpenChange={setIsAddressPreviewOpen}
        settings={settings}
        allEmployees={allEmployees}
        allNonEmployees={allNonEmployees}
        coordinatorId={selectedCoordinatorId}
        onApplySelection={(locality, address, roomNumber) => {
          form.setValue('locality', locality);
          form.setValue('address', address);
          form.setValue('roomNumber', roomNumber);
          toast({
            title: t('form.addressPreviewApplied'),
            description: t('form.addressPreviewAppliedDesc', { address, roomNumber })
          });
        }}
      />
    </>
  );
}
