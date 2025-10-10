
"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { NonEmployee, Settings } from "@/types";
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
import { format } from "date-fns";

const dateStringSchema = z.string().nullable().optional();

const nonEmployeeSchema = z.object({
  fullName: z.string().min(3, "Imię i nazwisko musi mieć co najmniej 3 znaki."),
  address: z.string().min(1, "Adres jest wymagany."),
  roomNumber: z.string().min(1, "Numer pokoju jest wymagany."),
  checkInDate: z.string({ required_error: "Data zameldowania jest wymagana." }),
  checkOutDate: dateStringSchema,
  comments: z.string().optional(),
});

interface AddNonEmployeeFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: z.infer<typeof nonEmployeeSchema>) => Promise<void>;
  settings: Settings;
  nonEmployee?: NonEmployee | null;
}

export function AddNonEmployeeForm({ isOpen, onOpenChange, onSave, settings, nonEmployee }: AddNonEmployeeFormProps) {
  const form = useForm<z.infer<typeof nonEmployeeSchema>>({
    resolver: zodResolver(nonEmployeeSchema),
    defaultValues: {
      fullName: "",
      address: "",
      roomNumber: "",
      checkInDate: format(new Date(), 'yyyy-MM-dd'),
      checkOutDate: undefined,
      comments: "",
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      if (nonEmployee) {
        form.reset({
            ...nonEmployee,
        });
      } else {
        form.reset({
            fullName: "",
            address: "",
            roomNumber: "",
            checkInDate: format(new Date(), 'yyyy-MM-dd'),
            checkOutDate: undefined,
            comments: "",
        });
      }
    }
  }, [nonEmployee, isOpen, form]);

  const handleSubmit = async (values: z.infer<typeof nonEmployeeSchema>) => {
    await onSave(values);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{nonEmployee ? 'Edytuj mieszkańca (NZ)' : 'Dodaj nowego mieszkańca (NZ)'}</DialogTitle>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <DatePicker value={field.value} onChange={field.onChange} />
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
