"use client";

import MainLayout from '@/components/main-layout';
import type { SessionData } from '@/types';

export default function ClientLayout({
  initialSession,
  children,
}: {
  initialSession: SessionData;
  children: React.ReactNode;
}) {
  return <MainLayout initialSession={initialSession}>{children}</MainLayout>;
}
