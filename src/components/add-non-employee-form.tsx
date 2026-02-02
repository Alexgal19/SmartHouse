

"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { NonEmployee, Settings, SessionData } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X, Camera, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parse, isValid, parseISO } from 'date-fns';
import { Combobox } from './ui/combobox';
import { useToast } from '@/hooks/use-toast';
import { extractPassportData } from '@/ai/flows/extract-passport-data-flow';
import Webcam from 'react-webcam';
import { useMainLayout } from './main-layout';

const formSchema = z.object({
  firstName: z.string().min(1, "Imię jest wymagane."),
  lastName: z.string().min(1, "Nazwisko jest wymagane."),
  coordinatorId: z.string().min(1, "Koordynator jest wymagany."),
  locality: z.string().min(1, 'Miejscowość jest wymagana.'),
  address: z.string().min(1, 'Adres jest wymagany.'),
  roomNumber: z.string().min(1, 'Pokój jest wymagany.'),
  nationality: z.string().min(1, "Narodowość jest wymagana."),
  gender: z.string().min(1, "Płeć jest wymagana."),
  checkInDate: z.date({ required_error: "Data zameldowania jest wymagana.", invalid_type_error: "Data zameldowania jest wymagana." }),
  checkOutDate: z.date().nullable().optional(),
  departureReportDate: z.date().nullable().optional(),
  comments: z.string().optional(),
  paymentType: z.string().nullable().optional(),
  paymentAmount: z.number().nullable().optional(),
});

type NonEmployeeFormData = Omit<z.infer<typeof formSchema>, 'checkInDate' | 'checkOutDate' | 'locality' | 'departureReportDate'> & {
  checkInDate: string | null;
  checkOutDate?: string | null;
  departureReportDate?: string | null;
};

const parseDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    const date = parseISO(dateString);
    return isValid(date) ? date : null;
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
    if (value) {
      setInputValue(format(value, 'yyyy-MM-dd'));
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    const parsedDate = parse(e.target.value, 'yyyy-MM-dd', new Date());
    if (!isNaN(parsedDate.getTime())) {
      onChange(parsedDate);
    }
  };

  const handleDateSelect = (date?: Date | null) => {
    if (date) {
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
            className="pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center">
            {value ? (
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer" onClick={handleClear}/>
            ) : (
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value || undefined}
          onSelect={d => handleDateSelect(d)}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

export function AddNonEmployeeForm({
  isOpen,
  onOpenChange,
  onSave,
  settings,
  nonEmployee,
  currentUser,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: NonEmployeeFormData) => void;
  settings: Settings;
  nonEmployee: NonEmployee | null;
  currentUser: SessionData;
}) {
  const { toast } = useToast();
  const { handleDismissNonEmployee } = useMainLayout();
  const webcamRef = useRef<Webcam>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      coordinatorId: '',
      locality: '',
      address: '',
      roomNumber: '',
      nationality: '',
      gender: '',
      checkInDate: undefined,
      checkOutDate: null,
      departureReportDate: null,
      comments: '',
      paymentType: null,
      paymentAmount: null,
    },
  });

  const selectedCoordinatorId = form.watch('coordinatorId');
  const selectedLocality = form.watch('locality');
  const selectedAddress = form.watch('address');

  const coordinatorOptions = useMemo(() => {
     return settings.coordinators
      .map(c => ({ value: c.uid, label: c.name }))
      .sort((a,b) => a.label.localeCompare(b.label));
  },[settings.coordinators]);
  
  const nationalityOptions = useMemo(() => 
    settings.nationalities.map(n => ({ value: n, label: n })).sort((a, b) => a.label.localeCompare(b.label)),
  [settings.nationalities]);
  
  const genderOptions = useMemo(() => 
    settings.genders.sort((a, b) => a.localeCompare(b)),
  [settings.genders]);
  
  const paymentTypesNZOptions = useMemo(() => 
    settings.paymentTypesNZ.map(p => ({ value: p, label: p })).sort((a,b) => a.label.localeCompare(b.label)), 
  [settings.paymentTypesNZ]);

    const availableLocalities = useMemo(() => {
        if (!settings) return [];
        let userAddresses = settings.addresses;
        if (selectedCoordinatorId) {
            userAddresses = settings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId));
        } else if (!currentUser.isAdmin) {
            userAddresses = settings.addresses.filter(a => a.coordinatorIds.includes(currentUser.uid));
        }
        
        const localities = [...new Set(userAddresses.map(a => a.locality))];
        return localities.sort((a,b) => a.localeCompare(b));
    }, [settings, currentUser, selectedCoordinatorId]);

    const availableAddresses = useMemo(() => {
        if (!settings) return [];
        let userAddresses = settings.addresses;
        if (selectedCoordinatorId) {
            userAddresses = settings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId));
        } else if (!currentUser.isAdmin) {
            userAddresses = settings.addresses.filter(a => a.coordinatorIds.includes(currentUser.uid));
        }
        
        if (!selectedLocality) return userAddresses;

        const filtered = userAddresses.filter(a => a.locality === selectedLocality);
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }, [settings, selectedLocality, currentUser, selectedCoordinatorId]);

  const availableRooms = useMemo(() => {
    const rooms = settings.addresses.find(a => a.name === selectedAddress)?.rooms || [];
    return [...rooms].sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [settings.addresses, selectedAddress]);

  useEffect(() => {
    if (nonEmployee) {
        const neAddress = settings.addresses.find(a => a.name === nonEmployee.address);
        const neLocality = neAddress ? neAddress.locality : '';
      form.reset({
        ...nonEmployee,
        locality: neLocality,
        checkInDate: parseDate(nonEmployee.checkInDate) || undefined,
        checkOutDate: parseDate(nonEmployee.checkOutDate),
        departureReportDate: parseDate(nonEmployee.departureReportDate),
        paymentType: nonEmployee.paymentType ?? null,
        paymentAmount: nonEmployee.paymentAmount ?? null,
        comments: nonEmployee.comments ?? '',
      });
    } else {
      form.reset({
        firstName: '',
        lastName: '',
        coordinatorId: currentUser.isAdmin ? '' : currentUser.uid,
        locality: '',
        address: '',
        roomNumber: '',
        nationality: '',
        gender: '',
        checkInDate: new Date(),
        checkOutDate: null,
        departureReportDate: null,
        comments: '',
        paymentType: null,
        paymentAmount: null,
      });
    }
  }, [nonEmployee, isOpen, form, settings.addresses, currentUser]);

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
          toast({
            variant: 'destructive',
            title: 'Błąd skanowania',
            description: 'Nie udało się odczytać danych z dokumentu.'
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

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const formatDate = (date: Date | null | undefined): string | null => {
        if (!date) return null;
        return format(date, 'yyyy-MM-dd');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { locality, ...restOfValues } = values;

    const formData: NonEmployeeFormData = {
      ...restOfValues,
      checkInDate: formatDate(values.checkInDate),
      checkOutDate: formatDate(values.checkOutDate),
      departureReportDate: formatDate(values.departureReportDate),
      paymentAmount: values.paymentAmount ? Number(values.paymentAmount) : null,
    };

    onSave(formData);
    onOpenChange(false);
  };
  
  const handleCoordinatorChange = (value: string) => {
    form.setValue('coordinatorId', value);
    form.setValue('locality', '');
    form.setValue('address', '');
    form.setValue('roomNumber', '');
  }

  const handleLocalityChange = (value: string) => {
    form.setValue('locality', value);
    form.setValue('address', '');
    form.setValue('roomNumber', '');
  }

  const handleAddressChange = (value: string) => {
    form.setValue('address', value);
    form.setValue('roomNumber', '');
  }

  const handleDismissClick = async () => {
    if (!nonEmployee) return;

    const checkOutDate = form.getValues('checkOutDate');
    if (!checkOutDate) {
        form.setError('checkOutDate', {
            type: 'manual',
            message: 'Data wymeldowania jest wymagana, aby zwolnić mieszkańca.',
        });
        return;
    }
    
    const values = form.getValues();
    const formatDateFn = (date: Date | null | undefined): string | null => {
        if (!date) return null;
        return format(date, 'yyyy-MM-dd');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { locality, ...restOfValues } = values;
    const formData: NonEmployeeFormData = {
        ...restOfValues,
        checkInDate: formatDateFn(values.checkInDate),
        checkOutDate: formatDateFn(values.checkOutDate),
        departureReportDate: formatDateFn(values.departureReportDate),
    };
    onSave(formData);
    
    await handleDismissNonEmployee(nonEmployee.id, checkOutDate);
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle>{nonEmployee ? 'Edytuj dane mieszkańca (NZ)' : 'Dodaj nowego mieszkańca (NZ)'}</DialogTitle>
              <DialogDescription>
                Wypełnij poniższe pola, aby {nonEmployee ? 'zaktualizować' : 'dodać'} mieszkańca.
              </DialogDescription>
            </div>
            <Button variant="outline" onClick={handleOpenCamera} disabled={isScanning}>
              {isScanning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              Zrób zdjęcie paszportu
            </Button>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[65vh] p-1 mt-4">
              <div className="space-y-4 px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nazwisko</FormLabel>
                        <FormControl><Input placeholder="Nowak" {...field} /></FormControl>
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
                        <FormControl><Input placeholder="Anna" {...field} /></FormControl>
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
                              value={field.value}
                              onChange={handleCoordinatorChange}
                              placeholder="Wybierz koordynatora"
                              searchPlaceholder="Szukaj koordynatora..."
                          />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              {genderOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                      control={form.control}
                      name="locality"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>Miejscowość</FormLabel>
                          <Select onValueChange={handleLocalityChange} value={field.value || ''}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Wybierz miejscowość" /></SelectTrigger></FormControl>
                              <SelectContent>
                                  {availableLocalities.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                              </SelectContent>
                          </Select>
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
                          <Select onValueChange={handleAddressChange} value={field.value || ''} disabled={!selectedLocality}>
                              <FormControl><SelectTrigger><SelectValue placeholder={!selectedLocality ? "Najpierw wybierz miejscowość" : "Wybierz adres"} /></SelectTrigger></FormControl>
                              <SelectContent>
                                  {availableAddresses.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
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
                              {availableRooms.map(r => (
                                <SelectItem key={r.id} value={r.name} disabled={r.isActive === false}>
                                    {r.name} {r.isActive !== false ? `(Pojemność: ${r.capacity})` : '(Niedostępny)'}
                                </SelectItem>
                              ))}
                          </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                      control={form.control}
                      name="paymentType"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>Rodzaj płatności NZ</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Wybierz rodzaj płatności" /></SelectTrigger></FormControl>
                          <SelectContent>
                              {paymentTypesNZOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                          </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="paymentAmount"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>Kwota</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} value={field.value ?? ''} placeholder="PLN" /></FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                      control={form.control}
                      name="checkInDate"
                      render={({ field }) => (
                          <FormItem className="flex flex-col">
                              <FormLabel>Data zameldowania</FormLabel>
                              <FormControl>
                                  <DateInput
                                      value={field.value}
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
                              <FormLabel>Data wymeldowania</FormLabel>
                              <FormControl>
                                  <DateInput value={field.value} onChange={d => field.onChange(d)} />
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
                              <FormLabel>Data zgłoszenia wyjazdu</FormLabel>
                              <FormControl>
                                  <DateInput value={field.value} onChange={d => field.onChange(d)} />
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
                      <FormLabel>Komentarze</FormLabel>
                      <FormControl><Input placeholder="Dodatkowe informacje..." {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
            </div>
            </ScrollArea>
            <DialogFooter className="p-6 pt-4 flex flex-row justify-between">
                <div>
                  {nonEmployee && nonEmployee.status === 'active' && (
                      <Button type="button" variant="destructive" onClick={handleDismissClick}>
                          Zwolnij
                      </Button>
                  )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Anuluj
                </Button>
                <Button type="submit">Zapisz</Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <Dialog open={isCameraOpen} onOpenChange={handleCloseCamera}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zrób zdjęcie paszportu</DialogTitle>
          <DialogDescription>
            Umieść paszport w kadrze i zrób zdjęcie.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: 'environment' }}
            className="w-full max-w-sm rounded-lg border"
          />
          <div className="flex gap-2">
            <Button onClick={handleCapture} disabled={isScanning}>
              {isScanning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              Zrób zdjęcie
            </Button>
            <Button variant="outline" onClick={handleCloseCamera}>
              Anuluj
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}

    