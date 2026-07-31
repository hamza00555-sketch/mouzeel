import type { ReactNode } from 'react';
import './globals.css';

// The real <html>/<body> live in [locale]/layout so `lang` and `dir` can follow
// the active locale. Next still requires a root layout, so this one passes through.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
