
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useMainLayout } from '@/components/main-layout';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BokResident, Settings, SessionData } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X, Loader2, Send, Camera } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parse, isValid, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Combobox } from '@/components/ui/combobox';
import Webcam from 'react-webcam';
import { extractPassportData } from '@/ai/flows/extract-passport-data-flow';
import { useToast } from '@/hooks/use-toast';

export const formSchema = z.object({
  role: z.string().min(1, "Rola (Kierowca/Recepcja) jest wymagana."),
  firstName: z.string().min(1, "Imię jest wymagane."),
  lastName: z.string().min(1, "Nazwisko jest wymagane."),
  coordinatorId: z.string().min(1, "Koordynator jest wymagany."),
  nationality: z.string().min(1, "Narodowość jest wymagana."),
  locality: z.string().optional(),
  address: z.string().optional(),
  roomNumber: z.string().optional(),
  zaklad: z.string().optional(),
  gender: z.string().min(1, "Płeć jest wymagana."),
  checkInDate: z.date({ required_error: "Data zameldowania jest wymagana." }),
  checkOutDate: z.date().nullable().optional(),
  returnStatus: z.string().optional(),
  status: z.string().optional(),
  comments: z.string().optional(),
});

export type BokResidentFormData = Omit<z.infer<typeof formSchema>, 'checkInDate' | 'checkOutDate' | 'coordinatorId'> & {
  checkInDate: string | null;
  checkOutDate?: string | null;
  coordinatorId: string;
};

