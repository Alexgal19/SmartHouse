import React from 'react';

// This layout is necessary for the dashboard pages to be rendered correctly
// within the main application layout. It simply passes its children through.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
