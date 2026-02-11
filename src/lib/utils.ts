import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Notification } from "@/types"
import { startOfDay, endOfDay } from "date-fns"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function batchPromises<T>(
    items: T[],
    batchSize: number,
    fn: (item: T) => Promise<void>,
    delayMs: number = 0
): Promise<void> {
    if (!items || items.length === 0) return;
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map(item => fn(item)));
        if (delayMs > 0 && i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

type NotificationFilters = {
    selectedCoordinatorId?: string;
    employeeNameFilter?: string;
    selectedDate?: Date;
}

export function filterNotifications(notifications: Notification[], filters: NotificationFilters): Notification[] {
    let tempNotifications = [...notifications];

    const { selectedCoordinatorId, employeeNameFilter, selectedDate } = filters;

    if (selectedCoordinatorId && selectedCoordinatorId !== 'all') {
        tempNotifications = tempNotifications.filter(n => n.recipientId === selectedCoordinatorId);
    }
    
    if (employeeNameFilter) {
        tempNotifications = tempNotifications.filter(n => {
            const entityFullName = `${n.entityFirstName || ''} ${n.entityLastName || ''}`.trim();
            if (!entityFullName) return false;
            return entityFullName.toLowerCase().includes(employeeNameFilter.toLowerCase());
        });
    }
    
    if (selectedDate) {
        const startDate = startOfDay(selectedDate);
        const endDate = endOfDay(selectedDate);
        tempNotifications = tempNotifications.filter(n => {
            const createdAt = new Date(n.createdAt);
            return createdAt >= startDate && createdAt <= endDate;
        });
    }

    return tempNotifications;
}
