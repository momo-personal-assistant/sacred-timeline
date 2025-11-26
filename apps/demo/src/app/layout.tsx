import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Persistent Memory RAG Demo',
  description: 'Week 2: Embedding & Retrieval Layer',
};

// Force dynamic rendering (disable static generation)
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
