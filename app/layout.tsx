import type { Metadata } from "next";
import { Orbitron, Poppins } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Robocode School | Future Tech Academy for Kids",
  description:
    "Robocode School teaches kids AI, robotics, game development, and programming. Book a free trial session today.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
className={`${orbitron.variable} ${poppins.variable} antialiased`}    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
