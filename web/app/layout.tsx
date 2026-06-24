import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plexus — uncensored, private, decentralized AI inference',
  description:
    'Plexus is a DePIN AI inference network on BNB Chain. Crowd-owned GPUs, no logs, no filter. Run any model through an OpenAI-compatible API; earn $PLEX for the compute you contribute.',
  openGraph: {
    title: 'Plexus — uncensored, private, decentralized AI inference',
    description:
      'Crowd-owned GPUs, no logs, no filter. OpenAI-compatible API, settled on BNB Chain with $PLEX.',
    type: 'website',
  },
  metadataBase: new URL('https://plexus.vercel.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
