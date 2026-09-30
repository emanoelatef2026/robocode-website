import type { Metadata } from "next";
import Footer from "@/components/Footer";
import LegalPageContent from "@/components/LegalPageContent";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = { title: "Terms & Conditions", description: "Robocode School terms and conditions." };

export default function TermsAndConditionsPage() {
  return <><Navbar /><LegalPageContent kind="terms" /><Footer /></>;
}
