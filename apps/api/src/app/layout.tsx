import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Unified Memory API',
  description: 'Unified memory system with vector storage',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
