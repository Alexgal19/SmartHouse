
"use client";

import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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

import type { Address, Settings } from '@/types';
import { PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';


const roomSchema = z.object({
    id: z.string().min(1, 'ID pokoju jest wymagane.'),
    name: z.string().min(1, 'Nazwa pokoju jest wymagana.'),
    capacity: z.coerce.number().min(1, 'Pojemność musi być większa od 0.'),
    isActive: z.boolean().default(true),
    isLocked: z.boolean().default(false),
});

const addressSchema = z.object({
    id: z.string(),
    locality: z.string().min(1, "Miejscowość jest wymagana."),
    name: z.string().min(1, 'Nazwa adresu jest wymagana.'),
    isActive: z.boolean().default(true),
    coordinatorIds: z.array(z.object({ value: z.string() })).min(1, 'Przypisz co najmniej jednego koordynatora.'),
    rooms: z.array(roomSchema),
});


export function AddressForm({
    isOpen,
    onOpenChange,
    onSave,
    settings,
    address,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (data: Address) => void;
    settings: Settings,
    address: Address | null;
}) {
    const { t } = useLanguage();
    const form = useForm<z.infer<typeof addressSchema>>({
        resolver: zodResolver(addressSchema),
    });

    const { fields: roomFields, append: appendRoom, remove: removeRoom } = useFieldArray({
        control: form.control,
        name: 'rooms',
    });

    const { fields: coordFields, append: appendCoord, remove: removeCoord } = useFieldArray({
        control: form.control,
        name: "coordinatorIds"
    });

    useEffect(() => {
        if (address) {
            form.reset({
                ...address,
                isActive: address.isActive !== undefined ? address.isActive : true,
                coordinatorIds: (address.coordinatorIds || []).map(id => ({ value: id })),
                rooms: address.rooms || []
            });
        } else {
            form.reset({
                id: `addr-${Date.now()}`,
                locality: '',
                name: '',
                isActive: true,
                coordinatorIds: [],
                rooms: [],
            });
        }
    }, [address, isOpen, form]);

    const onSubmit = async (values: z.infer<typeof addressSchema>) => {
        try {
            await onSave({
                ...values,
                coordinatorIds: values.coordinatorIds.map(c => c.value)
            });
            onOpenChange(false);
        } catch (e) {
            console.error('Form submission failed:', e);
        }
    };

    const availableCoordinators = settings.coordinators.filter(
        c => !(form.watch('coordinatorIds') || []).some(coord => coord.value === c.uid)
    );

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
                <DialogHeader>
                    <DialogTitle>{address?.name ? t('address.editAddress') : t('address.addNewAddress')}</DialogTitle>
                    <DialogDescription>
                        {address?.name ? t('address.editDescription') : t('address.addDescription')}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <ScrollArea className="h-[60vh] -mr-6 pr-6">
                            <div className="space-y-4 p-1">
                                <FormField
                                    control={form.control}
                                    name="locality"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('form.locality')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder={t('form.selectLocality')} /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {settings.localities.filter(Boolean).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('address.streetAndNumber')}</FormLabel>
                                            <FormControl><Input placeholder={t('address.streetExample')} {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />


                                <div className="space-y-2 rounded-md border p-4">
                                    <FormLabel>{t('address.assignedCoordinators')}</FormLabel>
                                    <div className="space-y-2">
                                        {coordFields.map((field, index) => (
                                            <div key={field.id} className="flex items-center gap-2">
                                                <FormField
                                                    control={form.control}
                                                    name={`coordinatorIds.${index}.value`}
                                                    render={({ field }) => (
                                                        <FormItem className="flex-1">
                                                            <Select onValueChange={(val) => field.onChange(val)} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger><SelectValue placeholder={t('form.selectCoordinator')} /></SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {settings.coordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeCoord(index)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 w-full"
                                        onClick={() => appendCoord({ value: '' })}
                                        disabled={availableCoordinators.length === 0}
                                    >
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        {t('address.addCoordinator')}
                                    </Button>
                                    <FormMessage>{form.formState.errors.coordinatorIds?.message}</FormMessage>
                                </div>


                                <div className="space-y-2 rounded-md border p-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-medium">{t('housing.rooms')}</h3>
                                        <Button type="button" variant="outline" size="sm" onClick={() => appendRoom({ id: `room-${Date.now()}`, name: '', capacity: 1, isActive: true, isLocked: false })}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> {t('address.addRoom')}
                                        </Button>
                                    </div>
                                    {roomFields.map((field, index) => (
                                        <div key={field.id} className="flex items-start gap-2">
                                            <FormField
                                                control={form.control}
                                                name={`rooms.${index}.name`}
                                                render={({ field: nameField }) => (
                                                    <FormItem className="flex-1">
                                                        <FormLabel className="sr-only">{t('address.roomName')}</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder={t('address.roomName')}
                                                                {...nameField}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`rooms.${index}.capacity`}
                                                render={({ field: capacityField }) => (
                                                    <FormItem className="w-28">
                                                        <FormLabel className="sr-only">{t('housing.capacity')}</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                placeholder={t('housing.capacity')}
                                                                {...capacityField}
                                                                onChange={(e) => {
                                                                    const val = e.target.value === '' ? '' : Number(e.target.value);
                                                                    capacityField.onChange(val);
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeRoom(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {roomFields.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">{t('address.noRoomsForAddress')}</p>}
                                </div>

                            </div>
                        </ScrollArea>
                        <DialogFooter className="p-6 pt-4 -mb-6 -mx-6">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('common.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
