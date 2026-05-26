"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { SessionData, Candidate, CandidateDemand, BokResident } from "@/types";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCandidatesAction, sendCandidateDemandNotificationAction, getCandidateDemandsAction, deleteCandidateAction, acknowledgeCandidateDemandAction, addCandidateAction, updateCandidateAction } from "@/lib/actions";
import { useMainLayout } from "@/components/main-layout";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function RecruitmentView({ currentUser, activeView }: { currentUser: SessionData; activeView: string }) {
    const { t, dateLocale } = useLanguage();
    const { toast } = useToast();
    const { allBokResidents, allCandidates, allDemands, odbiorEntries: contextOdbiorEntries } = useMainLayout();
    const [candidates, setCandidates] = useState<Candidate[]>(allCandidates || []);
    const [demands, setDemands] = useState<CandidateDemand[]>(allDemands || []);
    const odbiorEntries = useMemo(() => contextOdbiorEntries || [], [contextOdbiorEntries]);
    const [loading, setLoading] = useState(!(allCandidates && allCandidates.length > 0));
    const isFetchingRef = useRef(false);
    const candidatesRef = useRef<Candidate[]>(allCandidates || []);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<'all' | 'oczekujace' | 'po_rozmowie'>('all');
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [dialogStep, setDialogStep] = useState<'none' | 'confirm' | 'sure'>('none');
    const [targetDemand, setTargetDemand] = useState<CandidateDemand | null>(null);

    // Candidate detail dialog state
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

    const [bokSearchQuery, setBokSearchQuery] = useState("");
    const [bokPassportVisible, setBokPassportVisible] = useState(false);
    const [passportDialogOpen, setPassportDialogOpen] = useState(false);
    const [passportInput, setPassportInput] = useState("");
    const [demandDialogOpen, setDemandDialogOpen] = useState(false);
    const [demandCandidate, setDemandCandidate] = useState<Candidate | null>(null);
    const [estimatedTime, setEstimatedTime] = useState("");
    const [pickupAddress, setPickupAddress] = useState("Brak adresu");
    const [demandRoomNumber, setDemandRoomNumber] = useState("");
    const [bokDemandLoading, setBokDemandLoading] = useState(false);

    const searchParams = useSearchParams();
    const router = useRouter();
    const demandIdParam = searchParams.get('demandId');

    const clearDemandParam = useCallback(() => {
        const params = new URLSearchParams(window.location.search);
        params.delete('demandId');
        router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    }, [router]);

    const handleAcceptDemand = async () => {
        if (!targetDemand) return;
        try {
            const result = await acknowledgeCandidateDemandAction(targetDemand.id, currentUser.name);
            if (result.success) {
                // Optimistically update demand status in local state immediately
                setDemands(prev => prev.map(d =>
                    d.id === targetDemand.id
                        ? { ...d, status: 'acknowledged', acknowledgedBy: currentUser.name, acknowledgedAt: new Date().toISOString() }
                        : d
                ));
                setDialogStep('none');
                clearDemandParam();
                toast({ title: t("common.success"), description: t("candidate.acceptedDesc") });
            } else {
                toast({ variant: "destructive", title: t("common.error"), description: result.error || t("candidate.demandError") });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("common.error"), description: String(err) });
        }
    };

    const handleRejectDemand = () => {
        setDialogStep('sure');
    };

    const handleSureYes = () => {
        setDialogStep('none');
        setTargetDemand(null);
        clearDemandParam();
    };

    const handleSureNo = () => {
        setDialogStep('confirm');
    };

    const handledDemandIdRef = useRef<string | null>(null);

    // Open confirmation dialog when demandId is present in URL
    useEffect(() => {
        if (activeView !== 'recruitment' || !demandIdParam || demands.length === 0) return;
        if (handledDemandIdRef.current === demandIdParam) return;
        const demand = demands.find(d => d.id === demandIdParam);
        if (demand && demand.status === 'pending') {
            handledDemandIdRef.current = demandIdParam;
            setTargetDemand(demand);
            setDialogStep('confirm');
        } else {
            clearDemandParam();
        }
    }, [activeView, demandIdParam, demands, clearDemandParam]);

    // Reset handled demand tracker when URL param is cleared
    useEffect(() => {
        if (!demandIdParam) {
            handledDemandIdRef.current = null;
        }
    }, [demandIdParam]);

    const handleDelete = async (candidate: Candidate) => {
        if (!currentUser.isAdmin) return;
        setDeletingId(candidate.id);
        try {
            const result = await deleteCandidateAction(candidate.id, currentUser.uid);
            if (result.success) {
                setCandidates(prev => prev.filter(c => c.id !== candidate.id));
                toast({ title: t("common.success"), description: t("candidate.deleted") });
            } else {
                toast({ variant: "destructive", title: t("common.error"), description: result.error || t("candidate.deleteError") });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("common.error"), description: String(err) });
        } finally {
            setDeletingId(null);
        }
    };



    const submitDemand = async () => {
        if (!demandCandidate) return;
        setSendingId(demandCandidate.id);
        try {
            const result = await sendCandidateDemandNotificationAction(demandCandidate, estimatedTime, pickupAddress, demandRoomNumber || undefined);
            if (result.success) {
                toast({ title: t("candidate.demandSent"), description: t("candidate.demandSentDesc", { count: result.sentCount }) });
                const updatedDemands = await getCandidateDemandsAction();
                setDemands(updatedDemands);
                setDemandDialogOpen(false);
                window.dispatchEvent(new Event('candidates-updated'));
            } else {
                toast({ variant: "destructive", title: t("candidate.demandError"), description: result.error || "" });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("candidate.demandError"), description: String(err) });
        } finally {
            setSendingId(null);
        }
    };

    const handleBokDemand = async (bokResident: BokResident) => {
        setBokDemandLoading(true);
        try {
            // Reuse existing candidate for this BOK resident instead of creating duplicates
            const existing = candidates.find(c => c.bokId === bokResident.id);
            if (existing) {
                setDemandCandidate(existing);
                setEstimatedTime("");
                setDemandRoomNumber(bokResident.roomNumber || "");
                setPickupAddress(bokResident.address || "Brak adresu");
                setDemandDialogOpen(true);
                return;
            }
            const result = await addCandidateAction({
                firstName: bokResident.firstName,
                lastName: bokResident.lastName,
                passportNumber: bokResident.passportNumber || '',
                bokId: bokResident.id,
            });
            if (result.success && result.candidate) {
                setCandidates(prev => [...prev, result.candidate!]);
                setDemandCandidate(result.candidate);
                setEstimatedTime("");
                setDemandRoomNumber(bokResident.roomNumber || "");
                setPickupAddress(bokResident.address || "Brak adresu");
                setDemandDialogOpen(true);
            } else {
                toast({ variant: "destructive", title: t("common.error"), description: result.error || "Błąd tworzenia kandydata" });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("common.error"), description: String(err) });
        } finally {
            setBokDemandLoading(false);
        }
    };

    const loadData = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            // If context has no data yet, fetch immediately
            if (!allCandidates || !allDemands) {
                if (candidates.length === 0) setLoading(true);
                const [candData, demandData] = await Promise.all([
                    Promise.resolve(getCandidatesAction()).catch(() => [] as Candidate[]),
                    Promise.resolve(getCandidateDemandsAction()).catch(() => [] as CandidateDemand[]),
                ]);
                setCandidates(candData);
                candidatesRef.current = candData;
                setDemands(demandData);
                setLoading(false);
            }
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("common.error"), description: String(err) });
            setLoading(false);
        } finally {
            isFetchingRef.current = false;
        }
    }, [toast, t, candidates.length, allCandidates, allDemands]);

    useEffect(() => {
        if (activeView === 'recruitment') {
            loadData();
        }
    }, [activeView, loadData]);

    // Sync with context data when it arrives
    useEffect(() => {
        if (allCandidates && allCandidates.length > 0) {
            setCandidates(allCandidates);
            candidatesRef.current = allCandidates;
            setLoading(false);
        }
    }, [allCandidates]);

    useEffect(() => {
        if (allDemands && allDemands.length > 0) {
            setDemands(allDemands);
        }
    }, [allDemands]);

    // Poll demands every 30s so status updates without page refresh
    useEffect(() => {
        if (activeView !== 'recruitment') return;
        const interval = setInterval(async () => {
            try {
                const updatedCandidates = await getCandidatesAction();
                setCandidates(updatedCandidates);
            } catch { /* ignore */ }
            try {
                const updated = await getCandidateDemandsAction();
                setDemands(updated);
            } catch { /* ignore background poll errors */ }
        }, 30000);
        return () => clearInterval(interval);
    }, [activeView]);

    const handleRowClick = (candidate: Candidate) => {
        setSelectedCandidate(candidate);
    };

    const filteredCandidates = useMemo(() => {
        const dismissedBokIds = new Set(
            (allBokResidents || [])
                .filter(r => r.status === 'dismissed')
                .map(r => r.id)
        );
        const dismissedSourceIds = new Set(
            odbiorEntries
                .filter(e => e.convertedToBokId && dismissedBokIds.has(e.convertedToBokId))
                .map(e => e.id)
        );
        // Zestaw nazwisk+imion zwolnionych mieszkańców BOK – fallback dla kandydatów bez bokId
        const dismissedBokNames = new Set(
            (allBokResidents || [])
                .filter(r => r.status === 'dismissed')
                .map(r => `${r.firstName.trim().toLowerCase()}|${r.lastName.trim().toLowerCase()}`)
        );
        return candidates
            .filter(c => c.status === 'nowy' || c.status === 'wdrodze' || c.status === 'zakwaterowana' || c.status === 'po_rozmowie' || c.status === 'w_biurze')
            .filter(c => {
                // Sprawdź przez bezpośrednie bokId (najpewniejsza ścieżka)
                if (c.bokId && dismissedBokIds.has(c.bokId)) return false;
                // Sprawdź przez łańcuch sourceOdbiorId → OdbiorEntry → BOK
                if (c.sourceOdbiorId && dismissedSourceIds.has(c.sourceOdbiorId)) return false;
                // Fallback: dopasowanie imienia i nazwiska (dla starych kandydatów bez bokId)
                // Nie filtrujemy nowych aplikacji (nowy, wdrodze), bo to może być nowe zgłoszenie lub testy
                if (c.status !== 'nowy' && c.status !== 'wdrodze') {
                    const nameKey = `${c.firstName.trim().toLowerCase()}|${c.lastName.trim().toLowerCase()}`;
                    if (dismissedBokNames.has(nameKey)) return false;
                }
                return true;
            })
            .filter(c => {
                if (statusFilter === 'po_rozmowie') return c.status === 'po_rozmowie';
                if (statusFilter === 'oczekujace') return c.status !== 'po_rozmowie';
                return true;
            })
            .filter(c => c.lastName.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [candidates, allBokResidents, odbiorEntries, searchQuery, statusFilter]);

    // O(1) demand lookup
    const demandMap = useMemo(() => {
        const map = new Map<string, CandidateDemand>();
        for (const d of demands) {
            const existing = map.get(d.candidateId);
            if (!existing || new Date(d.requestedAt).getTime() > new Date(existing.requestedAt).getTime()) {
                map.set(d.candidateId, d);
            }
        }
        return map;
    }, [demands]);

    const candidateMap = useMemo(() => {
        const map = new Map<string, Candidate>();
        for (const c of candidates) map.set(c.id, c);
        return map;
    }, [candidates]);

    const demandCandidateMap = candidateMap;

    const findBokResidentForCandidate = (candidate: Candidate): BokResident | undefined => {
        // Try by bokId first (direct link)
        if (candidate.bokId) {
            const byBokId = allBokResidents?.find(r => r.id === candidate.bokId);
            if (byBokId) return byBokId;
        }
        // Then try via sourceOdbiorId
        if (candidate.sourceOdbiorId) {
            const entry = odbiorEntries.find(e => e.id === candidate.sourceOdbiorId);
            if (entry?.convertedToBokId) {
                const bySource = allBokResidents?.find(r => r.id === entry.convertedToBokId);
                if (bySource) return bySource;
            }
        }
        // Fallback: match by firstName and lastName (especially for 'zakwaterowana' status)
        if (allBokResidents) {
            const candFirst = candidate.firstName.trim().toLowerCase();
            const candLast = candidate.lastName.trim().toLowerCase();
            const byName = allBokResidents.find(r => 
                r.firstName.trim().toLowerCase() === candFirst && 
                r.lastName.trim().toLowerCase() === candLast
            );
            if (byName) return byName;
        }
        
        return undefined;
    };

    const handleCandidateDemand = (candidate: Candidate) => {
        const bok = findBokResidentForCandidate(candidate);
        setDemandCandidate(candidate);
        setEstimatedTime("");
        setDemandRoomNumber(bok?.roomNumber || "");
        // Use empty string so user sees placeholder; don't pre-fill 'Brak adresu'
        setPickupAddress(bok?.address || "");
        setDemandDialogOpen(true);
    };

    const handleFinishCandidate = async (candidate: Candidate) => {
        try {
            const result = await updateCandidateAction(candidate.id, { status: 'po_rozmowie' });
            if (result.success) {
                setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, status: 'po_rozmowie' as const } : c));
                toast({ title: 'Status zmieniony', description: `${candidate.firstName} ${candidate.lastName} - Po rozmowie` });
            } else {
                toast({ variant: 'destructive', title: 'Błąd', description: result.error });
            }
        } catch (err) {
            toast({ variant: 'destructive', title: 'Błąd', description: String(err) });
        }
    };

    const demandStatusBadge = (demand?: CandidateDemand) => {
        if (!demand) return <span className="text-muted-foreground text-sm">—</span>;

        const details = (
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {(demand.pickupAddress && demand.pickupAddress !== "Brak adresu") ? (
                    <div>
                        📍 {demand.pickupAddress} {demand.roomNumber ? `(Pokój: ${demand.roomNumber})` : ''}
                    </div>
                ) : null}
                {(demand.sentTo && demand.sentTo.length > 0) ? (
                    <div>{t("candidate.sentTo")}: {demand.sentTo.join(', ')}</div>
                ) : null}
            </div>
        );

        switch (demand.status) {
            case 'pending':
                return (
                    <div>
                        <Badge variant="secondary">{t("candidate.pendingAck")}</Badge>
                        {details}
                    </div>
                );
            case 'acknowledged':
                return (
                    <div className="text-xs text-muted-foreground">
                        ✅ {t("candidate.acknowledgedBy")}: <span className="font-medium">{demand.acknowledgedBy || '—'}</span>
                        <br />
                        {demand.acknowledgedAt ? format(new Date(demand.acknowledgedAt), "dd.MM.yyyy HH:mm", { locale: dateLocale }) : ''}
                        {details}
                    </div>
                );
            case 'delivered':
                return (
                    <div className="text-xs text-muted-foreground">
                        🚚 {t("candidate.demandDelivered").replace('{name}', demand.acknowledgedBy || '—')}
                        <br />
                        {demand.acknowledgedAt ? format(new Date(demand.acknowledgedAt), "dd.MM.yyyy HH:mm", { locale: dateLocale }) : ''}
                        {details}
                    </div>
                );
            case 'expired':
                return (
                    <div>
                        <Badge variant="destructive">{t("candidate.demandExpired")}</Badge>
                        {details}
                    </div>
                );
            default:
                return <div><Badge>{demand.status}</Badge>{details}</div>;
        }
    };

    const statusBadge = (status: Candidate["status"]) => {
        switch (status) {
            case "nowy":
                return <Badge variant="secondary">{t("candidate.statusNowy")}</Badge>;
            case "w_trakcie":
                return <Badge variant="default">{t("candidate.statusWTrakcie")}</Badge>;
            case "zakonczony":
                return <Badge variant="outline">{t("candidate.statusZakonczony")}</Badge>;
            case "zakwaterowana":
                return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">{t("candidate.statusZakwaterowana")}</Badge>;
            case "wdrodze":
                return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">{t("candidate.statusWdrodze")}</Badge>;
            case "w_biurze":
                return <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">{t("candidate.statusWBiurze")}</Badge>;
            case "po_rozmowie":
                return <Badge variant="default" className="bg-green-600 text-white border-green-600 hover:bg-green-700">{t("candidate.statusPoRozmowie")}</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    const rowBgClass = (status: Candidate["status"]) => {
        switch (status) {
            case "nowy":         return "";
            case "wdrodze":      return "bg-blue-50/60 hover:bg-blue-100/60 dark:bg-blue-950/30";
            case "w_biurze":     return "bg-amber-50/70 hover:bg-amber-100/60 dark:bg-amber-950/30";
            case "zakwaterowana":return "bg-green-50/60 hover:bg-green-100/60 dark:bg-green-950/30";
            case "po_rozmowie":  return "bg-green-50/60 hover:bg-green-100/60 dark:bg-green-950/30";
            default:             return "";
        }
    };



    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold tracking-tight">{t("nav.recruitment")}</h1>
                <div className="w-full sm:w-72">
                    <Input
                        placeholder={t("candidate.searchBySurname")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Status filter buttons */}
            {(() => {
                const baseList = candidates
                    .filter(c => c.status === 'nowy' || c.status === 'wdrodze' || c.status === 'zakwaterowana' || c.status === 'po_rozmowie' || c.status === 'w_biurze');
                const countAll = baseList.length;
                const countOczekujace = baseList.filter(c => c.status !== 'po_rozmowie').length;
                const countPoRozmowie = baseList.filter(c => c.status === 'po_rozmowie').length;
                return (
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 w-[12cm] shrink-0 transition-all font-semibold text-sm ${
                                statusFilter === 'all'
                                    ? 'border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]'
                                    : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                        >
                            <span className="text-2xl font-bold">{countAll}</span>
                            <span className="text-xs">{t('candidate.filterAll')}</span>
                        </button>
                        <button
                            onClick={() => setStatusFilter('oczekujace')}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 w-[12cm] shrink-0 transition-all font-semibold text-sm ${
                                statusFilter === 'oczekujace'
                                    ? 'border-red-500 bg-red-500 text-white shadow-md scale-[1.02]'
                                    : 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                        >
                            <span className="text-2xl font-bold">{countOczekujace}</span>
                            <span className="text-xs">{t('candidate.filterPending')}</span>
                        </button>
                        <button
                            onClick={() => setStatusFilter('po_rozmowie')}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 w-[12cm] shrink-0 transition-all font-semibold text-sm ${
                                statusFilter === 'po_rozmowie'
                                    ? 'border-green-600 bg-green-600 text-white shadow-md scale-[1.02]'
                                    : 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                        >
                            <span className="text-2xl font-bold">{countPoRozmowie}</span>
                            <span className="text-xs">{t('candidate.filterAfterInterview')}</span>
                        </button>
                    </div>
                );
            })()}

            {(loading && candidates.length === 0) ? (
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/3" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                </Card>
            ) : filteredCandidates.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                        {candidates.length === 0 ? t("common.noData") : t("candidate.searchBySurname")}
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Desktop table */}
                    <Card className="hidden sm:block" data-testid="recruitment-desktop">
                        <CardHeader>
                            <CardTitle>{t("candidate.title")}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[60vh]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t("candidate.lastName")}</TableHead>
                                            <TableHead>{t("candidate.firstName")}</TableHead>
                                            <TableHead>{t("candidate.passportNumber")}</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>{t("candidate.dateAdded")}</TableHead>
                                            <TableHead>{t("candidate.demandStatusLabel")}</TableHead>
                                            <TableHead className="w-[100px]">{t("col.actions")}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCandidates.map((c) => {
                                            const demand = demandMap.get(c.id);
                                            return (
                                                <TableRow
                                                    key={c.id}
                                                    className={`cursor-pointer transition-colors ${rowBgClass(c.status)} ${c.status !== 'po_rozmowie' ? 'animate-blink-light-red' : ''}`}
                                                    onClick={() => handleRowClick(c)}
                                                >
                                                    <TableCell className="font-medium">{c.lastName}</TableCell>
                                                    <TableCell>{c.firstName}</TableCell>
                                                    <TableCell>
                                                        {(() => {
                                                            if (!c.passportNumber) return '-';
                                                            if (bokPassportVisible) return c.passportNumber;
                                                            return (
                                                                <button
                                                                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                                                    title="Pokaż numer paszportu"
                                                                    aria-label="Pokaż numer paszportu"
                                                                    onClick={() => setPassportDialogOpen(true)}
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                            );
                                                        })()}
                                                    </TableCell>
                                                    <TableCell>{statusBadge(c.status)}</TableCell>
                                                    <TableCell>
                                                        {c.createdAt
                                                            ? format(new Date(c.createdAt), "dd.MM.yyyy HH:mm", { locale: dateLocale })
                                                            : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {demandStatusBadge(demand)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                            {c.status === 'zakwaterowana' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleCandidateDemand(c)}
                                                                >
                                                                    {t("candidate.demandBtn")}
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => handleFinishCandidate(c)}
                                                            >
                                                                {t("candidate.finishBtn")}
                                                            </Button>
                                                            {currentUser.isAdmin && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    disabled={deletingId === c.id}
                                                                    onClick={() => handleDelete(c)}
                                                                >
                                                                    {deletingId === c.id ? t("common.processing") : t("common.delete")}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-3">
                        {filteredCandidates.map((c) => {
                            const demand = demandMap.get(c.id);
                            return (
                                <Card
                                    key={c.id}
                                    className={`overflow-hidden cursor-pointer active:opacity-80 border-l-4 ${
                                        c.status === 'wdrodze'      ? 'border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/20' :
                                        c.status === 'w_biurze'     ? 'border-l-amber-400 bg-amber-50/60 dark:bg-amber-950/20' :
                                        c.status === 'zakwaterowana'? 'border-l-green-400 bg-green-50/50 dark:bg-green-950/20' :
                                        c.status === 'po_rozmowie'  ? 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20' :
                                        'border-l-transparent'
                                    } ${c.status !== 'po_rozmowie' ? 'animate-blink-light-red' : ''}`}
                                    onClick={() => handleRowClick(c)}
                                >
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-semibold text-base">{c.lastName} {c.firstName}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {(() => {
                                                        if (!c.passportNumber) return '-';
                                                        if (bokPassportVisible) return c.passportNumber;
                                                        return (
                                                            <button
                                                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                                                title="Pokaż numer paszportu"
                                                                aria-label="Pokaż numer paszportu"
                                                                onClick={() => setPassportDialogOpen(true)}
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        );
                                                    })()}
                                                </p>
                                            </div>
                                            {statusBadge(c.status)}
                                        </div>

                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">{t("candidate.dateAdded")}</span>
                                            <span>
                                                {c.createdAt
                                                    ? format(new Date(c.createdAt), "dd.MM.yyyy HH:mm", { locale: dateLocale })
                                                    : "-"}
                                            </span>
                                        </div>

                                        {demand && (
                                            <div className="text-xs border-t pt-2">
                                                <span className="text-muted-foreground">{t("candidate.demandStatusLabel")}: </span>
                                                {demandStatusBadge(demand)}
                                            </div>
                                        )}

                                        <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                            {c.status === 'zakwaterowana' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1"
                                                    onClick={() => handleCandidateDemand(c)}
                                                >
                                                    {t("candidate.demandBtn")}
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="flex-1"
                                                onClick={() => handleFinishCandidate(c)}
                                            >
                                                {t("candidate.finishBtn")}
                                            </Button>
                                            {currentUser.isAdmin && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-1"
                                                    disabled={deletingId === c.id}
                                                    onClick={() => handleDelete(c)}
                                                >
                                                    {deletingId === c.id ? t("common.processing") : t("common.delete")}
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </>
            )}

            {/* BOK Residents Search (read-only) */}
            {allBokResidents && allBokResidents.length > 0 && (
                <Card className="mt-6" data-testid="bok-search-section">
                    <CardHeader>
                        <CardTitle>Wyszukiwanie kandydatow w BOK</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            placeholder="Szukaj po nazwisku lub imieniu..."
                            value={bokSearchQuery}
                            onChange={(e) => setBokSearchQuery(e.target.value)}
                        />
                        <ScrollArea className="h-[40vh]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nazwisko</TableHead>
                                        <TableHead>Imię</TableHead>
                                        <TableHead>Data zameldowania</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Nr paszportu</TableHead>
                                        <TableHead className="w-[160px]">Akcje</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(() => {
                                        const query = bokSearchQuery.toLowerCase();
                                        // Show only ACTIVE residents
                                        const activeBokResidents = allBokResidents.filter(r => r.status !== 'dismissed');
                                        const filtered = query
                                            ? activeBokResidents.filter(r =>
                                                (r.lastName?.toLowerCase() || '').includes(query) ||
                                                (r.firstName?.toLowerCase() || '').includes(query) ||
                                                `${r.lastName} ${r.firstName}`.toLowerCase().includes(query)
                                              )
                                            : activeBokResidents.slice(0, 20);
                                        return filtered.map(r => (
                                            <TableRow key={r.id} className={r.status === 'dismissed' ? 'opacity-50' : ''}>
                                                <TableCell className="font-medium">{r.lastName}</TableCell>
                                                <TableCell>{r.firstName}</TableCell>
                                                <TableCell>{r.checkInDate ? format(new Date(r.checkInDate), 'dd.MM.yyyy') : '-'}</TableCell>
                                                <TableCell>
                                                    {r.status === 'dismissed'
                                                        ? <Badge variant="outline" className="text-xs text-muted-foreground">Zwolniony</Badge>
                                                        : <Badge variant="outline" className="text-xs text-green-700 border-green-300">Aktywny</Badge>
                                                    }
                                                </TableCell>
                                                <TableCell>
                                                    {(() => {
                                                        if (!r.passportNumber) return '-';
                                                        if (bokPassportVisible) return r.passportNumber;
                                                        return (
                                                            <button
                                                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                                                title="Pokaż numer paszportu"
                                                                aria-label="Pokaż numer paszportu"
                                                                onClick={() => setPassportDialogOpen(true)}
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        );
                                                    })()}
                                                </TableCell>
                                                <TableCell>
                                                    {r.status !== 'dismissed' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={bokDemandLoading}
                                                        onClick={() => handleBokDemand(r)}
                                                    >
                                                        {bokDemandLoading ? t("common.loading") : "Zapotrzebowanie"}
                                                    </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ));
                                    })()}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}

            {/* Candidate detail dialog */}
            <Dialog open={!!selectedCandidate} onOpenChange={(open) => { if (!open) setSelectedCandidate(null); }}>
                <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedCandidate?.lastName} {selectedCandidate?.firstName}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        {selectedCandidate?.passportPhotoUrl ? (
                            bokPassportVisible ? (
                                <div className="rounded-lg overflow-hidden border">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={selectedCandidate.passportPhotoUrl} alt="Paszport" className="w-full object-contain max-h-64" />
                                </div>
                            ) : (
                                <div
                                    className="rounded-lg border border-dashed flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => setPassportDialogOpen(true)}
                                >
                                    <Eye className="w-6 h-6" />
                                    <span>Kliknij aby zobaczyć zdjęcie paszportu</span>
                                </div>
                            )
                        ) : (
                            <div className="rounded-lg border border-dashed flex items-center justify-center h-32 text-muted-foreground text-sm">
                                {t('candidate.noPassportPhoto')}
                            </div>
                        )}
                        <div className="text-sm space-y-1">
                            {selectedCandidate?.passportNumber && (
                                <p><span className="text-muted-foreground">{t('candidate.passportNumber')}:</span> <span className="font-mono font-medium">{selectedCandidate.passportNumber}</span></p>
                            )}
                            <p><span className="text-muted-foreground">{t('candidate.dateAdded')}:</span> {selectedCandidate?.createdAt ? format(new Date(selectedCandidate.createdAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale }) : '—'}</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Demand Dialog */}
            <Dialog open={demandDialogOpen} onOpenChange={setDemandDialogOpen}>
                <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Zapotrzebowanie na kandydata</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="text-sm">
                            Wybierz przewidywany czas dostarczenia osoby: <strong>{demandCandidate?.firstName} {demandCandidate?.lastName}</strong>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Adres odbioru</label>
                            <Input
                                type="text"
                                value={pickupAddress}
                                onChange={(e) => setPickupAddress(e.target.value)}
                                placeholder="Np. ul. Warszawska 10/5"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Numer pokoju (opcjonalnie)</label>
                            <Input
                                type="text"
                                value={demandRoomNumber}
                                onChange={(e) => setDemandRoomNumber(e.target.value)}
                                placeholder="Np. 12"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Czas dostarczenia</label>
                            <Input
                                type="time"
                                value={estimatedTime}
                                onChange={(e) => setEstimatedTime(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setDemandDialogOpen(false)}>
                                {t("common.cancel")}
                            </Button>
                            <Button 
                                onClick={submitDemand} 
                                disabled={!estimatedTime || sendingId === demandCandidate?.id}
                            >
                                {sendingId === demandCandidate?.id ? t("common.loading") : t("common.send")}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog 1: Accept demand? */}
            <AlertDialog open={dialogStep === 'confirm'}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("candidate.acceptDemandTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {targetDemand && (
                                <>
                                    <span className="font-medium">{targetDemand.candidateLastName} {targetDemand.candidateFirstName}</span>
                                    {(() => {
                                        const cand = demandCandidateMap.get(targetDemand.candidateId);
                                        return cand?.passportNumber ? (
                                            <span className="text-muted-foreground"> — {cand.passportNumber}</span>
                                        ) : null;
                                    })()}
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={handleRejectDemand}>{t("candidate.no")}</Button>
                        <Button onClick={handleAcceptDemand}>{t("candidate.yes")}</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Dialog 2: Are you sure? */}
            <AlertDialog open={dialogStep === 'sure'}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("candidate.areYouSure")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("candidate.pendingAck")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={handleSureNo}>{t("candidate.no")}</Button>
                        <Button onClick={handleSureYes}>{t("candidate.yes")}</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Passport password dialog */}
            <AlertDialog open={passportDialogOpen} onOpenChange={setPassportDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Wprowadź hasło</AlertDialogTitle>
                        <AlertDialogDescription>
                            Aby zobaczyć numer paszportu, wpisz hasło:
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                        type="password"
                        placeholder="Hasło"
                        value={passportInput}
                        onChange={(e) => setPassportInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (passportInput === '2121') {
                                    setBokPassportVisible(true);
                                    setPassportDialogOpen(false);
                                    setPassportInput('');
                                    setTimeout(() => setBokPassportVisible(false), 5000);
                                } else {
                                    toast({ variant: 'destructive', title: 'Błędne hasło' });
                                }
                            }
                        }}
                    />
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={() => { setPassportDialogOpen(false); setPassportInput(''); }}>
                            Anuluj
                        </Button>
                        <Button onClick={() => {
                            if (passportInput === '2121') {
                                setBokPassportVisible(true);
                                setPassportDialogOpen(false);
                                setPassportInput('');
                                setTimeout(() => setBokPassportVisible(false), 5000);
                            } else {
                                toast({ variant: 'destructive', title: 'Błędne hasło' });
                            }
                        }}>
                            Potwierdź
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
