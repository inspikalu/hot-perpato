import type { Metadata } from "next";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletProvider } from "@/components/WalletProvider";
import { WalletButton } from "@/components/WalletButton";

export const metadata: Metadata = {
  title: "Hot Perp | Trade or Burn",
  description: "Pass the leveraged perp before it explodes",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-pixel-black antialiased">
        <WalletProvider>
          <nav className="flex items-center justify-between px-6 py-3 border-b-2 border-pixel-grey bg-pixel-dark">
            <a href="/" className="font-pixel text-pixel-red text-xs sm:text-sm tracking-wide hover:text-pixel-orange transition-colors">
              HOT PERP
            </a>
            <div className="flex items-center gap-4">
              <div className="flex gap-4 text-[10px] sm:text-xs font-pixel text-pixel-grey">
                <a href="/leaderboard" className="hover:text-pixel-yellow transition-colors">SCORES</a>
                <a href="/achievements" className="hover:text-pixel-yellow transition-colors">BADGES</a>
              </div>
              <WalletButton />
            </div>
          </nav>
          <main className="flex flex-col flex-1 min-h-[calc(100vh-48px)]">
            {children}
          </main>
        </WalletProvider>
        <div className="pixel-overlay" aria-hidden="true" />
      </body>
    </html>
  );
}
