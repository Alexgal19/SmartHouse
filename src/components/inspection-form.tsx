"use client";

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Inspection, Settings, SessionData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const inspectionItemSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).nullable(),
  type: z.enum(['text', 'number', 'select', 'yes_no', 'rating', 'checkbox_group']),
  options: z.array(z.string()).optional(),
});

const inspectionCategorySchema = z.object({
  name: z.string(),
  items: z.array(inspectionItemSchema),
  uwagi: z.string().optional(),
  photos: z.array(z.string()).optional(),
});

const formSchema = z.object({
  addressId: z.string().min(1, "Adres jest wymagany."),
  date: z.date({ required_error: "Data inspekcji jest wymagana." }),
  standard: z.enum(['Wysoki', 'Normalny', 'Niski']).nullable(),
  categories: z.array(inspectionCategorySchema),
});

export type InspectionFormProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  currentUser: SessionData;
  onSave: (data: Omit<Inspection, 'id'>) => void;
  item?: Inspection | null;
};

function formatValue(value: unknown, type: string): string | number | boolean | string[] | null {
  if (value === null || value === undefined) {
    switch (type) {
      case 'text':
      case 'select':
        return '';
      case 'number':
        return 0;
      case 'yes_no':
        return false;
      case 'checkbox_group':
        return [];
      default:
        return '';
    }
  }
  return value as string | number | boolean | string[];
}

export default function InspectionForm({ isOpen, onOpenChange, settings, currentUser, onSave, item }: InspectionFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: item ? {
      addressId: item.addressId,
      date: new Date(item.date),
      standard: item.standard,
      categories: item.categories.map(cat => ({
        name: cat.name,
        items: cat.items.map(i => ({
          label: i.label,
          type: i.type,
          value: formatValue(i.value, i.type),
          options: i.options,
        })),
        uwagi: cat.uwagi || '',
        photos: cat.photos || [],
      }))
    } : {
      addressId: '',
      date: new Date(),
      standard: null,
      categories: settings.inspectionTemplate ? settings.inspectionTemplate.map(cat => ({
        name: cat.name,
        items: cat.items.map(i => ({
          ...i,
          value: formatValue(null, i.type),
        })),
        uwagi: '',
        photos: [],
      })) : [],
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const address = settings.addresses.find(a => a.id === values.addressId);
    if (!address) return;

    const inspectionData: Omit<Inspection, 'id'> = {
      ...values,
      date: format(values.date, 'yyyy-MM-dd'),
      addressName: address.name,
      coordinatorId: currentUser.uid,
      coordinatorName: currentUser.name,
      categories: values.categories.map(cat => ({
        name: cat.name,
        items: cat.items.map(item => ({
          label: item.label,
          type: item.type,
          value: item.value === null ? '' : item.value,
          options: item.options,
        })),
        uwagi: cat.uwagi || undefined,
        photos: cat.photos,
      })),
    };
    onSave(inspectionData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl flex flex-col h-screen sm:h-[90vh]">
        <DialogHeader>
          <DialogTitle>{item ? 'Edytuj inspekcję' : 'Nowa inspekcja'}</DialogTitle>
          <DialogDescription>Wypełnij formularz {item ? 'żeby zaktualizować' : 'aby dodać nową'} inspekcję.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 min-h-0 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-1">
              <FormField
                control={form.control}
                name="addressId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adres</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Wybierz adres" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {settings.addresses.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data inspekcji</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Wybierz datę</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="standard"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Standard</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Wybierz standard" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Wysoki">Wysoki</SelectItem>
                        <SelectItem value="Normalny">Normalny</SelectItem>
                        <SelectItem value="Niski">Niski</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <ScrollArea className="flex-1 mt-4 -mr-6 pr-6">
              <div className="space-y-6 p-1">
                {form.watch('categories')?.map((category, categoryIndex) => (
                  <Card key={categoryIndex}>
                    <CardHeader><CardTitle className="text-lg">{category.name}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      {category.items.map((item, itemIndex) => {
                        const fieldName = `categories.${categoryIndex}.items.${itemIndex}.value` as const;
                        return (
                          <FormItem key={`${categoryIndex}-${itemIndex}`}>
                            <FormLabel>{item.label}</FormLabel>
                            <FormControl>
                              <Controller
                                control={form.control}
                                name={fieldName}
                                render={({ field }) => {
                                  switch (item.type) {
                                    case 'yes_no':
                                      return (
                                        <RadioGroup
                                          onValueChange={(val) => field.onChange(val === 'true')}
                                          value={field.value !== undefined && field.value !== null ? String(field.value) : 'false'}
                                          className="flex gap-4"
                                        >
                                          <FormItem className="flex items-center space-x-2">
                                            <FormControl><RadioGroupItem value="true" /></FormControl>
                                            <FormLabel className="font-normal">Tak</FormLabel>
                                          </FormItem>
                                          <FormItem className="flex items-center space-x-2">
                                            <FormControl><RadioGroupItem value="false" /></FormControl>
                                            <FormLabel className="font-normal">Nie</FormLabel>
                                          </FormItem>
                                        </RadioGroup>
                                      );
                                    case 'select':
                                      return (
                                        <Select
                                          onValueChange={field.onChange}
                                          value={field.value !== undefined && field.value !== null ? String(field.value) : undefined}
                                        >
                                          <FormControl><SelectTrigger><SelectValue placeholder="..." /></SelectTrigger></FormControl>
                                          <SelectContent>
                                            {item.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                      );
                                    case 'checkbox_group':
                                      const values = Array.isArray(field.value) ? field.value : [];
                                      return (
                                        <div className="space-y-2">
                                          {item.options?.map(opt => (
                                            <FormItem key={opt} className="flex flex-row items-start space-x-3 space-y-0">
                                              <FormControl>
                                                <Checkbox
                                                  checked={values.includes(opt)}
                                                  onCheckedChange={(checked) => {
                                                    const newValues = checked
                                                      ? [...values, opt]
                                                      : values.filter(v => v !== opt);
                                                    field.onChange(newValues);
                                                  }}
                                                />
                                              </FormControl>
                                              <FormLabel className="font-normal">{opt}</FormLabel>
                                            </FormItem>
                                          ))}
                                        </div>
                                      );
                                    case 'number':
                                      return (
                                        <Input
                                          type="number"
                                          value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                                          onChange={e => field.onChange(Number(e.target.value))}
                                        />
                                      );
                                    default:
                                      return (
                                        <Input
                                          type="text"
                                          value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                                          onChange={e => field.onChange(e.target.value)}
                                        />
                                      );
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      })}
                      <FormField
                        control={form.control}
                        name={`categories.${categoryIndex}.uwagi`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Uwagi</FormLabel>
                            <FormControl><Textarea {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="p-6 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
              <Button type="submit">Zapisz inspekcję</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}