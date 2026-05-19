"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { SessionData, Candidate, CandidateDemand, InterviewResult } from "@/types";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCandidatesAction, sendCandidateDemandNotificationAction, getCandidateDemandsAction, deleteCandidateAction, acknowledgeCandidateDemandAction, recordInterviewResultAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useSearchParams, useRouter } from "next/navigation";
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
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [demands, setDemands] = useState<CandidateDemand[]>([]);
    const [loading, setLoading] = useState(true);
    const isFetchingRef = useRef(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [dialogStep, setDialogStep] = useState<'none' | 'confirm' | 'sure'>('none');
    const [targetDemand, setTargetDemand] = useState<CandidateDemand | null>(null);

    // Interview dialog state
    const [interviewCandidate, setInterviewCandidate] = useState<Candidate | null>(null);
    const [savingInterview, setSavingInterview] = useState(false);

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

    const handleDemand = async (candidate: Candidate, e: React.MouseEvent) => {
        e.stopPropagation();
        setSendingId(candidate.id);
        try {
            const result = await sendCandidateDemandNotificationAction(candidate);
            if (result.success) {
                toast({ title: t("candidate.demandSent"), description: t("candidate.demandSentDesc", { count: result.sentCount }) });
                const updatedDemands = await getCandidateDemandsAction();
                setDemands(updatedDemands);
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

    const loadData = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoading(true);
        try {
            const [candData, demandData] = await Promise.all([
                getCandidatesAction(),
                getCandidateDemandsAction(),
            ]);
            setCandidates(candData);
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
        if (activeView === 'recruitment') {
            loadData();
        }
    }, [activeView, loadData]);

    // Poll demands every 30s so status updates without page refresh
    useEffect(() => {
        if (activeView !== 'recruitment') return;
        const interval = setInterval(async () => {
            try {
                const updated = await getCandidateDemandsAction();
                setDemands(updated);
            } catch { /* ignore background poll errors */ }
        }, 30000);
        return () => clearInterval(interval);
    }, [activeView]);

    // Interview result handlers
    const handleRowClick = (candidate: Candidate) => {
        setInterviewCandidate(candidate);
    };

    const handleInterviewResult = async (result: 'success' | 'failure') => {
        if (!interviewCandidate) return;
        setSavingInterview(true);
        try {
            const res = await recordInterviewResultAction(interviewCandidate.id, result);
            if (res.success && res.entry) {
                setCandidates(prev => prev.map(c =>
                    c.id === interviewCandidate.id
                        ? { ...c, interviewHistory: [...(c.interviewHistory || []), res.entry!] }
                        : c
                ));
                setInterviewCandidate(prev => prev
                    ? { ...prev, interviewHistory: [...(prev.interviewHistory || []), res.entry!] }
                    : prev
                );
                toast({ title: t("candidate.interviewSaved") });
            } else {
                toast({ variant: "destructive", title: t("common.error"), description: res.error || t("candidate.interviewSaveError") });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("common.error"), description: String(err) });
        } finally {
            setSavingInterview(false);
        }
    };

    const filteredCandidates = candidates.filter((c) =>
        c.lastName.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

    const demandStatusBadge = (demand?: CandidateDemand) => {
        if (!demand) return <span className="text-muted-foreground text-sm">—</span>;

        const recipients = demand.sentTo && demand.sentTo.length > 0 ? (
            <div className="text-xs text-muted-foreground mt-1">
                {t("candidate.sentTo")}: {demand.sentTo.join(', ')}
            </div>
        ) : null;

        switch (demand.status) {
            case 'pending':
                return (
                    <div>
                        <Badge variant="secondary">{t("candidate.pendingAck")}</Badge>
                        {recipients}
                    </div>
                );
            case 'acknowledged':
                return (
                    <div className="text-xs text-muted-foreground">
                        ✅ {t("candidate.acknowledgedBy")}: <span className="font-medium">{demand.acknowledgedBy || '—'}</span>
                        <br />
                        {demand.acknowledgedAt ? format(new Date(demand.acknowledgedAt), "dd.MM.yyyy HH:mm", { locale: dateLocale }) : ''}
                        {recipients}
                    </div>
                );
            case 'expired':
                return (
                    <div>
                        <Badge variant="destructive">{t("candidate.demandExpired")}</Badge>
                        {recipients}
                    </div>
                );
            default:
                return <div><Badge>{demand.status}</Badge>{recipients}</div>;
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
            default:
                return <Badge>{status}</Badge>;
        }
    };

    const interviewBadge = (history: InterviewResult[]) => {
        if (!history || history.length === 0) return <span className="text-muted-foreground text-sm">—</span>;
        const last = history[history.length - 1];
        return last.result === 'success'
            ? <span className="text-green-600 font-medium text-sm">✅ {t("candidate.interviewResultSuccess")}</span>
            : <span className="text-destructive font-medium text-sm">❌ {t("candidate.interviewResultFailure")}</span>;
    };

    const interviewHistoryForCandidate: InterviewResult[] = interviewCandidate?.interviewHistory || [];

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

            {loading ? (
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
                                            <TableHead>{t("candidate.demandStatus")}</TableHead>
                                            <TableHead>{t("candidate.interviewDialogTitle")}</TableHead>
                                            <TableHead className="w-[200px]">{t("col.actions")}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCandidates.map((c) => {
                                            const demand = demandMap.get(c.id);
                                            return (
                                                <TableRow
                                                    key={c.id}
                                                    className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => handleRowClick(c)}
                                                >
                                                    <TableCell className="font-medium">{c.lastName}</TableCell>
                                                    <TableCell>{c.firstName}</TableCell>
                                                    <TableCell>{c.passportNumber || "-"}</TableCell>
                                                    <TableCell>{statusBadge(c.status)}</TableCell>
                                                    <TableCell>
                                                        {c.createdAt
                                                            ? format(new Date(c.createdAt), "dd.MM.yyyy HH:mm", { locale: dateLocale })
                                                            : "-"}
                                                    </TableCell>
                                                    <TableCell>{demandStatusBadge(demand)}</TableCell>
                                                    <TableCell>{interviewBadge(c.interviewHistory)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={sendingId === c.id || demand?.status === 'pending'}
                                                                onClick={(e) => handleDemand(c, e)}
                                                            >
                                                                {sendingId === c.id ? t("common.processing") : t("candidate.demandBtn")}
                                                            </Button>
                                                            {currentUser.isAdmin && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    disabled={deletingId === c.id}
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
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
                                    className="overflow-hidden cursor-pointer active:opacity-80"
                                    onClick={() => handleRowClick(c)}
                                >
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-semibold text-base">{c.lastName} {c.firstName}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {c.passportNumber || "-"}
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

                                        <div className="border-t pt-3">
                                            <p className="text-xs text-muted-foreground mb-1">{t("candidate.demandStatus")}</p>
                                            {demandStatusBadge(demand)}
                                        </div>

                                        <div className="border-t pt-3 flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground">{t("candidate.interviewDialogTitle")}</p>
                                            {interviewBadge(c.interviewHistory)}
                                        </div>

                                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1"
                                                disabled={sendingId === c.id || demand?.status === 'pending'}
                                                onClick={(e) => handleDemand(c, e)}
                                            >
                                                {sendingId === c.id ? t("common.processing") : t("candidate.demandBtn")}
                                            </Button>
                                            {currentUser.isAdmin && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
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

            {/* Interview result dialog */}
            <Dialog open={!!interviewCandidate} onOpenChange={(open) => { if (!open) setInterviewCandidate(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {interviewCandidate?.lastName} {interviewCandidate?.firstName}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <p className="text-sm font-medium text-center">{t("candidate.interviewQuestion")}</p>
                        <div className="flex gap-3">
                            <Button
                                className="flex-1 h-14 text-base"
                                variant="default"
                                disabled={savingInterview}
                                onClick={() => handleInterviewResult('success')}
                            >
                                ✅ {t("candidate.interviewSuccess")}
                            </Button>
                            <Button
                                className="flex-1 h-14 text-base"
                                variant="destructive"
                                disabled={savingInterview}
                                onClick={() => handleInterviewResult('failure')}
                            >
                                ❌ {t("candidate.interviewFailure")}
                            </Button>
                        </div>

                        {/* History */}
                        <div className="border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">{t("candidate.interviewHistory")}</p>
                            {interviewHistoryForCandidate.length === 0 ? (
                                <p className="text-xs text-muted-foreground">{t("candidate.interviewNoHistory")}</p>
                            ) : (
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {[...interviewHistoryForCandidate].reverse().map((entry, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span>{entry.result === 'success' ? '✅' : '❌'}</span>
                                                <span className={entry.result === 'success' ? 'text-green-600 font-medium' : 'text-destructive font-medium'}>
                                                    {t(entry.result === 'success' ? 'candidate.interviewResultSuccess' : 'candidate.interviewResultFailure')}
                                                </span>
                                            </div>
                                            <div className="text-right text-muted-foreground">
                                                <div>{entry.recordedBy}</div>
                                                <div>{format(new Date(entry.recordedAt), "dd.MM.yyyy HH:mm", { locale: dateLocale })}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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
        </div>
    );
}
