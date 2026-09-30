import type { Metadata } from "next";
import Footer from "@/components/Footer";
import LegalPageContent from "@/components/LegalPageContent";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = { title: "Privacy Policy", description: "Robocode School privacy policy." };

export default function PrivacyPolicyPage() {
  return <><Navbar /><LegalPageContent kind="privacy" /><Footer /></>;
}
