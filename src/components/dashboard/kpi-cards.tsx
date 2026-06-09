
"use client";

import { useMemo } from 'react';

import { useLanguage } from '@/lib/i18n';
import { Users, User, CalendarOff } from "lucide-react";
import type { Employee, NonEmployee } from "@/types";
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ModernHouseIcon } from '../icons/modern-house-icon';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { countActiveAddressesInUse, isOwnAddressEntry } from '@/lib/address-filters';
import { useMainLayout } from '@/components/layouts/main-layout';

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
    isHighlighted?: boolean;
}

const KpiCard = ({ title, value, icon, onClick, description, isHighlighted }: KpiCardProps) => (
    <div
        onClick={onClick}
        className={cn(
            "bg-white/5 border border-white/10 rounded-2xl md:rounded-[20px] p-4 md:p-6 hover:bg-white/10 transition-colors backdrop-blur-md animate-bounce-in text-white",
            onClick && "cursor-pointer hover:shadow-primary/20 hover:shadow-lg hover:-translate-y-1 hover:scale-100 active:animate-haptic-press",
            isHighlighted && "animate-pulse-green"
        )}
    >
        <div className="flex flex-row items-center justify-between space-y-0 mb-2 md:mb-4">
            <h3 className="text-xs md:text-sm font-medium text-gray-400">{title}</h3>
            {icon}
        </div>
        <div>
            <p className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">{value}</p>
            {description && <p className="text-[10px] md:text-xs text-gray-500">{description}</p>}
        </div>
    </div>
);


export function DashboardKPIs({
    employees,
    nonEmployees,
    onUpcomingCheckoutsClick,
    hasNewCheckouts
}: {
    employees: Employee[],
    nonEmployees: NonEmployee[],
    onUpcomingCheckoutsClick: () => void,
    hasNewCheckouts: boolean
}) {
    const { t } = useLanguage();
    const { settings } = useMainLayout();

    const stats = useMemo(() => {
        const EXCLUDED_DEPARTMENTS = ['BOK', 'Odbiór', 'Rekrutacja'];

        const bokCoordinatorIds = new Set(
            settings?.coordinators
                .filter(c => c.isBok || c.departments?.includes('BOK'))
                .map(c => c.uid) || []
        );

        const bokAddresses = new Set(
            settings?.addresses
                .filter(a => a.coordinatorIds.some(id => bokCoordinatorIds.has(id)))
                .map(a => a.name) || []
        );

        const activeEmployees = employees.filter(e => {
            if (e.status !== 'active') return false;
            if (EXCLUDED_DEPARTMENTS.includes(e.zaklad || '')) return false;
            if (bokCoordinatorIds.has(e.coordinatorId)) return false;
            if (bokAddresses.has(e.address || '')) return false;
            return true;
        });
        const activeNonEmployees = nonEmployees.filter(ne => ne.status === 'active');
        const allActiveOccupants = [...activeEmployees, ...activeNonEmployees];
        const upcomingCheckoutsList = allActiveOccupants.filter(o => {
            if (!o.checkOutDate) return false;
            const today = new Date();
            const date = parseISO(o.checkOutDate);
            const diff = differenceInDays(date, today);
            return diff >= 0 && diff <= 30;
        });

        // Count all apartments that are active (not blocked) in the system
        // excluding personal apartments ("Własne mieszkania")
        const apartmentsInUse = settings
            ? settings.addresses.filter(a => a.isActive && !isOwnAddressEntry(a.name)).length
            : 0;

        return {
            totalEmployees: activeEmployees.length,
            nonEmployeesCount: activeNonEmployees.length,
            apartmentsInUse,
            upcomingCheckouts: upcomingCheckoutsList.length,
        };
    }, [employees, nonEmployees, settings]);

    const kpiData = [
        { title: t('dashboard.allEmployeesKPI'), value: stats.totalEmployees.toString(), icon: kpiIcons.housedEmployees },
        { title: t('dashboard.nonEmployeesKPI'), value: stats.nonEmployeesCount.toString(), icon: kpiIcons.nonEmployees },
        { title: t('dashboard.apartmentsInUse'), value: stats.apartmentsInUse.toString(), icon: kpiIcons.apartmentsInUse },
        {
            title: t('dashboard.upcomingCheckoutsKPI'),
            value: stats.upcomingCheckouts.toString(),
            icon: kpiIcons.upcomingCheckouts,
            onClick: onUpcomingCheckoutsClick,
            isHighlighted: hasNewCheckouts
        },
    ];

    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {kpiData.map((kpi, index) => (
                <div
                    key={kpi.title}
                    className={cn(
                        "animate-slide-up",
                        index === 0 && "animation-delay-stagger-1",
                        index === 1 && "animation-delay-stagger-2",
                        index === 2 && "animation-delay-stagger-3",
                        index === 3 && "animation-delay-stagger-4"
                    )}
                >
                    <KpiCard {...kpi} />
                </div>
            ))}
        </div>
    );
}
