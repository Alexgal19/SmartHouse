
"use client";

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Inspection, Settings, SessionData, InspectionCategoryItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Clipboard, Calendar as CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  photos: z.array(z.string()).optional(), // Assuming base64 strings
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

const evaluationOptions = ['Bardzo czysto', 'Czysto', 'Do poprawy', 'Brudno', 'Bardzo brudno'];

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
  const fileInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

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
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, categoryIndex: number) => {
    const files = event.target.files;
    if (files) {
      const currentPhotos = form.getValues(`categories.${categoryIndex}.photos`) || [];
      const newPhotos: string[] = [];
      
      Array.from(files).forEach(file => {
          const reader = new FileReader();
          reader.onload = (e) => {
              if(typeof e.target?.result === 'string') {
                  newPhotos.push(e.target.result);
                  if(newPhotos.length === files.length) {
                       form.setValue(`categories.${categoryIndex}.photos`, [...currentPhotos, ...newPhotos], { shouldDirty: true });
                  }
              }
          };
          reader.readAsDataURL(file);
      })
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl flex flex-col h-screen sm:h-[90vh]">
        <DialogHeader>
          <DialogTitle>{item ? 'Edytuj kontrolę mieszkania' : 'Nowa Kontrola Mieszkania'}</DialogTitle>
          <DialogDescription>
             Wypełnij poniższy formularz, aby {item ? 'zaktualizować' : 'dodać'} kontrolę.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 min-h-0 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-1">
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
                    <FormLabel>Data wypełnienia</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "dd-MM-yyyy") : <span>Wybierz datę</span>}
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
              <FormItem>
                <FormLabel>Koordynator</FormLabel>
                 <Input disabled value={currentUser.name}/>
              </FormItem>
               <FormField
                control={form.control}
                name="standard"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Standard mieszkania</FormLabel>
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

            <ScrollArea className="flex-1 mt-6 -mr-6 pr-6">
              <div className="space-y-6 p-1">
                {form.watch('categories')?.map((category, categoryIndex) => (
                  <Card key={categoryIndex}>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <div className="flex items-center gap-2">
                            <Button type="button" size="icon" variant="outline" onClick={() => { /* Copy logic */ }}>
                                <Clipboard className="h-4 w-4" />
                            </Button>
                             <input
                                type="file"
                                ref={(el) => { fileInputRefs.current[categoryIndex] = el; }}
                                className="hidden"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleFileChange(e, categoryIndex)}
                            />
                            <Button type="button" size="icon" variant="outline" onClick={() => fileInputRefs.current[categoryIndex]?.click()}>
                                <Camera className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {category.items.map((item, itemIndex) => {
                        const fieldName = `categories.${categoryIndex}.items.${itemIndex}.value` as const;
                        return (
                          <FormItem key={`${categoryIndex}-${itemIndex}`} className="flex items-center justify-between p-3 border-b">
                            <FormLabel className="flex-1">{item.label}</FormLabel>
                            <div className="w-48">
                            <FormControl>
                              <Controller
                                control={form.control}
                                name={fieldName}
                                render={({ field }) => {
                                  if (item.type === 'select') {
                                       return (
                                        <Select
                                          onValueChange={field.onChange}
                                          value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                                        >
                                          <FormControl><SelectTrigger><SelectValue placeholder="Wybierz ocenę" /></SelectTrigger></FormControl>
                                          <SelectContent>
                                            {(item.options || evaluationOptions).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                      );
                                  }
                                  // Simplified for brevity, expand for other types
                                  return <Input type="text" {...field as any} />;
                                }}
                              />
                            </FormControl>
                            </div>
                          </FormItem>
                        );
                      })}
                       {/* Display thumbnails */}
                        {form.watch(`categories.${categoryIndex}.photos`) && form.watch(`categories.${categoryIndex}.photos`)!.length > 0 && (
                            <div className="pt-4">
                                <FormLabel>Zdjęcia</FormLabel>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-2">
                                    {form.watch(`categories.${categoryIndex}.photos`)!.map((photo, photoIndex) => (
                                        <div key={photoIndex} className="relative aspect-square">
                                            <img src={photo} alt={`photo ${photoIndex + 1}`} className="w-full h-full object-cover rounded-md" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <FormField
                        control={form.control}
                        name={`categories.${categoryIndex}.uwagi`}
                        render={({ field }) => (
                          <FormItem className="pt-4">
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
            <DialogFooter className="p-6 pt-4 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
              <Button type="submit">Zapisz Inspekcję</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    