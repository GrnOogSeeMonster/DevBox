import './globals.css';
import React from 'react';

export const metadata = {
  title: 'DevBox Studio',
  description: 'Local browser IDE with sandboxed previews',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-200 min-h-screen">
        {children}
      </body>
    </html>
  );
}
