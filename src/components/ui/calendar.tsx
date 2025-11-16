
"use client"

import * as React from "react"
import { pl } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, useDayPicker, useNavigation } from "react-day-picker"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function CalendarCaption() {
  const { goToMonth, nextMonth, previousMonth } = useNavigation()
  const { fromYear, toYear, fromMonth, toMonth } = useDayPicker()

  const handleYearChange = (value: string) => {
    const newYear = Number(value);
    const oldDate = new Date();
    goToMonth(new Date(newYear, oldDate.getMonth()));
  };

  const handleMonthChange = (value: string) => {
    const newMonth = Number(value);
    const oldDate = new Date();
    goToMonth(new Date(oldDate.getFullYear(), newMonth));
  };
  
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: (toYear || currentYear + 5) - (fromYear || currentYear - 5) + 1 }, (_, i) => (fromYear || currentYear - 5) + i);
  const months = Array.from({length: 12}, (_, i) => i);


  return (
    <div className="flex justify-between items-center px-2 py-1.5">
       <button
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className={cn(buttonVariants({ variant: "outline" }), "h-8 w-8 p-0")}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex gap-2">
        <Select
            value={String(new Date().getMonth())}
            onValueChange={handleMonthChange}
        >
          <SelectTrigger className="w-[120px] h-8 text-sm">
            <SelectValue placeholder="Miesiąc" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
               <SelectItem key={month} value={String(month)}>
                {format(new Date(currentYear, month), "LLLL", { locale: pl })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
         <Select
            value={String(new Date().getFullYear())}
            onValueChange={handleYearChange}
        >
          <SelectTrigger className="w-[80px] h-8 text-sm">
            <SelectValue placeholder="Rok" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <button
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className={cn(buttonVariants({ variant: "outline" }), "h-8 w-8 p-0")}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      locale={pl}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "hidden", // Hide default caption
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CalendarCaption,
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      fromYear={2015}
      toYear={2035}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
