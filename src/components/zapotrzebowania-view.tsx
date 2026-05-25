"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { SessionData, CandidateDemand } from "@/types";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCandidateDemandsAction, acknowledgeCandidateDemandAction, deliverCandidateDemandAction, deleteCandidateDemandAction } from "@/lib/actions";
import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function ZapotrzebowaniaView({ currentUser, activeView }: { currentUser: SessionData; activeView: string }) {
    const { t, dateLocale } = useLanguage();
    const { toast } = useToast();
    const [demands, setDemands] = useState<CandidateDemand[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const isFetchingRef = useRef(false);

    const loadData = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoading(true);
        try {
            const demandData = await getCandidateDemandsAction();
            setDemands(demandData);
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("common.error"), description: String(err) });
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
        }
    }, [toast, t]);

    useEffect(() => {
        if (activeView === 'zapotrzebowania') {
            loadData();
        }
    }, [activeView, loadData]);

    useEffect(() => {
        if (activeView !== 'zapotrzebowania') return;
        const interval = setInterval(async () => {
            try {
                const updated = await getCandidateDemandsAction();
                setDemands(updated);
            } catch { /* ignore background poll errors */ }
        }, 30000);
        return () => clearInterval(interval);
    }, [activeView]);

    const handleAcceptDemand = async (demandId: string) => {
        try {
            const result = await acknowledgeCandidateDemandAction(demandId, currentUser.name);
            if (result.success) {
                setDemands(prev => prev.map(d =>
                    d.id === demandId
                        ? { ...d, status: 'acknowledged', acknowledgedBy: currentUser.name, acknowledgedAt: new Date().toISOString() }
                        : d
                ));
                toast({ title: t("common.success"), description: "Zapotrzebowanie zaakceptowane" });
            } else {
                toast({ variant: "destructive", title: t("common.error"), description: result.error || "Wystąpił błąd" });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("common.error"), description: String(err) });
        }
    };

    const handleDeleteDemand = async (demandId: string) => {
        if (!currentUser.isRekrutacja && !currentUser.isAdmin) return;
        setDeletingId(demandId);
        try {
            const result = await deleteCandidateDemandAction(demandId, currentUser.uid);
            if (result.success) {
                setDemands(prev => prev.filter(d => d.id !== demandId));
                toast({ title: t("common.success"), description: "Zapotrzebowanie usunięte" });
            } else {
                toast({ variant: "destructive", title: t("common.error"), description: result.error || "Wystąpił błąd" });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("common.error"), description: String(err) });
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeliverDemand = async (demandId: string) => {
        try {
            const result = await deliverCandidateDemandAction(demandId, currentUser.name);
            if (result.success) {
                setDemands(prev => prev.map(d =>
                    d.id === demandId
                        ? { ...d, status: 'delivered', acknowledgedBy: currentUser.name, acknowledgedAt: new Date().toISOString() }
                        : d
                ));
                toast({ title: t("common.success"), description: "Kandydat oznaczony jako dostarczony" });
            } else {
                toast({ variant: "destructive", title: t("common.error"), description: result.error || "Wystąpił błąd" });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("common.error"), description: String(err) });
        }
    };


    const activeDemands = demands
        .filter(d => d.status === 'pending' || d.status === 'acknowledged')
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    const historyDemands = demands
        .filter(d => d.status === 'delivered' || d.status === 'expired')
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    const statusBadge = (demand: CandidateDemand) => {
        if (demand.status === 'pending') return <Badge variant="secondary" className="text-sm px-3 py-1">Oczekujące</Badge>;
        if (demand.status === 'acknowledged') return <Badge variant="default" className="text-sm px-3 py-1">Zaakceptowane przez {demand.acknowledgedBy}</Badge>;
        if (demand.status === 'delivered') return <Badge variant="outline" className="text-sm px-3 py-1 text-green-600 border-green-400">Dostarczone przez {demand.acknowledgedBy}</Badge>;
        return <Badge variant="outline" className="text-sm px-3 py-1 text-muted-foreground">Wygasłe</Badge>;
    };


    if (loading) {
        return (
            <div className="space-y-4" data-testid="zapotrzebowania-skeleton">
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-1 gap-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold tracking-tight">Zapotrzebowania</h1>
            </div>

            {activeDemands.length === 0 ? (
                <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground py-12">
                        Brak aktywnych zapotrzebowań.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {activeDemands.map(demand => (
                        <Card key={demand.id}>
                            <CardContent className="pt-6">
                                <div className="flex flex-col md:flex-row justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="font-semibold text-lg">
                                            {demand.candidateFirstName} {demand.candidateLastName}
                                        </div>
                                        <div className="text-sm text-muted-foreground flex flex-col gap-1">
                                            <div>
                                                <span className="font-medium text-foreground">Skąd (adres):</span> {demand.pickupAddress || 'Brak danych'}
                                            </div>
                                            {demand.roomNumber && (
                                                <div>
                                                    <span className="font-medium text-foreground">Pokój:</span> {demand.roomNumber}
                                                </div>
                                            )}
                                            <div>
                                                <span className="font-medium text-foreground">Czas dostarczenia:</span> {demand.estimatedDeliveryTime || 'Brak danych'}
                                            </div>
                                            <div>
                                                <span className="font-medium text-foreground">Zgłoszone przez:</span> {demand.requestedBy}
                                            </div>
                                            <div>
                                                <span className="font-medium text-foreground">Data zgłoszenia:</span> {format(new Date(demand.requestedAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end justify-between min-w-[200px] gap-4">
                                        {statusBadge(demand)}

                                        <div className="flex flex-col gap-2 w-full md:w-auto">
                                            {demand.status === 'pending' && (currentUser.isDriver || currentUser.isBok || currentUser.isAdmin) && (
                                                <Button onClick={() => handleAcceptDemand(demand.id)} className="w-full md:w-auto">
                                                    Akceptuj
                                                </Button>
                                            )}
                                            {demand.status === 'acknowledged' && (currentUser.isDriver || currentUser.isAdmin) && (
                                                <Button variant="outline" onClick={() => handleDeliverDemand(demand.id)} className="w-full md:w-auto">
                                                    Dostarczone
                                                </Button>
                                            )}
                                            {(currentUser.isRekrutacja || currentUser.isAdmin) && (
                                                <Button
                                                    variant="ghost"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full md:w-auto"
                                                    disabled={deletingId === demand.id}
                                                    onClick={() => handleDeleteDemand(demand.id)}
                                                >
                                                    {deletingId === demand.id ? t("common.processing") : t("common.delete")}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {historyDemands.length > 0 && (
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={() => setHistoryOpen(prev => !prev)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        Historia ({historyDemands.length})
                    </button>

                    {historyOpen && (
                        <div className="grid grid-cols-1 gap-3">
                            {historyDemands.map(demand => (
                                <Card key={demand.id} className="opacity-60">
                                    <CardContent className="pt-4 pb-4">
                                        <div className="flex flex-col md:flex-row justify-between gap-2">
                                            <div className="space-y-1">
                                                <div className="font-medium">
                                                    {demand.candidateFirstName} {demand.candidateLastName}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex flex-col gap-0.5">
                                                    <span>{demand.pickupAddress || 'Brak adresu'}</span>
                                                    <span>Zgłoszone: {format(new Date(demand.requestedAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}</span>
                                                    {demand.acknowledgedAt && (
                                                        <span>
                                                            {demand.status === 'delivered' ? 'Dostarczone' : 'Zakończone'}:{' '}
                                                            {format(new Date(demand.acknowledgedAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-start md:items-center">
                                                {statusBadge(demand)}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
