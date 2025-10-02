"use client";

import React from "react";
import { useForm } from "react-hook-form";
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
  phoneNumber: z.string().optional(),
  coordinatorId: z.string().min(1, "Koordynator jest wymagany."),
  nationality: z.string().min(1, "Narodowość jest wymagana."),
  address: z.string().min(1, "Adres jest wymagany."),
  roomNumber: z.string().min(1, "Numer pokoju jest wymagany."),
  zaklad: z.string().min(1, "Zakład jest wymagany."),
  checkInDate: z.date({ required_error: "Data zameldowania jest wymagana." }),
  contractEndDate: z.date().optional().nullable(),
  checkOutDate: z.date().optional().nullable(),
  comments: z.string().optional(),
});

interface AddEmployeeFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: Omit<Employee, 'id' | 'status'>) => Promise<void>;
  settings: Settings;
  employee?: Employee | null;
}

export function AddEmployeeForm({ isOpen, onOpenChange, onSave, settings, employee }: AddEmployeeFormProps) {
  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      fullName: employee?.fullName || "",
      phoneNumber: employee?.phoneNumber || "",
      coordinatorId: employee?.coordinatorId || "",
      nationality: employee?.nationality || "",
      address: employee?.address || "",
      roomNumber: employee?.roomNumber || "",
      zaklad: employee?.zaklad || "",
      checkInDate: employee?.checkInDate || new Date(),
      contractEndDate: employee?.contractEndDate,
      checkOutDate: employee?.checkOutDate,
      comments: employee?.comments || "",
    },
  });

  React.useEffect(() => {
    if (employee) {
        form.reset({
            fullName: employee.fullName,
            phoneNumber: employee.phoneNumber,
            coordinatorId: employee.coordinatorId,
            nationality: employee.nationality,
            address: employee.address,
            roomNumber: employee.roomNumber,
            zaklad: employee.zaklad,
            checkInDate: employee.checkInDate,
            contractEndDate: employee.contractEndDate,
            checkOutDate: employee.checkOutDate,
            comments: employee.comments,
        });
    } else {
        form.reset({
            fullName: "",
            phoneNumber: "",
            coordinatorId: "",
            nationality: "",
            address: "",
            roomNumber: "",
            zaklad: "",
            checkInDate: new Date(),
            contractEndDate: undefined,
            checkOutDate: undefined,
            comments: "",
        });
    }
  }, [employee, form]);


  const handleSubmit = async (values: z.infer<typeof employeeSchema>) => {
    await onSave(values);
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
             <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numer telefonu</FormLabel>
                  <FormControl>
                    <Input placeholder="+48 123 456 789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="coordinatorId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Koordynator</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                 <FormField
                    control={form.control}
                    name="nationality"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Narodowość</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Wybierz narodowość" />
                            </Trigger>
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
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Adres</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Wybierz adres" />
                            </Trigger>
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
            </div>
            <FormField
                control={form.control}
                name="zaklad"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Zakład</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Wybierz zakład" />
                        </Trigger>
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
                    name="contractEndDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel className="mb-1.5">Koniec umowy</FormLabel>
                        <DatePicker value={field.value ?? undefined} onChange={field.onChange} />
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
