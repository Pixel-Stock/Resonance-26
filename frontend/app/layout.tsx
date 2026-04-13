import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Log-Sentinel — AI-Powered Security Log Analysis',
  description:
    'Real-time anomaly detection for system logs. Powered by Isolation Forest ML and Gemini AI. Detect brute force, impossible travel, privilege escalation, port scans, and data exfiltration instantly.',
  keywords: ['security', 'log analysis', 'anomaly detection', 'SIEM', 'cybersecurity', 'AI'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-mono bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
