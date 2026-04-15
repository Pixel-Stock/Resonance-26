import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Log-Sentinel",
  description: "AI-Powered Cybersecurity Anomaly Detection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col relative overflow-x-hidden bg-[#e5e1eb]">
        {/* Soft, pristine ambient background */}
        <div className="fixed inset-0 pointer-events-none -z-30 bg-gradient-to-br from-[#ebe6f2] via-[#e2e1ec] to-[#dedbeb]" />

        {/* Ambient light orbs creating the holographic bleed-through effect */}
        <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#bca3ff] rounded-full mix-blend-screen filter blur-[140px] opacity-[0.4] pointer-events-none -z-20" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#8ce0ff] rounded-full mix-blend-screen filter blur-[140px] opacity-[0.4] pointer-events-none -z-20" />
        <div className="fixed top-[40%] right-[20%] w-[40%] h-[40%] bg-[#ffb3c6] rounded-full mix-blend-screen filter blur-[140px] opacity-[0.3] pointer-events-none -z-20" />
        <div className="fixed bottom-[20%] left-[20%] w-[30%] h-[30%] bg-[#a2ffce] rounded-full mix-blend-screen filter blur-[140px] opacity-[0.2] pointer-events-none -z-20" />

        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
