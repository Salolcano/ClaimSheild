import "./globals.css";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import type { ReactNode } from "react";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--display" });
const body = Figtree({ subsets: ["latin"], variable: "--body" });

export const metadata = {
  title: "ClaimShield — cover that pays when the evidence says so",
  description: "Parametric cover on GenLayer. Validators read the evidence and settle claims on-chain.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en"><body className={`${display.variable} ${body.variable}`}>{children}</body></html>
  );
}
