
"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, User, CalendarOff } from "lucide-react";
import type { Employee, NonEmployee } from "@/types";
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ModernHouseIcon } from '../icons/modern-house-icon';

const kpiIcons = {
    housedEmployees: <Users className="h-6 w-6 text-primary" />,
    nonEmployees: <User className="h-6 w-6 text-purple-500" />,
    apartmentsInUse: <ModernHouseIcon className="h-6 w-6 text-primary" />,
    upcomingCheckouts: <CalendarOff className="h-6 w-6 text-pink-500" />,
};

type KpiCardProps = {
    title: string;
    value: string;
    icon: React.ReactNode;
    onClick?: () => void;
    description?: string;
}

const KpiCard = ({ title, value, icon, onClick, description }: KpiCardProps) => (
    <Card 
        onClick={onClick} 
        className={cn(
            "transition-all duration-300 animate-in fade-in-0 scale-95",
            onClick && "cursor-pointer hover:shadow-primary/20 hover:shadow-lg hover:-translate-y-1 hover:scale-100"
        )}
    >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

export function DashboardKPIs({
    employees,
    nonEmployees,
    onUpcomingCheckoutsClick
}: {
    employees: Employee[],
    nonEmployees: NonEmployee[],
    onUpcomingCheckoutsClick: () => void
}) {

    const stats = useMemo(() => {
        const activeEmployees = employees.filter(e => e.status === 'active');
        const upcomingCheckoutsList = activeEmployees.filter(e => {
            if (!e.checkOutDate) return false;
            const today = new Date();
            const date = parseISO(e.checkOutDate);
            const diff = differenceInDays(date, today);
            return diff >= 0 && diff <= 30;
        });
        
        const apartmentsInUse = new Set(activeEmployees.map(o => o.address).filter(Boolean)).size;

        return {
            totalEmployees: activeEmployees.length,
            nonEmployeesCount: nonEmployees.length,
            apartmentsInUse,
            upcomingCheckouts: upcomingCheckoutsList.length,
        };
    }, [employees, nonEmployees]);

    const kpiData = [
        { title: 'Wszyscy pracownicy', value: stats.totalEmployees.toString(), icon: kpiIcons.housedEmployees },
        { title: 'Mieszkańcy (NZ)', value: stats.nonEmployeesCount.toString(), icon: kpiIcons.nonEmployees },
        { title: 'Używane mieszkania', value: stats.apartmentsInUse.toString(), icon: kpiIcons.apartmentsInUse },
        { 
          title: 'Wykwaterowania (30 dni)', 
          value: stats.upcomingCheckouts.toString(), 
          icon: kpiIcons.upcomingCheckouts, 
          onClick: onUpcomingCheckoutsClick,
        },
    ];

    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {kpiData.map((kpi, index) => (
                <div key={kpi.title} className="animate-in fade-in-0 slide-in-from-bottom-4" style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}>
                    <KpiCard {...kpi} />
                </div>
            ))}
        </div>
    );
}
