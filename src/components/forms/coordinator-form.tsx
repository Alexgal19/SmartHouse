"use client";

import React, { useEffect, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
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
import { Eye, EyeOff, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import type { Coordinator } from '@/types';

const coordinatorSchema = z.object({
    uid: z.string(),
    name: z.string().min(1, 'Imię jest wymagane.'),
    password: z.string().optional(),
    isAdmin: z.boolean().default(false),
    isDriver: z.boolean().default(false),
    isRekrutacja: z.boolean().default(false),
    isBok: z.boolean().default(false),
    canEditPastControlCards: z.boolean().default(false),
    departments: z.array(z.string()).default([]),
    visibilityMode: z.enum(['department', 'strict']).default('department'),
});

export function CoordinatorForm({
    isOpen,
    onOpenChange,
    onSave,
    departments,
    coordinator,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (data: Coordinator) => void;
    departments: string[];
    coordinator?: Coordinator | null;
}) {
    const { t } = useLanguage();
    const [showPassword, setShowPassword] = useState(false);
    
    const form = useForm<z.infer<typeof coordinatorSchema>>({
        resolver: zodResolver(coordinatorSchema),
        defaultValues: {
            uid: `coord-${Date.now()}`,
            name: '',
            password: '',
            isAdmin: false,
            isDriver: coordinator?.isDriver ?? false,
            isRekrutacja: coordinator?.isRekrutacja ?? false,
            isBok: coordinator?.isBok ?? false,
            canEditPastControlCards: coordinator?.canEditPastControlCards ?? false,
            departments: coordinator?.departments ?? [],
            visibilityMode: 'department',
        }
    });

    useEffect(() => {
        if (coordinator && isOpen) {
            form.reset({
                ...coordinator,
                password: coordinator.password || '',
            });
        } else if (isOpen && !coordinator) {
            form.reset({
                uid: `coord-${Date.now()}`,
                name: '',
                password: '',
                isAdmin: false,
                isDriver: false,
                isRekrutacja: false,
                isBok: false,
                canEditPastControlCards: false,
                departments: [],
                visibilityMode: 'department',
            });
            setShowPassword(false);
        }
    }, [coordinator, isOpen, form]);

    const onSubmit = async (values: z.infer<typeof coordinatorSchema>) => {
        try {
            await onSave(values as Coordinator);
            onOpenChange(false);
        } catch (e) {
            console.error('Form submission failed:', e);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
                <DialogHeader>
                    <DialogTitle>{coordinator ? t('settings.editCoordinator') || 'Edytuj koordynatora' : t('settings.addCoordinator')}</DialogTitle>
                    <DialogDescription>
                        {coordinator ? 'Zaktualizuj dane koordynatora' : 'Wypełnij poniższe dane, aby dodać nowego koordynatora.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <ScrollArea className="h-[60vh] -mr-6 pr-6">
                            <div className="space-y-4 p-1">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('settings.coordinatorLoginName')}</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('settings.coordinatorPasswordLabel')}</FormLabel>
                                            <div className="relative">
                                                <FormControl>
                                                    <Input
                                                        type={showPassword ? 'text' : 'password'}
                                                        {...field}
                                                        placeholder={t('settings.passwordEyeHint')}
                                                    />
                                                </FormControl>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="visibilityMode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('settings.visibilityModeLabel')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || 'department'}>
                                                <FormControl><SelectTrigger><SelectValue placeholder={t('settings.selectMode')} /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="department">{t('settings.visibilityGlobal')}</SelectItem>
                                                    <SelectItem value="strict">{t('settings.visibilityStrict')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-2 rounded-md border p-4">
                                    <FormLabel>{t('settings.coordinatorDepts')}</FormLabel>
                                    <div className="space-y-2">
                                        {(form.watch('departments') || []).map((_dept, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <FormField
                                                    control={form.control}
                                                    name={`departments.${index}`}
                                                    render={({ field }) => (
                                                        <FormItem className="flex-1">
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={t('settings.selectDept')} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {departments.filter(Boolean).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        const currentDepts = form.getValues('departments') || [];
                                                        form.setValue('departments', currentDepts.filter((_, i) => i !== index), { shouldDirty: true });
                                                    }}
                                                >
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
                                        onClick={() => {
                                            const currentDepts = form.getValues('departments') || [];
                                            form.setValue('departments', [...currentDepts, ''], { shouldDirty: true });
                                        }}
                                    >
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        {t('settings.addDept')}
                                    </Button>
                                </div>

                                <div className="space-y-4 rounded-md border p-4">
                                    <FormLabel>Uprawnienia</FormLabel>
                                    <FormField
                                        control={form.control}
                                        name="isAdmin"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel>{t('settings.adminPerms')}</FormLabel>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="isDriver"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel>{t('settings.driverPerms')}</FormLabel>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="isRekrutacja"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel>{t('settings.rekrutacjaPerms')}</FormLabel>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="isBok"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel>Uprawnienia BOK</FormLabel>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="canEditPastControlCards"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel>Edycja minionych kart kontroli</FormLabel>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
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
