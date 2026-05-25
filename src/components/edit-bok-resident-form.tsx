
"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { CalendarIcon, X, Loader2, Camera } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isValid, parseISO } from 'date-fns';
import { useLanguage } from '@/lib/i18n';
import { Combobox } from '@/components/ui/combobox';
import Webcam from 'react-webcam';
import { extractPassportData } from '@/ai/flows/extract-passport-data-flow';
import { useToast } from '@/hooks/use-toast';

export const formSchema = z.object({
  firstName: z.string().min(1, "Imię jest wymagane."),
  lastName: z.string().min(1, "Nazwisko jest wymagane."),
  nationality: z.string().min(1, "Narodowość jest wymagana."),
  locality: z.string().optional(),
  address: z.string().optional(),
  roomNumber: z.string().optional(),
  gender: z.string().min(1, "Płeć jest wymagana."),
  passportNumber: z.string().optional(),
  checkInDate: z.date({ required_error: "Data zameldowania jest wymagana." }),
  checkOutDate: z.date().nullable().optional(),
  comments: z.string().optional(),
});

export type BokResidentFormData = Omit<z.infer<typeof formSchema>, 'checkInDate' | 'checkOutDate'> & {
  checkInDate: string | null;
  checkOutDate?: string | null;
  status?: 'active' | 'dismissed';
};

const parseDate = (dateString: string | null | undefined): Date | undefined => {
  if (!dateString) return undefined;
  const date = parseISO(dateString);
  return isValid(date) ? date : undefined;
};

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
          id={textMode ? id : undefined}
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
            id={!textMode ? id : undefined}
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
          if (value) { onChange(null); } else { setIsPopoverOpen(true); }
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


