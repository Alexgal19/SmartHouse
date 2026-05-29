"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { SessionData, Candidate, CandidateDemand, BokResident, OdbiorEntry } from "@/types";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCandidatesAction, sendCandidateDemandNotificationAction, getCandidateDemandsAction, deleteCandidateAction, acknowledgeCandidateDemandAction, addCandidateAction, updateCandidateAction } from "@/lib/actions";
import { useMainLayout } from "@/components/layouts/main-layout";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, MoreHorizontal, MapPin, CheckCircle2, Truck } from 'lucide-react';
import AddCandidateDialog from '@/components/dialogs/add-candidate-dialog';
import { BokStatsDrillDownDialog } from '@/components/dialogs/bok-stats-drill-down-dialog';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { OdbiorZakwaterowanieDialog } from '@/components/dialogs/odbior-zakwaterowanie-dialog';

const PASSPORT_HASH_QUICK = 'b8dc2c143be8994682b08461f46487e05874e59dd9ab65cf973e3a3c67a763aa';
const PASSPORT_HASH_FULL  = '52409f1bf23162b6ceff30dd11275fc9ee01897d7afca9cd09e95f05ef41d7e9';

async function hashInput(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const buf  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
    const [statusFilter, setStatusFilter] = useState<'all' | 'oczekujace' | 'nieudana' | 'zakwaterowanie' | 'zakwaterowana_oczekuje' | 'zakwaterowana_zatrudniona'>('all');
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [dialogStep, setDialogStep] = useState<'none' | 'confirm' | 'sure'>('none');
    const [targetDemand, setTargetDemand] = useState<CandidateDemand | null>(null);
    const [addCandidateOpen, setAddCandidateOpen] = useState(false);

    // Candidate detail dialog state
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

    const [finishCandidate, setFinishCandidate] = useState<Candidate | null>(null);
    const [zakwaterowanieDialogOpen, setZakwaterowanieDialogOpen] = useState(false);
    const [selectedZakwaterowanieEntry, setSelectedZakwaterowanieEntry] = useState<OdbiorEntry | null>(null);

    const [bokSearchQuery, setBokSearchQuery] = useState("");
    const [drillDownField, setDrillDownField] = useState<'hasPermit' | 'hasPesel' | null>(null);
    const [bokPassportVisible, setBokPassportVisible] = useState(false);
    const [passportDialogOpen, setPassportDialogOpen] = useState(false);
    const [passportInput, setPassportInput] = useState("");
    const [demandDialogOpen, setDemandDialogOpen] = useState(false);
    const [demandCandidate, setDemandCandidate] = useState<Candidate | null>(null);
    const [estimatedTime, setEstimatedTime] = useState("");
    const [pickupAddress, setPickupAddress] = useState("Brak adresu");
    const [demandRoomNumber, setDemandRoomNumber] = useState("");
    const [hasLuggage, setHasLuggage] = useState<boolean>(false);
    const [bokDemandLoadingIds, setBokDemandLoadingIds] = useState<Set<string>>(new Set());

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
            const result = await sendCandidateDemandNotificationAction(demandCandidate, estimatedTime, pickupAddress, demandRoomNumber || undefined, hasLuggage);
            if (result.success) {
                toast({ title: t("candidate.demandSent"), description: t("candidate.demandSentDesc", { count: result.sentCount }) });
                const updatedDemands = await getCandidateDemandsAction();
                setDemands(updatedDemands);
                setDemandDialogOpen(false);
                window.dispatchEvent(new Event('candidates-updated'));
                window.dispatchEvent(new Event('demands-updated'));
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
        setBokDemandLoadingIds(prev => new Set(prev).add(bokResident.id));
        try {
            // Reuse existing candidate for this BOK resident instead of creating duplicates
            const existing = candidates.find(c => c.bokId === bokResident.id);
            if (existing) {
                setDemandCandidate(existing);
                setEstimatedTime("");
                setDemandRoomNumber(bokResident.roomNumber || "");
                setPickupAddress(bokResident.address || "Brak adresu");
                setHasLuggage(false);
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
                setHasLuggage(false);
                setDemandDialogOpen(true);
            } else {
                toast({ variant: "destructive", title: t("common.error"), description: result.error || t('candidate.createError') });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("common.error"), description: String(err) });
        } finally {
            setBokDemandLoadingIds(prev => { const s = new Set(prev); s.delete(bokResident.id); return s; });
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

    // Poll every 5s + listen to cross-tab events for real-time sync
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
        }, 5000);
        return () => clearInterval(interval);
    }, [activeView]);

    useEffect(() => {
        const onUpdate = async () => {
            try {
                const updatedCandidates = await getCandidatesAction();
                setCandidates(updatedCandidates);
            } catch { /* ignore */ }
            try {
                const updated = await getCandidateDemandsAction();
                setDemands(updated);
            } catch { /* ignore */ }
        };
        window.addEventListener('candidates-updated', onUpdate);
        window.addEventListener('demands-updated', onUpdate);
        return () => {
            window.removeEventListener('candidates-updated', onUpdate);
            window.removeEventListener('demands-updated', onUpdate);
        };
    }, []);

    const handleRowClick = (candidate: Candidate) => {
        if (candidate.status === 'w_oczekiwaniu_na_zakwaterowanie') {
            const entry = contextOdbiorEntries?.find(e => e.convertedToBokId === candidate.bokId && e.type === 'zakwaterowanie');
            if (entry) {
                setSelectedZakwaterowanieEntry(entry);
            } else {
                setSelectedZakwaterowanieEntry(null);
            }
            setZakwaterowanieDialogOpen(true);
        } else {
            setSelectedCandidate(candidate);
        }
    };

    // Pre-filtered candidates (status + BOK dismissal filter, no search/status filter)
    const preFilteredCandidates = useMemo(() => {
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
        const dismissedBokNames = new Set(
            (allBokResidents || [])
                .filter(r => r.status === 'dismissed')
                .map(r => `${r.firstName.trim().toLowerCase()}|${r.lastName.trim().toLowerCase()}`)
        );
        return candidates
            .filter(c => c.status === 'nowy' || c.status === 'wdrodze' || c.status === 'zakwaterowana' || c.status === 'zakwaterowana_oczekuje_na_rozmowe' || c.status === 'po_rozmowie' || c.status === 'w_biurze' || c.status === 'w_oczekiwaniu_na_zakwaterowanie')
            .filter(c => {
                if (c.bokId && dismissedBokIds.has(c.bokId)) return false;
                if (c.sourceOdbiorId && dismissedSourceIds.has(c.sourceOdbiorId)) return false;
                if (c.status !== 'nowy' && c.status !== 'wdrodze') {
                    const nameKey = `${c.firstName.trim().toLowerCase()}|${c.lastName.trim().toLowerCase()}`;
                    if (dismissedBokNames.has(nameKey)) return false;
                }
                return true;
            });
    }, [candidates, allBokResidents, odbiorEntries]);

    const filteredCandidates = useMemo(() => {
        return preFilteredCandidates
            .filter(c => {
                if (statusFilter === 'nieudana') return c.status === 'po_rozmowie' && c.interviewOutcome === 'failed';
                if (statusFilter === 'zakwaterowanie') return c.status === 'w_oczekiwaniu_na_zakwaterowanie' && (c.interviewOutcome === 'do_zakwaterowania' || !c.interviewOutcome);
                if (statusFilter === 'zakwaterowana_oczekuje') return c.status === 'zakwaterowana_oczekuje_na_rozmowe';
                if (statusFilter === 'zakwaterowana_zatrudniona') return c.status === 'zakwaterowana';
                if (statusFilter === 'oczekujace') return ['nowy', 'wdrodze', 'w_biurze'].includes(c.status);
                return true;
            })
            .filter(c => c.lastName.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [preFilteredCandidates, searchQuery, statusFilter]);

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
        setHasLuggage(false);
        setDemandDialogOpen(true);
    };

    const handleFinishCandidate = (candidate: Candidate) => {
        setFinishCandidate(candidate);
    };

    const handleConfirmFinish = async (status: 'w_oczekiwaniu_na_zakwaterowanie' | 'po_rozmowie', outcome?: 'employed' | 'failed' | 'do_zakwaterowania') => {
        if (!finishCandidate) return;
        try {
            const result = await updateCandidateAction(finishCandidate.id, { status, interviewOutcome: outcome });
            if (result.success) {
                setCandidates(prev => prev.map(c => c.id === finishCandidate.id ? { ...c, status, interviewOutcome: outcome } : c));
                toast({ title: t('candidate.statusChanged'), description: `${finishCandidate.firstName} ${finishCandidate.lastName}` });
            } else {
                toast({ variant: 'destructive', title: t('common.error'), description: result.error });
            }
        } catch (err) {
            toast({ variant: 'destructive', title: t('common.error'), description: String(err) });
        } finally {
            setFinishCandidate(null);
        }
    };

    const demandStatusBadge = (demand?: CandidateDemand) => {
        if (!demand) return <span className="text-muted-foreground text-sm">—</span>;

        const details = (
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {(demand.pickupAddress && demand.pickupAddress !== "Brak adresu") ? (
                    <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {demand.pickupAddress} {demand.roomNumber ? `(${t('demand.room')}: ${demand.roomNumber})` : ''}
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
                        <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> {t("candidate.acknowledgedBy")}: <span className="font-medium">{demand.acknowledgedBy || '—'}</span></span>
                        <br />
                        {demand.acknowledgedAt ? format(new Date(demand.acknowledgedAt), "dd.MM.yyyy HH:mm", { locale: dateLocale }) : ''}
                        {details}
                    </div>
                );
            case 'delivered':
                return (
                    <div className="text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Truck className="w-3 h-3" /> {t("candidate.demandDelivered").replace('{name}', demand.acknowledgedBy || '—')}</span>
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

    const statusBadge = (candidate: Candidate) => {
        switch (candidate.status) {
            case "nowy":
                return <Badge variant="secondary">{t("candidate.statusNowy")}</Badge>;
            case "w_trakcie":
                return <Badge variant="default">{t("candidate.statusWTrakcie")}</Badge>;
            case "zakonczony":
                return <Badge variant="outline">{t("candidate.statusZakonczony")}</Badge>;
            case "zakwaterowana":
                return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">{t("candidate.statusZakwaterowana")}</Badge>;
            case "zakwaterowana_oczekuje_na_rozmowe":
                return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">{t("candidate.statusZakwaterowanaOczekujeNaRozmowe")}</Badge>;
            case "wdrodze":
                return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">{t("candidate.statusWdrodze")}</Badge>;
            case "w_biurze":
                return <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">{t("candidate.statusWBiurze")}</Badge>;
            case "w_oczekiwaniu_na_zakwaterowanie":
                return <Badge variant="default" className="bg-orange-500 text-white border-orange-500 hover:bg-orange-600">{t('candidate.statusOsobaDoZakwaterowania')}</Badge>;
            case "po_rozmowie":
                if (candidate.interviewOutcome === 'employed') return <Badge variant="default" className="bg-green-600 text-white border-green-600 hover:bg-green-700">{t('candidate.statusPoRozmoWieZatrudniony')}</Badge>;
                if (candidate.interviewOutcome === 'failed') return <Badge variant="default" className="bg-red-600 text-white border-red-600 hover:bg-red-700">{t('candidate.statusPoRozmoWieNieudana')}</Badge>;
                return <Badge variant="default" className="bg-gray-500 text-white border-gray-500 hover:bg-gray-600">{t('candidate.statusPoRozmowie')}</Badge>;
            default:
                return <Badge>{candidate.status}</Badge>;
        }
    };

    const rowBgClass = (status: Candidate["status"]) => {
        switch (status) {
            case "nowy":                           return "";
            case "wdrodze":                        return "bg-blue-50/60 hover:bg-blue-100/60 dark:bg-blue-950/30";
            case "w_biurze":                       return "bg-amber-50/70 hover:bg-amber-100/60 dark:bg-amber-950/30";
            case "zakwaterowana":                  return "bg-green-50/60 hover:bg-green-100/60 dark:bg-green-950/30";
            case "zakwaterowana_oczekuje_na_rozmowe": return "bg-green-50/60 hover:bg-green-100/60 dark:bg-green-950/30";
            case "po_rozmowie":                    return "bg-green-50/60 hover:bg-green-100/60 dark:bg-green-950/30";
            case "w_oczekiwaniu_na_zakwaterowanie":return "bg-orange-50/60 hover:bg-orange-100/60 dark:bg-orange-950/30";
            default:                               return "";
        }
    };



    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold tracking-tight">{t("nav.recruitment")}</h1>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-full sm:w-72">
                        <label htmlFor="candidate-search" className="sr-only">{t("candidate.searchBySurname")}</label>
                        <Input
                            id="candidate-search"
                            placeholder={t("candidate.searchBySurname")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Status filter buttons */}
            {(() => {
                const countAll = preFilteredCandidates.length;
                const countOczekujace = preFilteredCandidates.filter(c => ['nowy', 'wdrodze', 'w_biurze'].includes(c.status)).length;
                const countZakwaterowanie = preFilteredCandidates.filter(c => c.status === 'w_oczekiwaniu_na_zakwaterowanie' && (c.interviewOutcome === 'do_zakwaterowania' || !c.interviewOutcome)).length;
                const countZakwaterowanaOczekuje = preFilteredCandidates.filter(c => c.status === 'zakwaterowana_oczekuje_na_rozmowe').length;
                const countZakwaterowanaZatrudniona = preFilteredCandidates.filter(c => c.status === 'zakwaterowana').length;
                const countNieudani = preFilteredCandidates.filter(c => c.status === 'po_rozmowie' && c.interviewOutcome === 'failed').length;
                return (
                    <div className="flex flex-wrap justify-center gap-3 overflow-x-auto px-2 py-1.5">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 min-w-[120px] flex-1 sm:max-w-[200px] sm:shrink-0 transition-all font-semibold text-sm ${
                                statusFilter === 'all'
                                    ? 'border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]'
                                    : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                        >
                            <span className="text-2xl font-bold">{countAll}</span>
                            <span className="text-xs">{t('candidate.filterAll')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('oczekujace')}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 min-w-[120px] flex-1 sm:max-w-[200px] sm:shrink-0 transition-all font-semibold text-sm ${
                                statusFilter === 'oczekujace'
                                    ? 'border-orange-500 bg-orange-500 text-white shadow-md scale-[1.02]'
                                    : 'border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100'
                            }`}
                        >
                            <span className="text-2xl font-bold">{countOczekujace}</span>
                            <span className="text-xs">{t('candidate.filterPending')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('zakwaterowanie')}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 min-w-[120px] flex-1 sm:max-w-[200px] sm:shrink-0 transition-all font-semibold text-sm ${
                                statusFilter === 'zakwaterowanie'
                                    ? 'border-yellow-500 bg-yellow-500 text-white shadow-md scale-[1.02]'
                                    : 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                            }`}
                        >
                            <span className="text-2xl font-bold">{countZakwaterowanie}</span>
                            <span className="text-xs">{t('candidate.statusOsobaDoZakwaterowania')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('zakwaterowana_oczekuje')}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 min-w-[120px] flex-1 sm:max-w-[200px] sm:shrink-0 transition-all font-semibold text-sm ${
                                statusFilter === 'zakwaterowana_oczekuje'
                                    ? 'border-green-600 bg-green-600 text-white shadow-md scale-[1.02]'
                                    : 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                        >
                            <span className="text-2xl font-bold">{countZakwaterowanaOczekuje}</span>
                            <span className="text-xs">{t('candidate.filterZakwaterowanaOczekujeNaRozmowe')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('zakwaterowana_zatrudniona')}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 min-w-[120px] flex-1 sm:max-w-[200px] sm:shrink-0 transition-all font-semibold text-sm ${
                                statusFilter === 'zakwaterowana_zatrudniona'
                                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-md scale-[1.02]'
                                    : 'border-indigo-400 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            }`}
                        >
                            <span className="text-2xl font-bold">{countZakwaterowanaZatrudniona}</span>
                            <span className="text-xs">{t('candidate.filterZakwaterowanaZatrudniona')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('nieudana')}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 min-w-[120px] flex-1 sm:max-w-[200px] sm:shrink-0 transition-all font-semibold text-sm ${
                                statusFilter === 'nieudana'
                                    ? 'border-red-600 bg-red-600 text-white shadow-md scale-[1.02]'
                                    : 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100'
                            }`}
                        >
                            <span className="text-2xl font-bold">{countNieudani}</span>
                            <span className="text-xs">{t('candidate.filterNieudana')}</span>
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
                            <CardTitle>{t("candidate.tableTitle")}</CardTitle>
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
                                                    className={`cursor-pointer transition-colors ${rowBgClass(c.status)} ${!['po_rozmowie', 'zakwaterowana', 'zakwaterowana_oczekuje_na_rozmowe', 'dismissed'].includes(c.status) ? 'animate-blink-light-red' : ''}`}
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
                                                                    type="button"
                                                                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                                                    title={t('candidate.passportDialogTitle')}
                                                                    aria-label={t('candidate.passportDialogTitle')}
                                                                    onClick={(e) => { e.stopPropagation(); setPassportDialogOpen(true); }}
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                            );
                                                        })()}
                                                    </TableCell>
                                                    <TableCell>{statusBadge(c)}</TableCell>
                                                    <TableCell>
                                                        {c.createdAt
                                                            ? format(new Date(c.createdAt), "dd.MM.yyyy HH:mm", { locale: dateLocale })
                                                            : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {demandStatusBadge(demand)}
                                                    </TableCell>
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button size="sm" variant="ghost">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                    <span className="sr-only">Akcje</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                {(c.status === 'zakwaterowana' || c.status === 'zakwaterowana_oczekuje_na_rozmowe') && (
                                                                    <DropdownMenuItem onClick={() => handleCandidateDemand(c)}>
                                                                        {t("candidate.demandBtn")}
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuItem onClick={() => handleFinishCandidate(c)}>
                                                                    {t("candidate.finishBtn")}
                                                                </DropdownMenuItem>
                                                                {currentUser.isAdmin && (
                                                                    <DropdownMenuItem
                                                                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                                                        disabled={deletingId === c.id}
                                                                        onClick={() => handleDelete(c)}
                                                                    >
                                                                        {deletingId === c.id ? t("common.processing") : t("common.delete")}
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
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
                                        c.status === 'zakwaterowana_oczekuje_na_rozmowe'? 'border-l-green-400 bg-green-50/50 dark:bg-green-950/20' :
                                        c.status === 'po_rozmowie'  ? 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20' :
                                        'border-l-transparent'
                                    } ${!['po_rozmowie', 'zakwaterowana', 'zakwaterowana_oczekuje_na_rozmowe', 'dismissed'].includes(c.status) ? 'animate-blink-light-red' : ''}`}
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
                                                                type="button"
                                                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                                                title={t('candidate.passportDialogTitle')}
                                                                aria-label={t('candidate.passportDialogTitle')}
                                                                onClick={(e) => { e.stopPropagation(); setPassportDialogOpen(true); }}
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        );
                                                    })()}
                                                </p>
                                            </div>
                                            {statusBadge(c)}
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

                                        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button size="sm" variant="outline">
                                                        {t('col.actions')}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {(c.status === 'zakwaterowana' || c.status === 'zakwaterowana_oczekuje_na_rozmowe') && (
                                                        <DropdownMenuItem onClick={() => handleCandidateDemand(c)}>
                                                            {t("candidate.demandBtn")}
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={() => handleFinishCandidate(c)}>
                                                        {t("candidate.finishBtn")}
                                                    </DropdownMenuItem>
                                                    {currentUser.isAdmin && (
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                                            disabled={deletingId === c.id}
                                                            onClick={() => handleDelete(c)}
                                                        >
                                                            {deletingId === c.id ? t("common.processing") : t("common.delete")}
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
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
                        <CardTitle>{t('candidate.bokSearchTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <label htmlFor="bok-search" className="sr-only">{t('candidate.bokSearchPlaceholder')}</label>
                            <Input
                                id="bok-search"
                                placeholder={t('candidate.bokSearchPlaceholder')}
                                value={bokSearchQuery}
                                onChange={(e) => setBokSearchQuery(e.target.value)}
                                className="flex-1"
                            />
                        </div>
                        {(() => {
                            const query = bokSearchQuery.toLowerCase();
                            const activeBokResidents = allBokResidents.filter(r => r.status !== 'dismissed');

                            const filtered = query
                                ? activeBokResidents.filter(r =>
                                    (r.lastName?.toLowerCase() || '').includes(query) ||
                                    (r.firstName?.toLowerCase() || '').includes(query) ||
                                    `${r.lastName} ${r.firstName}`.toLowerCase().includes(query)
                                  )
                                : activeBokResidents.slice(0, 20);
                            const permitYesList = activeBokResidents.filter(r => r.hasPermit);
                            const permitNoList = activeBokResidents.filter(r => !r.hasPermit);
                            const peselYesList = activeBokResidents.filter(r => r.hasPesel);
                            const peselNoList = activeBokResidents.filter(r => !r.hasPesel);
                            const stats = {
                                permitYes: permitYesList.length,
                                permitNo: permitNoList.length,
                                peselYes: peselYesList.length,
                                peselNo: peselNoList.length,
                            };
                            return (
                                <>
                                    {/* Statistics panel */}
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <Card
                                            className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                                            onClick={() => setDrillDownField('hasPermit')}
                                        >
                                            <p className="text-xs text-muted-foreground mb-1">{t('stats.hasPermit')}</p>
                                            <div className="flex gap-3 text-sm">
                                                <span className="font-medium">{t('stats.yes')}: <span className="text-green-700">{stats.permitYes}</span></span>
                                                <span className="font-medium">{t('stats.no')}: <span className="text-red-600">{stats.permitNo}</span></span>
                                            </div>
                                        </Card>
                                        <Card
                                            className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                                            onClick={() => setDrillDownField('hasPesel')}
                                        >
                                            <p className="text-xs text-muted-foreground mb-1">{t('stats.hasPesel')}</p>
                                            <div className="flex gap-3 text-sm">
                                                <span className="font-medium">{t('stats.yes')}: <span className="text-green-700">{stats.peselYes}</span></span>
                                                <span className="font-medium">{t('stats.no')}: <span className="text-red-600">{stats.peselNo}</span></span>
                                            </div>
                                        </Card>
                                    </div>
                                    <BokStatsDrillDownDialog
                                        isOpen={drillDownField === 'hasPermit'}
                                        onOpenChange={(open) => { if (!open) setDrillDownField(null); }}
                                        title={t('stats.hasPermit')}
                                        yesLabel={t('stats.yes')}
                                        noLabel={t('stats.no')}
                                        yesList={permitYesList}
                                        noList={permitNoList}
                                    />
                                    <BokStatsDrillDownDialog
                                        isOpen={drillDownField === 'hasPesel'}
                                        onOpenChange={(open) => { if (!open) setDrillDownField(null); }}
                                        title={t('stats.hasPesel')}
                                        yesLabel={t('stats.yes')}
                                        noLabel={t('stats.no')}
                                        yesList={peselYesList}
                                        noList={peselNoList}
                                    />
                                    {/* Desktop table */}
                                    <div className="hidden sm:block">
                                        <ScrollArea className="h-[40vh]">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>{t('col.lastName')}</TableHead>
                                                        <TableHead>{t('col.firstName')}</TableHead>
                                                        <TableHead>{t('col.checkIn')}</TableHead>
                                                        <TableHead>{t('col.status')}</TableHead>
                                                        <TableHead>{t('col.passport')}</TableHead>
                                                        <TableHead>{t('col.hasPermit')}</TableHead>
                                                        <TableHead>{t('col.hasPesel')}</TableHead>
                                                        <TableHead className="w-[160px]">{t('col.actions')}</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filtered.map(r => (
                                                        <TableRow key={r.id} className={r.status === 'dismissed' ? 'opacity-50' : ''}>
                                                            <TableCell className="font-medium">{r.lastName}</TableCell>
                                                            <TableCell>{r.firstName}</TableCell>
                                                            <TableCell>{r.checkInDate ? format(new Date(r.checkInDate), 'dd.MM.yyyy') : '-'}</TableCell>
                                                            <TableCell>
                                                                {r.status === 'dismissed'
                                                                    ? <Badge variant="outline" className="text-xs text-muted-foreground">{t('common.dismissed')}</Badge>
                                                                    : <Badge variant="outline" className="text-xs text-green-700 border-green-300">{t('common.active')}</Badge>
                                                                }
                                                            </TableCell>
                                                            <TableCell>
                                                                {(() => {
                                                                    if (!r.passportNumber) return '-';
                                                                    if (bokPassportVisible) return r.passportNumber;
                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                                                            title={t('candidate.passportDialogTitle')}
                                                                            aria-label={t('candidate.passportDialogTitle')}
                                                                            onClick={(e) => { e.stopPropagation(); setPassportDialogOpen(true); }}
                                                                        >
                                                                            <Eye className="w-4 h-4" />
                                                                        </button>
                                                                    );
                                                                })()}
                                                            </TableCell>
                                                            <TableCell>{r.hasPermit ? t('common.yes') : t('common.no')}</TableCell>
                                                            <TableCell>{r.hasPesel ? t('common.yes') : t('common.no')}</TableCell>
                                                            <TableCell>
                                                                {r.status !== 'dismissed' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    disabled={bokDemandLoadingIds.has(r.id)}
                                                                    onClick={() => handleBokDemand(r)}
                                                                >
                                                                    {bokDemandLoadingIds.has(r.id) ? t("common.loading") : t("candidate.bokDemandBtn")}
                                                                </Button>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </div>
                                    {/* Mobile cards */}
                                    <div className="sm:hidden space-y-3">
                                        {filtered.map(r => (
                                            <Card key={r.id} className={`overflow-hidden ${r.status === 'dismissed' ? 'opacity-60' : ''}`}>
                                                <CardContent className="p-4 space-y-2">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <p className="font-semibold">{r.lastName} {r.firstName}</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {r.checkInDate ? format(new Date(r.checkInDate), 'dd.MM.yyyy') : '-'}
                                                            </p>
                                                        </div>
                                                        {r.status === 'dismissed'
                                                            ? <Badge variant="outline" className="text-xs text-muted-foreground">Zwolniony</Badge>
                                                            : <Badge variant="outline" className="text-xs text-green-700 border-green-300">Aktywny</Badge>
                                                        }
                                                    </div>
                                                    <div className="text-sm">
                                                        {(() => {
                                                            if (!r.passportNumber) return <span className="text-muted-foreground">{t('col.passport')}: -</span>;
                                                            if (bokPassportVisible) return <span className="font-mono">{r.passportNumber}</span>;
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                                                    title={t('candidate.passportDialogTitle')}
                                                                    aria-label={t('candidate.passportDialogTitle')}
                                                                    onClick={(e) => { e.stopPropagation(); setPassportDialogOpen(true); }}
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                    <span className="text-xs">{t('candidate.passportDialogTitle')}</span>
                                                                </button>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                        <div>{t('col.hasPermit')}: <span className="font-medium">{r.hasPermit ? t('common.yes') : t('common.no')}</span></div>
                                                        <div>{t('col.hasPesel')}: <span className="font-medium">{r.hasPesel ? t('common.yes') : t('common.no')}</span></div>
                                                    </div>
                                                    {r.status !== 'dismissed' && (
                                                    <div className="pt-1">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={bokDemandLoadingIds.has(r.id)}
                                                            onClick={() => handleBokDemand(r)}
                                                            className="w-full"
                                                        >
                                                            {bokDemandLoadingIds.has(r.id) ? t("common.loading") : t("candidate.bokDemandBtn")}
                                                        </Button>
                                                    </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </>
                            );
                        })()}
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
                                    <span>{t('candidate.passportShowPhoto')}</span>
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
                        <DialogTitle>{t('candidate.demandBtn')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="text-sm">
                            {t('candidate.demandDialogIntro')} <strong>{demandCandidate?.firstName} {demandCandidate?.lastName}</strong>
                        </div>
                        {/* Adres i pokój są pobierane automatycznie z BOK — ukryte w dialogu, widoczne w widoku Zapotrzebowań */}
                        <div className="space-y-2">
                            <p id="luggage-label" className="text-sm font-medium">{t('demand.hasLuggage')}</p>
                            <div className="flex gap-2" role="group" aria-labelledby="luggage-label">
                                <Button
                                    type="button"
                                    variant={hasLuggage ? 'default' : 'outline'}
                                    aria-pressed={hasLuggage}
                                    onClick={() => setHasLuggage(true)}
                                    className="flex-1"
                                >
                                    {t('demand.luggageYes')}
                                </Button>
                                <Button
                                    type="button"
                                    variant={!hasLuggage ? 'default' : 'outline'}
                                    aria-pressed={!hasLuggage}
                                    onClick={() => setHasLuggage(false)}
                                    className="flex-1"
                                >
                                    {t('demand.luggageNo')}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="demand-delivery-time" className="text-sm font-medium">{t('demand.deliveryTime')}</label>
                            <Input
                                id="demand-delivery-time"
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
            <AlertDialog open={dialogStep === 'confirm'} onOpenChange={(open) => { if (!open) { setDialogStep('none'); clearDemandParam(); } }}>
                <AlertDialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg">
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
            <AlertDialog open={dialogStep === 'sure'} onOpenChange={(open) => { if (!open) { setDialogStep('none'); clearDemandParam(); } }}>
                <AlertDialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg">
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
                <AlertDialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('candidate.passportDialogTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('candidate.passportDialogDesc')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <label htmlFor="passport-password" className="sr-only">{t('candidate.passportDialogPlaceholder')}</label>
                    <Input
                        id="passport-password"
                        type="password"
                        placeholder={t('candidate.passportDialogPlaceholder')}
                        value={passportInput}
                        onChange={(e) => setPassportInput(e.target.value)}
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                                const h = await hashInput(passportInput);
                                if (h === PASSPORT_HASH_QUICK) {
                                    setBokPassportVisible(true);
                                    setPassportDialogOpen(false);
                                    setPassportInput('');
                                    setTimeout(() => setBokPassportVisible(false), 5000);
                                } else {
                                    toast({ variant: "destructive", title: t('common.error'), description: t('candidate.passportDialogError') });
                                }
                            }
                        }}
                    />
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => { setPassportInput(""); setPassportDialogOpen(false); }}>
                            {t('common.cancel')}
                        </AlertDialogCancel>
                        <Button onClick={async () => {
                            const h = await hashInput(passportInput);
                            if (h === PASSPORT_HASH_FULL) {
                                setBokPassportVisible(true);
                                setPassportDialogOpen(false);
                                setPassportInput("");
                                toast({ title: t('common.success'), description: t('candidate.passportDialogSuccess') });
                            } else {
                                toast({ variant: "destructive", title: t('common.error'), description: t('candidate.passportDialogError') });
                            }
                        }}>{t('common.confirm')}</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Finish Candidate Dialog */}
            <AlertDialog open={!!finishCandidate} onOpenChange={(open) => { if (!open) setFinishCandidate(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('candidate.finishDialogTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('candidate.finishDialogDesc')} {finishCandidate?.firstName} {finishCandidate?.lastName}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-3 py-4">
                        <Button
                            variant="default"
                            disabled={finishCandidate?.status === 'zakwaterowana' || finishCandidate?.status === 'zakwaterowana_oczekuje_na_rozmowe'}
                            onClick={() => handleConfirmFinish('w_oczekiwaniu_na_zakwaterowanie', 'do_zakwaterowania')}
                        >
                            {t('candidate.statusOsobaDoZakwaterowania')}
                        </Button>
                        <Button
                            variant="outline"
                            className="border-blue-500 text-blue-700 hover:bg-blue-50"
                            disabled={finishCandidate?.status === 'zakwaterowana' || finishCandidate?.status === 'zakwaterowana_oczekuje_na_rozmowe'}
                            onClick={() => handleConfirmFinish('w_oczekiwaniu_na_zakwaterowanie', 'employed')}
                        >
                            {t('candidate.finishZatrudnionyDoZakwaterowania')}
                        </Button>
                        <Button
                            variant="outline"
                            className="border-green-500 text-green-700 hover:bg-green-50"
                            onClick={() => handleConfirmFinish('po_rozmowie', 'employed')}
                        >
                            {t('candidate.statusPoRozmoWieZatrudniony')}
                        </Button>
                        <Button
                            variant="outline"
                            className="border-red-500 text-red-700 hover:bg-red-50"
                            onClick={() => handleConfirmFinish('po_rozmowie', 'failed')}
                        >
                            {t('candidate.statusPoRozmoWieNieudana')}
                        </Button>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <OdbiorZakwaterowanieDialog
                isOpen={zakwaterowanieDialogOpen}
                onOpenChange={setZakwaterowanieDialogOpen}
                currentUser={currentUser}
                editEntry={selectedZakwaterowanieEntry}
            />

            <AddCandidateDialog
                open={addCandidateOpen}
                onOpenChange={setAddCandidateOpen}
                onSaved={(candidate) => {
                    setCandidates((prev) => [...prev, candidate]);
                    window.dispatchEvent(new Event('candidates-updated'));
                }}
            />
        </div>
    );
}