const parseDate = (dateString: string | null | undefined): Date | undefined => {
  if (!dateString) return undefined;
  const date = parseISO(dateString);
  return isValid(date) ? date : undefined;
};

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
  const [inputValue, setInputValue] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, 'yyyy-MM-dd'));
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value === '') {
      onChange(null);
      return;
    }
    const parsedDate = parse(e.target.value, 'yyyy-MM-dd', new Date());
    if (isValid(parsedDate)) {
      onChange(parsedDate);
    }
  };

  const handleDateSelect = (date?: Date | null) => {
    if (date && isValid(date)) {
      onChange(date);
      setInputValue(format(date, 'yyyy-MM-dd'));
      setIsPopoverOpen(false);
    } else {
      onChange(null);
      setInputValue('');
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleDateSelect(null);
  }

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            id={id}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="rrrr-mm-dd"
            className="pr-10 min-h-[44px]"
          />
          <button
            type="button"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded hover:bg-muted touch-manipulation"
            onClick={handleClear}
            aria-label={value ? "Wyczyść datę" : "Wybierz datę"}
          >
            {value ? (
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            ) : (
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 max-w-[calc(100vw-2rem)]" align="center" sideOffset={5}>
        <Calendar
          locale={pl}
          mode="single"
          selected={value && isValid(value) ? value : undefined}
          onSelect={(d) => handleDateSelect(d ?? null)}
          disabled={disabled}
          initialFocus
          className="rounded-md border"
        />
      </PopoverContent>
    </Popover>
  );
};


export function AddBokResidentForm({
  isOpen,
  onOpenChange,
  onSave,
  settings,
  resident,
  currentUser,
  onSendPush,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: BokResidentFormData) => void;
  settings: Settings;
  resident: BokResident | null;
  currentUser: SessionData;
  onSendPush?: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [isSendingPush, setIsSendingPush] = React.useState(false);
  const webcamRef = React.useRef<Webcam>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const { handleDismissBokResident } = useMainLayout();

  // Cleanup webcam stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleOpenCamera = async () => {
    setIsCameraOpen(true);
  };

  const handleCapture = () => {
    const dataUri = webcamRef.current?.getScreenshot();
    if (dataUri) {
      setIsScanning(true);
      extractPassportData({ photoDataUri: dataUri })
        .then(({ firstName, lastName }) => {
          form.setValue('firstName', firstName, { shouldValidate: true });
          form.setValue('lastName', lastName, { shouldValidate: true });
          toast({ title: 'Sukces', description: 'Dane z dokumentu zostały wczytane.' });
          setIsCameraOpen(false);
        })
        .catch((error) => {
          console.error('OCR Error:', error);
          let description = 'Nie udało się odczytać danych z dokumentu. Upewnij się, że ostrość jest prawidłowa i kod na dole znajduje się w kadrze.';

          if (error instanceof Error && error.message) {
            description = error.message;
          }

          toast({
            variant: 'destructive',
            title: 'Błąd skanowania',
            description,
          });
        })
        .finally(() => {
          setIsScanning(false);
        });
    }
  };

  const handleCloseCamera = () => {
    setIsCameraOpen(false);
  };

  const handleSendPush = async () => {
    if (!onSendPush) return;
    setIsSendingPush(true);
    try {
      await onSendPush();
    } finally {
      setIsSendingPush(false);
    }
  };

  const handleDismissClick = async () => {
    const checkOutDate = form.getValues('checkOutDate');
    if (!resident || !checkOutDate) {
      toast({ variant: "destructive", title: "Błąd", description: "Oznacz datę wyjazdu, zanim zwolnisz mieszkańca BOK!" });
      return;
    }

    setIsDismissing(true);
    try {
      await onSave(form.getValues() as any); // trigger save first just in case
      await handleDismissBokResident(resident.id, checkOutDate);
      onOpenChange(false);
    } catch (e) {
      console.error('Dismiss failed:', e);
    } finally {
      setIsDismissing(false);
    }
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: '',
      firstName: '',
      lastName: '',
      coordinatorId: '',
      nationality: '',
      locality: '',
      address: '',
      roomNumber: '',
      zaklad: '',
      gender: '',
      checkInDate: new Date(),
      checkOutDate: null,
      returnStatus: '',
      status: '',
      comments: '',
    },
  });

  const selectedCoordinatorId = form.watch('coordinatorId');
  const selectedLocality = form.watch('locality');
  const selectedAddress = form.watch('address');

  const availableLocalities = useMemo(() => {
    const addresses = !selectedCoordinatorId
      ? settings.addresses
      : settings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId));
    const locs = Array.from(new Set(addresses.map(a => a.locality).filter(Boolean)));
    return locs.sort((a, b) => a.localeCompare(b));
  }, [settings.addresses, selectedCoordinatorId]);

  const localityOptions = useMemo(() => availableLocalities.map(l => ({ value: l, label: l })), [availableLocalities]);

  const availableAddresses = useMemo(() => {
    let addresses = !selectedCoordinatorId
      ? settings.addresses
      : settings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId));
    if (selectedLocality) {
      addresses = addresses.filter(a => a.locality === selectedLocality);
    }
    return [...addresses].sort((a, b) => a.name.localeCompare(b.name));
  }, [settings.addresses, selectedCoordinatorId, selectedLocality]);

  const availableRooms = useMemo(() => {
    const rooms = settings.addresses.find(a => a.name === selectedAddress)?.rooms || [];
    return [...rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [settings.addresses, selectedAddress]);

  const availableDepartments = useMemo(() => {
    // Departments are global usually, but if we want to filter by coordinator's departments:
    if (!selectedCoordinatorId) return settings.departments;
    const coordinator = settings.coordinators.find(c => c.uid === selectedCoordinatorId);
    // If coordinator has specific departments assigned, use them? Or use global list?
    // Existing logic suggests using coordinator's departments if available.
    return coordinator ? [...coordinator.departments].sort((a, b) => a.localeCompare(b)) : settings.departments;
  }, [settings.coordinators, settings.departments, selectedCoordinatorId]);

  useEffect(() => {
    if (resident) {
      const residentAddress = settings.addresses.find(a => a.name === resident.address);
      form.reset({
        role: resident.role || '',
        firstName: resident.firstName || '',
        lastName: resident.lastName || '',
        coordinatorId: resident.coordinatorId || currentUser.uid,
        nationality: resident.nationality || '',
        locality: residentAddress?.locality || '',
        address: resident.address || '',
        roomNumber: resident.roomNumber || '',
        zaklad: resident.zaklad || '',
        gender: resident.gender || '',
        checkInDate: parseDate(resident.checkInDate) ?? new Date(),
        checkOutDate: parseDate(resident.checkOutDate) ?? null,
        returnStatus: resident.returnStatus || '',
        status: resident.status || '',
        comments: resident.comments || '',
      });
    } else {
      form.reset({
        role: '',
        firstName: '',
        lastName: '',
        coordinatorId: currentUser.uid || '',
        nationality: '',
        locality: '',
        address: '',
        roomNumber: '',
        zaklad: '',
        gender: '',
        checkInDate: new Date(),
        checkOutDate: null,
        returnStatus: '',
        status: '',
        comments: '',
      });
    }
  }, [resident, isOpen, form, settings, currentUser]);


  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const formatDate = (date: Date | null | undefined): string | null => {
      if (!date) return null;
      return format(date, 'yyyy-MM-dd');
    }

    const formData: BokResidentFormData = {
      ...values,
      coordinatorId: values.coordinatorId || '',
      checkInDate: formatDate(values.checkInDate),
      checkOutDate: formatDate(values.checkOutDate),
    };

    try {
      await onSave(formData);
      onOpenChange(false);
    } catch (e) {
      console.error('Form submission failed:', e);
    }
  };

  const sortedCoordinators = useMemo(() => {
    return [...settings.coordinators].sort((a, b) => a.name.localeCompare(b.name));
  }, [settings.coordinators]);

  const sortedNationalities = useMemo(() => [...settings.nationalities].sort((a, b) => a.localeCompare(b)), [settings.nationalities]);
  const sortedGenders = useMemo(() => [...settings.genders].sort((a, b) => a.localeCompare(b)), [settings.genders]);
  const sortedBokRoles = useMemo(() => [...(settings.bokRoles || [])].sort((a, b) => a.localeCompare(b)), [settings.bokRoles]);
  const sortedBokReturnOptions = useMemo(() => [...(settings.bokReturnOptions || [])].sort((a, b) => a.localeCompare(b)), [settings.bokReturnOptions]);
  const sortedBokStatuses = useMemo(() => [...(settings.bokStatuses || [])].sort((a, b) => a.localeCompare(b)), [settings.bokStatuses]);

  const coordinatorOptions = useMemo(() => sortedCoordinators.map(c => ({ value: c.uid, label: c.name })), [sortedCoordinators]);
  const nationalityOptions = useMemo(() => sortedNationalities.map(n => ({ value: n, label: n })), [sortedNationalities]);
  const departmentOptions = useMemo(() => availableDepartments.map(d => ({ value: d, label: d })), [availableDepartments]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-xl lg:max-w-2xl h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 flex-shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
              <div>
                <DialogTitle>{resident ? 'Edytuj Mieszkańca BOK' : 'Dodaj Mieszkańca BOK'}</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Wypełnij poniższe pola.
                </DialogDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={handleOpenCamera}
                  disabled={isScanning}
                  type="button"
                  className="w-full sm:w-auto h-8 text-xs sm:text-sm px-3"
                >
                  {isScanning ? (
                    <Loader2 className="h-3 w-3 sm:mr-2 animate-spin" />
                  ) : (
                    <Camera className="h-3 w-3 sm:mr-2" />
                  )}
                  <span className="ml-2 hidden sm:inline">Zrób zdjęcie paszportu</span>
                  <span className="ml-2 sm:hidden">Zdjęcie</span>
                </Button>
              </div>
            </div>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <ScrollArea className="flex-1 px-4 sm:px-6">
                <div className="space-y-4 pb-4 mt-2">

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kierowca-Recepcja</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Wybierz rolę" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {sortedBokRoles.filter(Boolean).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nazwisko</FormLabel>
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
                          <FormLabel>Imię</FormLabel>
                          <FormControl><Input placeholder="Jan" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="coordinatorId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Koordynator</FormLabel>
                        <FormControl>
                          <Combobox
                            options={coordinatorOptions}
                            value={field.value || ''}
                            onChange={(val) => {
                              field.onChange(val);
                              form.setValue('address', '');
                              form.setValue('roomNumber', '');
                            }}
                            placeholder="Wybierz koordynatora"
                            searchPlaceholder="Szukaj koordynatora..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <FormField
                      control={form.control}
                      name="nationality"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Narodowość</FormLabel>
                          <FormControl>
                            <Combobox
                              options={nationalityOptions}
                              value={field.value || ''}
                              onChange={field.onChange}
                              placeholder="Wybierz narodowość"
                              searchPlaceholder="Szukaj narodowości..."
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
                          <FormLabel>Płeć</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Wybierz płeć" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {sortedGenders.filter(Boolean).map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    <FormField
                      control={form.control}
                      name="locality"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Miejscowość</FormLabel>
                          <FormControl>
                            <Combobox
                              options={localityOptions}
                              value={field.value || ''}
                              onChange={(val) => {
                                field.onChange(val);
                                form.setValue('address', '');
                                form.setValue('roomNumber', '');
                              }}
                              placeholder={!selectedCoordinatorId ? "Wybierz koordynatora" : "Wybierz miejscowość"}
                              searchPlaceholder="Szukaj miejscowości..."
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
                          <FormLabel>Adres</FormLabel>
                          <Select onValueChange={(val) => {
                            field.onChange(val);
                            form.setValue('roomNumber', '');
                          }} value={field.value || ''} disabled={!selectedLocality}>
                            <FormControl><SelectTrigger><SelectValue placeholder={!selectedLocality ? "Wybierz miejscowość" : "Wybierz adres"} /></SelectTrigger></FormControl>
                            <SelectContent>
                              {availableAddresses.filter(a => a.name).map(a => (
                                <SelectItem key={a.id} value={a.name} disabled={!a.isActive}>
                                  {a.name} {!a.isActive ? '(Niedostępny)' : ''}
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
                      name="roomNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pokój</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedAddress}>
                            <FormControl><SelectTrigger><SelectValue placeholder={!selectedAddress ? "Najpierw wybierz adres" : "Wybierz pokój"} /></SelectTrigger></FormControl>
                            <SelectContent>
                              {availableRooms.filter(r => r.name).map(r => (
                                <SelectItem key={r.id} value={r.name} disabled={!r.isActive}>
                                  {r.name} {r.isActive ? `(Pojemność: ${r.capacity})` : '(Niedostępny)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="zaklad"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <div className="flex justify-between items-center">
                          <FormLabel>Zakład</FormLabel>
                          {field.value && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 min-h-[44px] min-w-[44px] sm:h-6 sm:w-6 sm:min-h-0 sm:min-w-0 p-0 hover:bg-muted flex items-center justify-center"
                              onClick={() => field.onChange('')}
                              aria-label="Wyczyść pole"
                            >
                              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              <span className="sr-only">Wyczyść</span>
                            </Button>
                          )}
                        </div>
                        <FormControl>
                          <Combobox
                            options={departmentOptions}
                            value={field.value || ''}
                            onChange={field.onChange}
                            placeholder="Wybierz zakład"
                            searchPlaceholder="Szukaj zakładu..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <FormField
                      control={form.control}
                      name="checkInDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Data zameldowania</FormLabel>
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
                          <FormLabel>Data wyjazdu</FormLabel>
                          <FormControl>
                            <DateInput value={field.value ?? undefined} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <FormField
                      control={form.control}
                      name="returnStatus"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between items-center">
                            <FormLabel>Powrót</FormLabel>
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 min-h-[44px] min-w-[44px] sm:h-6 sm:w-6 sm:min-h-0 sm:min-w-0 p-0 hover:bg-muted flex items-center justify-center"
                                onClick={() => field.onChange('')}
                                aria-label="Wyczyść pole"
                              >
                                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                <span className="sr-only">Wyczyść</span>
                              </Button>
                            )}
                          </div>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Wybierz opcję" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {sortedBokReturnOptions.filter(Boolean).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between items-center">
                            <FormLabel>Status</FormLabel>
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 min-h-[44px] min-w-[44px] sm:h-6 sm:w-6 sm:min-h-0 sm:min-w-0 p-0 hover:bg-muted flex items-center justify-center"
                                onClick={() => field.onChange('')}
                                aria-label="Wyczyść pole"
                              >
                                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                <span className="sr-only">Wyczyść</span>
                              </Button>
                            )}
                          </div>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Wybierz status" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {sortedBokStatuses.filter(Boolean).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
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
                        <FormLabel>Komentarze</FormLabel>
                        <FormControl><Input placeholder="Dodatkowe informacje..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>
              </ScrollArea>
              <div className="p-4 sm:p-6 pt-4 flex-shrink-0 flex flex-row items-center justify-between gap-3 bg-background border-t mt-auto">
                <div className="flex justify-start">
                  {resident && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDismissClick}
                      disabled={isDismissing}
                      className="h-8 text-xs sm:text-sm px-3 sm:px-4"
                    >
                      {isDismissing && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      Zwolnij
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
                    Anuluj
                  </Button>
                  {resident && onSendPush && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSendPush}
                      disabled={isSendingPush || form.formState.isSubmitting}
                      className="h-8 text-xs sm:text-sm px-3 sm:px-4"
                    >
                      {isSendingPush
                        ? <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        : <Send className="mr-2 h-3 w-3" />}
                      Wyślij
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting}
                    className="h-8 text-xs sm:text-sm px-3 sm:px-4"
                  >
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Zapisz
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Dialog open={isCameraOpen} onOpenChange={handleCloseCamera}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Zrób zdjęcie paszportu</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Umieść stronę paszportu z danymi w kadrze, tak aby pola "Surname" (Nazwisko) i "Given Names" (Imiona) były dobrze widoczne z bliska. Skanowanie wymaga połączenia z Internetem (Google Cloud).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: 'environment', advanced: [{ focusMode: "continuous" }] as any }}
              className="w-full max-w-full sm:max-w-sm rounded-lg border"
              onUserMediaError={(err) => console.error("Webcam error:", err)}
              onUserMedia={(stream) => {
                streamRef.current = stream;
              }}
              screenshotQuality={0.8}
              mirrored={false}
              disablePictureInPicture={true}
              forceScreenshotSourceSize={false}
              imageSmoothing={true}
            />
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button
                onClick={handleCapture}
                disabled={isScanning}
                className="w-full sm:w-auto min-h-[44px]"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analizowanie AI (Google Cloud)...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Zrób zdjęcie (OCR)
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCloseCamera}
                disabled={isScanning}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Anuluj
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