export function EditBokResidentForm({
  isOpen,
  onOpenChange,
  onSave,
  onDismiss,
  onDelete,
  settings,
  resident,
  currentUser,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: BokResidentFormData) => void;
  onDismiss?: (id: string, checkOutDate: Date) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  settings: Settings;
  resident: BokResident | null;
  currentUser: SessionData;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const webcamRef = React.useRef<Webcam>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const { allEmployees, allNonEmployees, allBokResidents } = useMainLayout();

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
          toast({ title: t('common.success'), description: t('form.passportDataLoaded') });
          setIsCameraOpen(false);
        })
        .catch((error) => {
          console.error('OCR Error:', error);
          let description = t('form.scanErrorDesc');

          if (error instanceof Error && error.message) {
            description = error.message;
          }

          toast({
            variant: 'destructive',
            title: t('form.scanError'),
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      nationality: '',
      locality: 'MIESZKANIA TYMCZASOWE',
      address: '',
      roomNumber: '',
      gender: '',
      passportNumber: '',
      checkInDate: new Date(),
      checkOutDate: null,
      comments: '',
    },
  });

  const selectedLocality = form.watch('locality');
  const selectedAddress = form.watch('address');

  const watchedCheckOutDate = useWatch({ control: form.control, name: 'checkOutDate' });
  const canDismiss = !!(watchedCheckOutDate instanceof Date && isValid(watchedCheckOutDate));
  const [isDismissing, setIsDismissing] = useState(false);

  const availableLocalities = useMemo(() => {
    const locs = Array.from(new Set(settings.addresses.filter(a => a.locality === 'MIESZKANIA TYMCZASOWE').map(a => a.locality).filter(Boolean)));
    return locs.sort((a, b) => a.localeCompare(b));
  }, [settings.addresses]);

  const localityOptions = useMemo(() => availableLocalities.map(l => ({ value: l, label: l })), [availableLocalities]);

  const availableAddresses = useMemo(() => {
    let addresses = settings.addresses.filter(a => a.locality === 'MIESZKANIA TYMCZASOWE');
    if (selectedLocality) {
      addresses = addresses.filter(a => a.locality === selectedLocality);
    }
    return [...addresses].sort((a, b) => a.name.localeCompare(b.name));
  }, [settings.addresses, selectedLocality]);

  const availableRoomsWithCapacity = useMemo(() => {
    const rooms = settings.addresses.find(a => a.name === selectedAddress)?.rooms || [];
    return [...rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(room => {
      let occupied = 0;
      if (allEmployees) {
        occupied += allEmployees.filter(e => e.status === 'active' && e.address === selectedAddress && String(e.roomNumber) === room.name).length;
      }
      if (allNonEmployees) {
        occupied += allNonEmployees.filter(e => e.status === 'active' && e.address === selectedAddress && String(e.roomNumber) === room.name).length;
      }
      if (allBokResidents) {
        occupied += allBokResidents.filter(e => e.status !== 'dismissed' && e.address === selectedAddress && String(e.roomNumber) === room.name).length;
      }
      return {
        ...room,
        occupied,
        available: Math.max(0, room.capacity - occupied)
      };
    });
  }, [settings.addresses, selectedAddress, allEmployees, allNonEmployees, allBokResidents]);

  useEffect(() => {
    if (resident) {
      const residentAddress = settings.addresses.find(a => a.name === resident.address);
      form.reset({
        firstName: resident.firstName || '',
        lastName: resident.lastName || '',
        nationality: resident.nationality || '',
        locality: resident.locality || residentAddress?.locality || '',
        address: resident.address || '',
        roomNumber: resident.roomNumber || '',
        gender: resident.gender || '',
        passportNumber: resident.passportNumber || '',
        checkInDate: parseDate(resident.checkInDate) ?? new Date(),
        checkOutDate: parseDate(resident.checkOutDate) ?? null,
        comments: resident.comments || '',
      });
    } else {
      form.reset({
        firstName: '',
        lastName: '',
        nationality: '',
        locality: 'MIESZKANIA TYMCZASOWE',
        address: '',
        roomNumber: '',
        gender: '',
        passportNumber: '',
        checkInDate: new Date(),
        checkOutDate: null,
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

  const handleDismissClick = async () => {
    if (!resident || isDismissing || !onDismiss) return;

    const checkOutDate = form.getValues('checkOutDate');

    // Validate type and existence
    if (!checkOutDate || !(checkOutDate instanceof Date) || !isValid(checkOutDate)) {
      form.setError('checkOutDate', {
        type: 'manual',
        message: t('form.dismissCheckOutInvalidResident'),
      });
      return;
    }

    setIsDismissing(true);
    try {
      await onDismiss(resident.id, checkOutDate);
      onOpenChange(false);
    } catch (e) {
      console.error('Dismiss BOK resident failed:', e);
      toast({ variant: 'destructive', title: t('common.error'), description: t('toast.bokResidentDismissError') });
    } finally {
      setIsDismissing(false);
    }
  };

  const sortedNationalities = useMemo(() => [...settings.nationalities].sort((a, b) => a.localeCompare(b)), [settings.nationalities]);
  const sortedGenders = useMemo(() => [...settings.genders].sort((a, b) => a.localeCompare(b)), [settings.genders]);

  const nationalityOptions = useMemo(() => sortedNationalities.map(n => ({ value: n, label: n })), [sortedNationalities]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-xl lg:max-w-2xl h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 flex-shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
              <div>
                <DialogTitle>{resident ? t('form.editBokResident') : t('form.addBokResident')}</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {t('form.fillFields')}
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
                  <span className="ml-2 hidden sm:inline">{t('form.takePassportPhoto')}</span>
                  <span className="ml-2 sm:hidden">{t('form.photo')}</span>
                </Button>
              </div>
            </div>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <ScrollArea className="flex-1 px-4 sm:px-6">
                <div className="space-y-4 pb-4 mt-2">

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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

                  <FormField
                    control={form.control}
                    name="passportNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.passportNumber')}</FormLabel>
                        <FormControl><Input placeholder={t('form.passportNumberPlaceholder')} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
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
                              onChange={(val) => {
                                field.onChange(val);
                                form.setValue('address', '');
                                form.setValue('roomNumber', '');
                              }}
                              placeholder={t('form.selectLocality')}
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
                          <Select onValueChange={(val) => {
                            field.onChange(val);
                            form.setValue('roomNumber', '');
                          }} value={field.value || ''} disabled={!selectedLocality}>
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
                    <FormField
                      control={form.control}
                      name="roomNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('form.room')}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedAddress}>
                            <FormControl><SelectTrigger><SelectValue placeholder={!selectedAddress ? t('form.firstSelectAddress') : t('form.selectRoom')} /></SelectTrigger></FormControl>
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
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
                            <DateInput
                              value={field.value ?? undefined}
                              onChange={field.onChange}
                            />
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
              </ScrollArea>
              <div className="p-4 sm:p-6 pt-4 flex-shrink-0 flex flex-row items-center justify-between gap-3 bg-background border-t mt-auto">
                <div className="flex justify-start">
                  {resident && onDismiss && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDismissClick}
                      disabled={!canDismiss || isDismissing}
                      title={!canDismiss ? t('form.dismissCheckOutRequiredResident') : undefined}
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
      <Dialog open={isCameraOpen} onOpenChange={handleCloseCamera}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{t('form.takePassportPhoto')}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {t('form.passportPhotoDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                    {t('form.analyzingAI')}
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    {t('form.takePhotoOCR')}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCloseCamera}
                disabled={isScanning}
                className="w-full sm:w-auto min-h-[44px]"
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
