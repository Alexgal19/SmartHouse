"use client";

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/lib/i18n';
import type { BokResident } from '@/types';

interface BokStatsDrillDownDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    yesLabel: string;
    noLabel: string;
    yesList: BokResident[];
    noList: BokResident[];
}

export function BokStatsDrillDownDialog({
    isOpen,
    onOpenChange,
    title,
    yesLabel,
    noLabel,
    yesList,
    noList,
}: BokStatsDrillDownDialogProps) {
    const { t } = useLanguage();
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg h-[80vh] max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 overflow-y-auto">
                    <div className="space-y-6 p-4">
                        <div>
                            <h3 className="text-sm font-semibold text-green-700 mb-2">
                                {yesLabel} ({yesList.length})
                            </h3>
                            {yesList.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
                            ) : (
                                <div className="space-y-2">
                                    {yesList.map((r) => (
                                        <div
                                            key={r.id}
                                            className="text-sm border rounded-lg p-2"
                                        >
                                            <div className="font-medium">
                                                {r.lastName} {r.firstName}
                                            </div>
                                            {(r.address || r.roomNumber) && (
                                                <div className="text-muted-foreground text-xs">
                                                    {r.address || ''}
                                                    {r.address && r.roomNumber ? ' / ' : ''}
                                                    {r.roomNumber || ''}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-red-600 mb-2">
                                {noLabel} ({noList.length})
                            </h3>
                            {noList.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
                            ) : (
                                <div className="space-y-2">
                                    {noList.map((r) => (
                                        <div
                                            key={r.id}
                                            className="text-sm border rounded-lg p-2"
                                        >
                                            <div className="font-medium">
                                                {r.lastName} {r.firstName}
                                            </div>
                                            {(r.address || r.roomNumber) && (
                                                <div className="text-muted-foreground text-xs">
                                                    {r.address || ''}
                                                    {r.address && r.roomNumber ? ' / ' : ''}
                                                    {r.roomNumber || ''}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
