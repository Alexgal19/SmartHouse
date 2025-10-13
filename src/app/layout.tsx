// This is the root layout component for your Next.js app.
// It's a great place to add global styles and layout components.
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
