"use client"

import * as React from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface MobileTab {
  value: string
  label: string
  disabled?: boolean
  icon?: React.ReactNode
}

interface MobileTabsProps {
  value: string
  onValueChange: (value: string) => void
  tabs: MobileTab[]
  children: React.ReactNode
  className?: string
  listClassName?: string
}

/**
 * MobileTabs — dual-pattern navigation component.
 * Desktop: horizontal tabs with icons.
 * Mobile: native Select dropdown (never tabs on mobile per project rules).
 */
export function MobileTabs({
  value,
  onValueChange,
  tabs,
  children,
  className,
  listClassName,
}: MobileTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <div className={`hidden sm:block ${listClassName ?? ""}`}>
        <TabsList className="flex flex-wrap h-auto w-full justify-start gap-2 bg-transparent p-0">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              disabled={t.disabled}
              className="flex-1 min-w-[120px] bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4 py-2 hover:bg-muted/80"
            >
              {t.icon && <span className="mr-2 shrink-0">{t.icon}</span>}
              <span className="truncate">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className="block sm:hidden mb-4">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tabs.map((t) => (
              <SelectItem key={t.value} value={t.value} disabled={t.disabled}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {children}
    </Tabs>
  )
}
