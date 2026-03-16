import * as React from "react"
import { ArrowDown, ArrowUp, Check, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { TableHead } from "@/components/ui/table"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface FilterableHeaderProps<T extends string> {
    label: string
    field: T
    options?: { label: string; value: string }[]
    currentFilterValues?: string[]
    onFilterChange?: (field: T, values: string[]) => void
    className?: string
    isDateFilter?: boolean
}

const monthNames: Record<string, string> = {
    '01': 'Styczeń', '02': 'Luty', '03': 'Marzec', '04': 'Kwiecień',
    '05': 'Maj', '06': 'Czerwiec', '07': 'Lipiec', '08': 'Sierpień',
    '09': 'Wrzesień', '10': 'Październik', '11': 'Listopad', '12': 'Grudzień'
};

export function FilterableHeader<T extends string>({
    label,
    field,
    options,
    currentFilterValues,
    onFilterChange,
    className,
    isDateFilter,
}: FilterableHeaderProps<T>) {

    const dateGroups = React.useMemo(() => {
        if (!isDateFilter || !options) return null;
        const groups: Record<string, Record<string, {label: string, value: string}[]>> = {};
        
        options.forEach(opt => {
            const parts = opt.value.split('-');
            if (parts.length === 3) {
                const month = parts[1];
                const year = parts[2];
                
                if (!groups[year]) groups[year] = {};
                if (!groups[year][month]) groups[year][month] = [];
                
                groups[year][month].push(opt);
            } else {
                if (!groups['Inne']) groups['Inne'] = {};
                if (!groups['Inne']['Inne']) groups['Inne']['Inne'] = [];
                groups['Inne']['Inne'].push(opt);
            }
        });
        
        const sortedYears = Object.keys(groups).sort((a,b) => b.localeCompare(a));
        return sortedYears.map(year => {
            const months = groups[year];
            const sortedMonths = Object.keys(months).sort((a,b) => b.localeCompare(a));
            return {
                year,
                months: sortedMonths.map(month => ({
                    month,
                    monthName: monthNames[month] || month,
                    dates: months[month].sort((a,b) => {
                        const dayA = parseInt(a.value.split('-')[0] || '0');
                        const dayB = parseInt(b.value.split('-')[0] || '0');
                        return dayB - dayA; // Descending within month
                    })
                }))
            }
        });
    }, [options, isDateFilter]);

    const handleToggleDate = React.useCallback((value: string, checked: boolean) => {
        if (!onFilterChange) return;
        const current = new Set(currentFilterValues || []);
        if (checked) current.add(value);
        else current.delete(value);
        onFilterChange(field, Array.from(current));
    }, [currentFilterValues, onFilterChange, field]);

    const handleToggleMonth = React.useCallback((dates: {value: string}[], checked: boolean) => {
        if (!onFilterChange) return;
        const current = new Set(currentFilterValues || []);
        dates.forEach(d => {
            if (checked) current.add(d.value);
            else current.delete(d.value);
        });
        onFilterChange(field, Array.from(current));
    }, [currentFilterValues, onFilterChange, field]);

    const handleToggleYear = React.useCallback((months: {dates: {value: string}[]}[], checked: boolean) => {
        if (!onFilterChange) return;
        const current = new Set(currentFilterValues || []);
        months.forEach(m => {
            m.dates.forEach(d => {
                if (checked) current.add(d.value);
                else current.delete(d.value);
            });
        });
        onFilterChange(field, Array.from(current));
    }, [currentFilterValues, onFilterChange, field]);

    return (
        <TableHead className={className}>
            <div className="flex items-center justify-center space-x-1">
                <div className="px-2 py-1 shrink-0 truncate font-medium text-foreground">
                    {label}
                </div>
                {options && onFilterChange && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-6 w-6 shrink-0",
                                    currentFilterValues && currentFilterValues.length > 0 && "text-primary bg-primary/10"
                                )}
                            >
                                <Filter className="h-3 w-3" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[260px] p-0 z-[60]" align="start">
                            {isDateFilter && dateGroups ? (
                                <div className="flex flex-col max-h-[400px]">
                                    <div className="p-3 border-b text-sm font-medium">Flitruj daty</div>
                                    <ScrollArea className="flex-1 overflow-y-auto">
                                        <Accordion type="multiple" className="w-full">
                                            {dateGroups.map((group) => {
                                                const allDatesInYear = group.months.flatMap(m => m.dates);
                                                const isYearFullySelected = allDatesInYear.every(d => currentFilterValues?.includes(d.value));
                                                const isYearPartiallySelected = !isYearFullySelected && allDatesInYear.some(d => currentFilterValues?.includes(d.value));

                                                return (
                                                    <AccordionItem value={group.year} key={group.year} className="border-b-0">
                                                        <div className="flex items-center px-4 py-1 hover:bg-accent/50 group/year">
                                                            <Checkbox 
                                                                checked={isYearFullySelected ? true : isYearPartiallySelected ? "indeterminate" : false}
                                                                onCheckedChange={(c) => handleToggleYear(group.months, c as boolean)}
                                                                className="mr-2"
                                                            />
                                                            <AccordionTrigger className="py-2 hover:no-underline flex-1 justify-between font-semibold text-sm">
                                                                {group.year}
                                                            </AccordionTrigger>
                                                        </div>
                                                        <AccordionContent className="pb-0 pl-[1.125rem] border-l ml-6">
                                                            <Accordion type="multiple" className="w-full">
                                                                {group.months.map(month => {
                                                                    const isMonthFullySelected = month.dates.every(d => currentFilterValues?.includes(d.value));
                                                                    const isMonthPartiallySelected = !isMonthFullySelected && month.dates.some(d => currentFilterValues?.includes(d.value));

                                                                    return (
                                                                        <AccordionItem value={month.month} key={month.month} className="border-b-0">
                                                                            <div className="flex items-center pl-2 pr-4 py-1 hover:bg-accent/50 group/month">
                                                                                <Checkbox 
                                                                                    checked={isMonthFullySelected ? true : isMonthPartiallySelected ? "indeterminate" : false}
                                                                                    onCheckedChange={(c) => handleToggleMonth(month.dates, c as boolean)}
                                                                                    className="mr-2"
                                                                                />
                                                                                <AccordionTrigger className="py-1.5 hover:no-underline flex-1 justify-between text-sm">
                                                                                    {month.monthName}
                                                                                </AccordionTrigger>
                                                                            </div>
                                                                            <AccordionContent className="pb-1 pl-4 pt-1">
                                                                                {month.dates.map(date => {
                                                                                    const isSelected = currentFilterValues?.includes(date.value);
                                                                                    return (
                                                                                        <label key={date.value} className="flex items-center px-2 py-1.5 hover:bg-accent/50 rounded-sm cursor-pointer">
                                                                                            <Checkbox 
                                                                                                checked={isSelected}
                                                                                                onCheckedChange={(c) => handleToggleDate(date.value, c as boolean)}
                                                                                                className="mr-2 h-3.5 w-3.5"
                                                                                            />
                                                                                            <span className="text-sm font-normal">{date.label}</span>
                                                                                        </label>
                                                                                    )
                                                                                })}
                                                                            </AccordionContent>
                                                                        </AccordionItem>
                                                                    )
                                                                })}
                                                            </Accordion>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                )
                                            })}
                                        </Accordion>
                                    </ScrollArea>
                                    {currentFilterValues && currentFilterValues.length > 0 && (
                                        <div className="p-2 border-t mt-auto">
                                            <Button variant="ghost" className="w-full text-xs h-8" onClick={() => onFilterChange?.(field, [])}>Wyczyść filtr</Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <Command>
                                    <CommandInput placeholder={`Wyszukaj...`} className="h-9 text-xs" />
                                    <CommandList>
                                        <CommandEmpty>Brak wyników.</CommandEmpty>
                                        <CommandGroup>
                                            {options?.map((option) => {
                                                const isSelected = currentFilterValues?.includes(option.value)
                                                return (
                                                    <CommandItem
                                                        key={option.value}
                                                        onSelect={() => {
                                                            if (!onFilterChange) return
                                                            const newValues = isSelected
                                                                ? (currentFilterValues || []).filter((v) => v !== option.value)
                                                                : [...(currentFilterValues || []), option.value]
                                                            onFilterChange(field, newValues)
                                                        }}
                                                    >
                                                        <div
                                                            className={cn(
                                                                "mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
                                                                isSelected
                                                                    ? "bg-primary text-primary-foreground"
                                                                    : "opacity-50 [&_svg]:invisible"
                                                            )}
                                                        >
                                                            <Check className="h-3 w-3" />
                                                        </div>
                                                        <span className="truncate text-xs">{option.label}</span>
                                                    </CommandItem>
                                                )
                                            })}
                                        </CommandGroup>
                                        {currentFilterValues && currentFilterValues.length > 0 && (
                                            <>
                                                <CommandSeparator />
                                                <CommandGroup>
                                                    <CommandItem
                                                        onSelect={() => onFilterChange?.(field, [])}
                                                        className="justify-center text-center text-xs"
                                                    >
                                                        Wyczyść filtr
                                                    </CommandItem>
                                                </CommandGroup>
                                            </>
                                        )}
                                    </CommandList>
                                </Command>
                            )}
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </TableHead>
    )
}
