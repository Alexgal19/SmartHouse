// The root layout is now in src/app/[locale]/layout.tsx
// This file is needed to wrap the entire application, including the 404 page.

import React from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
