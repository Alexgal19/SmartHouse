
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type ComboboxProps = {
    options: { value: string; label: string; }[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    notFoundMessage?: string;
    className?: string;
    id?: string;
}

export function Combobox({
    options,
    value,
    onChange,
    placeholder = "Wybierz opcję...",
    searchPlaceholder = "Szukaj...",
    notFoundMessage = "Nie znaleziono.",
    className,
    id
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = options.find((option) => option.value?.toLowerCase() === value?.toLowerCase())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between min-h-[44px]", className)}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[200px] max-w-[calc(100vw-2rem)] p-0" align="start" sideOffset={5}>
        <Command className="max-h-[40vh] overflow-auto">
          <CommandInput placeholder={searchPlaceholder} className="h-10" />
          <CommandList className="max-h-[30vh]">
            <CommandEmpty>{notFoundMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={(currentLabel) => {
                    const selected = options.find(opt => opt.label.toLowerCase() === currentLabel.toLowerCase());
                    if (selected) {
                        onChange(selected.value.toLowerCase() === value?.toLowerCase() ? "" : selected.value);
                    }
                    setOpen(false)
                  }}
                  className="min-h-[44px] sm:min-h-0"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value?.toLowerCase() === option.value?.toLowerCase() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
