import type { Metadata, Viewport } from "next";
import { Cairo, Orbitron, Poppins } from "next/font/google";
import { LanguageProvider } from "@/contexts/LanguageContext";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  preload: false,
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  preload: false,
});

// Arabic companion — loaded at build time, activated via CSS when locale = "ar"
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0B2341",
}

export const metadata: Metadata = {
  metadataBase: new URL("https://robocodeschool.com"),
  title: {
    default: "Robocode School | Future Tech Academy for Kids",
    template: "%s | Robocode School",
  },
  description:
    "Robocode School teaches kids AI, robotics, game development, and programming. Book a free online trial session today.",
  keywords: ["kids coding", "robotics for kids", "AI for children", "STEM education", "game development", "programming school"],
  openGraph: {
    type: "website",
    siteName: "Robocode School",
    title: "Robocode School | Future Tech Academy for Kids",
    description: "Robocode School teaches kids AI, robotics, game development, and programming. Book a free online trial session today.",
    images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: "Robocode School" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Robocode School | Future Tech Academy for Kids",
    description: "Robocode School teaches kids AI, robotics, game development, and programming.",
    images: ["/og-default.jpg"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${orbitron.variable} ${poppins.variable} ${cairo.variable} antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
