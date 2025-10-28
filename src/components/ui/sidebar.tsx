
"use client"

import * as React from "react"
import { ChevronLast, ChevronFirst } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type CollapsibleState = "icon" | "full"

const SidebarContext = React.createContext<{
  collapsible: CollapsibleState
  setCollapsible: React.Dispatch<React.SetStateAction<CollapsibleState>>
} | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsible, setCollapsible] = React.useState<CollapsibleState>("full")

  return (
    <SidebarContext.Provider value={{ collapsible, setCollapsible }}>
      <TooltipProvider>{children}</TooltipProvider>
    </SidebarContext.Provider>
  )
}

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { collapsible } = useSidebar()
  return (
    <aside ref={ref} className="h-full">
      <nav
        data-collapsible={collapsible}
        className={cn(
          "hidden h-full flex-col border-r bg-sidebar text-sidebar-foreground sm:flex group",
          "data-[collapsible=full]:w-56 data-[collapsible=icon]:w-16",
          "transition-all duration-300 ease-in-out",
          className
        )}
        {...props}
      />
    </aside>
  )
})
Sidebar.displayName = "Sidebar"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { collapsible, setCollapsible } = useSidebar()
  return (
    <div
      ref={ref}
      className={cn(
        "flex h-16 items-center justify-between border-b border-sidebar-border p-4",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "flex items-center gap-2 overflow-hidden",
          "transition-all duration-300 ease-in-out",
          collapsible === "icon" && "w-0"
        )}
      >
        {props.children}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={() => setCollapsible(collapsible === "full" ? "icon" : "full")}
      >
        {collapsible === "full" ? <ChevronFirst /> : <ChevronLast />}
      </Button>
    </div>
  )
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
))
SidebarContent.displayName = "SidebarContent"

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-col gap-2 p-4", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

const SidebarMenuButton = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    isActive?: boolean
    tooltip?: string
  }
>(({ className, isActive, tooltip, ...props }, ref) => {
  const { collapsible } = useSidebar()

  const buttonContent = (
    <a
      ref={ref}
      className={cn(
        "flex w-full items-center justify-start gap-3 rounded-md px-4 py-3 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        isActive 
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsible === "icon" && "h-12 w-12 justify-center p-0",
        className
      )}
      {...props}
    >
      <div className="flex w-6 items-center justify-center">
        {props.children && (React.Children.toArray(props.children)[0] as React.ReactElement)}
      </div>
      <span
        className={cn(
          "flex-1 overflow-hidden whitespace-nowrap",
          "transition-all duration-300",
          collapsible === "icon" && "w-0"
        )}
      >
        {props.children && React.Children.toArray(props.children).slice(1)}
      </span>
    </a>
  )

  if (collapsible === "icon" && tooltip) {
    return (
        <Tooltip>
          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
          <TooltipContent side="right">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
    )
  }

  return buttonContent
})
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-auto border-t border-sidebar-border p-4", className)}
    {...props}
  />
))
SidebarFooter.displayName = "SidebarFooter"


const MobileSidebarToggle = () => (
    <div className="sm:hidden">
        {/* Placeholder for mobile sidebar toggle if needed in the future */}
    </div>
)


export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  useSidebar,
  MobileSidebarToggle,
}
