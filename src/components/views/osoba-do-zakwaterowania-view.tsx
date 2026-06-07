"use client";

import React, { useMemo, useState } from 'react';
import type { Candidate, SessionData } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { OdbiorZakwaterowanieDialog } from '@/components/dialogs/odbior-zakwaterowanie-dialog';
import { useMainLayout } from '@/components/layouts/main-layout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { updateCandidateAction } from '@/lib/actions';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface OsobaDoZakwaterowaniaViewProps {
    currentUser: SessionData;
}

export default function OsobaDoZakwaterowaniaView({ currentUser }: OsobaDoZakwaterowaniaViewProps) {
    const { allCandidates } = useMainLayout();
    const { t } = useLanguage();
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
    const [isZakwaterowanieOpen, setIsZakwaterowanieOpen] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [confirmCandidate, setConfirmCandidate] = useState<Candidate | null>(null);

    const handleAcceptClick = (e: React.MouseEvent, candidate: Candidate) => {
        e.stopPropagation();
        setConfirmCandidate(candidate);
    };

    const handleConfirmAccept = async () => {
        if (!confirmCandidate) return;
        const candidate = confirmCandidate;
        setConfirmCandidate(null);
        setLoadingId(candidate.id);
        try {
            const newStatus = candidate.interviewOutcome === 'employed'
                ? 'zakwaterowana'
                : 'zakwaterowana_oczekuje_na_rozmowe';

            await updateCandidateAction(candidate.id, {
                status: newStatus
            });
            toast.success(t('common.success') || "Zaakceptowano osobę do zakwaterowania");
            // Open BOK housing dialog immediately after acceptance
            setSelectedCandidate(candidate);
            setIsZakwaterowanieOpen(true);
        } catch (error) {
            console.error(error);
            toast.error(t('common.error') || "Wystąpił błąd");
        } finally {
            setLoadingId(null);
        }
    };

    const doZakwaterowania = useMemo(() => {
        return (allCandidates || []).filter(c => {
            // Show only candidates explicitly assigned for housing via outcome buttons
            const isDoZakwaterowania = c.interviewOutcome === 'do_zakwaterowania' &&
                ['w_oczekiwaniu_na_zakwaterowanie', 'zakwaterowana', 'zakwaterowana_oczekuje_na_rozmowe'].includes(c.status);
            const isEmployedDoZakwaterowania = c.interviewOutcome === 'employed' &&
                ['w_oczekiwaniu_na_zakwaterowanie', 'zakwaterowana', 'zakwaterowana_oczekuje_na_rozmowe'].includes(c.status);
            return isDoZakwaterowania || isEmployedDoZakwaterowania;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [allCandidates]);

    const handleCandidateClick = (candidate: Candidate) => {
        setSelectedCandidate(candidate);
        setIsZakwaterowanieOpen(true);
    };

    // The dialog state is managed explicitly by user actions (like saving or closing).
    // We no longer forcefully close it if the candidate disappears from the background list,
    // which prevents the bug where the dialog fails to open after clicking "Akceptuję".

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">Osoba do zakwaterowania</h2>
            <Card className="border-0 shadow-none bg-transparent">
                <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-250px)] sm:h-[calc(100vh-200px)]">
                        <div className="space-y-2">
                            {doZakwaterowania.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                                    {t('common.noData') || 'Brak osób do zakwaterowania.'}
                                </div>
                            ) : (
                                doZakwaterowania.map((candidate) => (
                                    <div
                                        key={candidate.id}
                                        onClick={() => handleCandidateClick(candidate)}
                                        className={`bg-card rounded-lg p-4 border border-border shadow-sm flex flex-col gap-2 relative overflow-hidden transition-colors hover:bg-accent/50 cursor-pointer ${
                                            candidate.interviewOutcome === 'employed'
                                                ? 'border-green-500/50 shadow-green-500/10'
                                                : 'border-red-500/50 shadow-red-500/10 bg-red-500/10'
                                        } ${candidate.status === 'zakwaterowana_oczekuje_na_rozmowe' ? 'animate-blink-light-red' : ''}`}
                                    >
                                        <div className="flex justify-between items-center gap-4">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                                                    {candidate.firstName} {candidate.lastName}
                                                    {candidate.interviewOutcome === 'employed' && (
                                                        <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full border border-green-200">
                                                            Zatrudniony do zakwaterowania
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-right shrink-0">
                                                <div className="flex flex-col text-right">
                                                    <div className="text-sm font-medium whitespace-nowrap">
                                                        {format(new Date(candidate.createdAt), 'dd.MM.yyyy')}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {format(new Date(candidate.createdAt), 'HH:mm')}
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    disabled={(candidate.status === 'zakwaterowana' || candidate.status === 'zakwaterowana_oczekuje_na_rozmowe') || loadingId === candidate.id}
                                                    onClick={(e) => handleAcceptClick(e, candidate)}
                                                >
                                                    {loadingId === candidate.id ? "Zapisywanie..." : "Akceptuję"}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Confirmation dialog for Accept */}
            <AlertDialog open={!!confirmCandidate} onOpenChange={(open) => { if (!open) setConfirmCandidate(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Potwierdzenie</AlertDialogTitle>
                        <AlertDialogDescription>
                            Czy na pewno chcesz zaakceptować {confirmCandidate?.firstName} {confirmCandidate?.lastName} do zakwaterowania?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setConfirmCandidate(null)}>Nie</AlertDialogCancel>
                        <Button onClick={handleConfirmAccept} disabled={loadingId === confirmCandidate?.id}>
                            {loadingId === confirmCandidate?.id ? "Zapisywanie..." : "Tak"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {isZakwaterowanieOpen && selectedCandidate && (
                <OdbiorZakwaterowanieDialog
                    isOpen={isZakwaterowanieOpen}
                    onOpenChange={setIsZakwaterowanieOpen}
                    currentUser={currentUser}
                    onSaved={async () => {
                        await updateCandidateAction(selectedCandidate.id, { interviewOutcome: null });
                        setIsZakwaterowanieOpen(false);
                        setSelectedCandidate(null);
                    }}
                    prefillData={{
                        firstName: selectedCandidate.firstName,
                        lastName: selectedCandidate.lastName,
                        passportNumber: selectedCandidate.passportNumber,
                        passportPhotoUrl: selectedCandidate.passportPhotoUrl
                    }}
                    sourceOdbiorId={selectedCandidate.sourceOdbiorId}
                    candidateId={selectedCandidate.id}
                />
            )}
        </div>
    );
}
