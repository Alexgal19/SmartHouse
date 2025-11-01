import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/app/globals.css'
import { Toaster } from '@/components/ui/toaster'
import { PWAInstaller } from '@/components/pwa-installer';


const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SmartHouse',
  description: 'Zarządzanie pracownikami i inspekcjami',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SmartHouse",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
       <head>
        <meta name="application-name" content="SmartHouse" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SmartHouse" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#FFFFFF" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
         <script
            dangerouslySetInnerHTML={{
              __html: `
                window.pwaInstallHandler = {};
                window.addEventListener('beforeinstallprompt', (e) => {
                  e.preventDefault();
                  window.pwaInstallHandler.event = e;
                  document.body.classList.add('install-ready');
                  window.dispatchEvent(new CustomEvent('pwa-install-ready'));
                });

                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').then(registration => {
                      console.log('SW registered: ', registration);
                    }).catch(registrationError => {
                      console.log('SW registration failed: ', registrationError);
                    });
                  });
                }
              `,
            }}
        />
      </head>
      <body className={inter.className}>
        <PWAInstaller>
            {children}
        </PWAInstaller>
        <Toaster />
      </body>
    </html>
  )
}
