import { ReactNode } from 'react';

// Since the root layout already handles language and providers,
// this layout can be very simple.
export default function LocaleLayout({ 
  children
}: { 
  children: ReactNode;
}) {
  return children;
}
