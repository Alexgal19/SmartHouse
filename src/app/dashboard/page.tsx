
"use client"
import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardRootPage() {
  useEffect(() => {
    redirect('/pl/dashboard');
  }, []);

  return null;
}
