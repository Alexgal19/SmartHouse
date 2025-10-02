"use client";

import React, { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Employee, Settings } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";

const employeeSchema = z.object({
  fullName: z.string().min(3, "Imię i nazwisko musi mieć co najmniej 3 znaki."),
  coordinatorId: z.string().min(1, "Koordynator jest wymagany."),
  nationality: z.string().min(1, "Narodowość jest wymagana."),
  address: z.string().min(1, "Adres jest wymagany."),
  roomNumber: z.string().min(1, "Numer pokoju jest wymagany."),
  zaklad: z.string().min(1, "Zakład jest wymagany."),
  checkInDate: z.date({ required_error: "Data zameldowania jest wymagana." }),
  contractStartDate: z.date().optional().nullable(),
  contractEndDate: z.date().optional().nullable(),
  checkOutDate: z.date().optional().nullable(),
  departureReportDate: z.date().optional().nullable(),
  comments: z.string().optional(),
});

interface AddEmployeeFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: z.infer<typeof employeeSchema>) => Promise<void>;
  settings: Settings;
  employee?: Employee | null;
}

export function AddEmployeeForm({ isOpen, onOpenChange, onSave, settings, employee }: AddEmployeeFormProps) {
  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      fullName: "",
      coordinatorId: "",
      nationality: "",
      address: "",
      roomNumber: "",
      zaklad: "",
      checkInDate: new Date(),
      contractStartDate: undefined,
      contractEndDate: undefined,
      checkOutDate: undefined,
      departureReportDate: undefined,
      comments: "",
    },
  });

  const [originalAddress, setOriginalAddress] = useState<string | undefined>(undefined);
  
  const currentAddress = useWatch({
    control: form.control,
    name: 'address'
  });
  
  const showOldAddress = employee && originalAddress && currentAddress !== originalAddress;

  React.useEffect(() => {
    if (employee) {
        form.reset({
            fullName: employee.fullName,
            coordinatorId: employee.coordinatorId,
            nationality: employee.nationality,
            address: employee.address,
            roomNumber: employee.roomNumber,
            zaklad: employee.zaklad,
            checkInDate: employee.checkInDate,
            contractStartDate: employee.contractStartDate ?? undefined,
            contractEndDate: employee.contractEndDate ?? undefined,
            checkOutDate: employee.checkOutDate ?? undefined,
            departureReportDate: employee.departureReportDate ?? undefined,
            comments: employee.comments,
        });
        setOriginalAddress(employee.address);
    } else {
        form.reset({
            fullName: "",
            coordinatorId: "",
            nationality: "",
            address: "",
            roomNumber: "",
            zaklad: "",
            checkInDate: new Date(),
            contractStartDate: undefined,
            contractEndDate: undefined,
            checkOutDate: undefined,
            departureReportDate: undefined,
            comments: "",
        });
        setOriginalAddress(undefined);
    }
  }, [employee, form, isOpen]);


  const handleSubmit = async (values: z.infer<typeof employeeSchema>) => {
    await onSave(values as any);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? 'Edytuj pracownika' : 'Dodaj nowego pracownika'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Imię i nazwisko</FormLabel>
                  <FormControl>
                    <Input placeholder="Jan Kowalski" {...field} />
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
                        <FormItem>
                        <FormLabel>Narodowość</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Wybierz narodowość" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {settings.nationalities.map((n) => (
                                <SelectItem key={n} value={n}>
                                {n}
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
                    name="coordinatorId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Koordynator</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Wybierz koordynatora" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {settings.coordinators.map((c) => (
                                <SelectItem key={c.uid} value={c.uid}>
                                {c.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
            </div>
            <div className="space-y-4">
                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Adres</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Wybierz adres" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {settings.addresses.map((a) => (
                                <SelectItem key={a.id} value={a.name}>
                                {a.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 {showOldAddress && (
                  <FormItem>
                    <FormLabel>Stara adresa</FormLabel>
                    <FormControl>
                      <Input value={originalAddress} readOnly disabled className="bg-muted/50"/>
                    </FormControl>
                  </FormItem>
                )}
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="roomNumber"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Numer pokoju</FormLabel>
                        <FormControl>
                            <Input placeholder="1A" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="zaklad"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Zakład</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Wybierz zakład" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {settings.departments.map((d) => (
                                <SelectItem key={d} value={d}>
                                {d}
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
                  name="contractStartDate"
                  render={({ field }) => (
                      <FormItem className="flex flex-col">
                      <FormLabel className="mb-1.5">Umowa od</FormLabel>
                      <DatePicker value={field.value ?? undefined} onChange={field.onChange} />
                      <FormMessage />
                      </FormItem>
                  )}
                />
                <FormField
                    control={form.control}
                    name="contractEndDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel className="mb-1.5">Umowa do</FormLabel>
                        <DatePicker value={field.value ?? undefined} onChange={field.onChange} />
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
                        <FormLabel className="mb-1.5">Data zameldowania</FormLabel>
                        <DatePicker value={field.value} onChange={field.onChange} />
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                  control={form.control}
                  name="checkOutDate"
                  render={({ field }) => (
                      <FormItem className="flex flex-col">
                      <FormLabel className="mb-1.5">Data wymeldowania</FormLabel>
                      <DatePicker value={field.value ?? undefined} onChange={field.onChange} />
                      <FormMessage />
                      </FormItem>
                  )}
                />
            </div>
             <FormField
                control={form.control}
                name="departureReportDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel className="mb-1.5">Data zgłoszenia wyjazdu</FormLabel>
                    <DatePicker value={field.value ?? undefined} onChange={field.onChange} />
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Komentarze</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Dodatkowe informacje..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Anuluj</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
