import type { Metadata } from "next";
import Footer from "@/components/Footer";
import LegalPageContent from "@/components/LegalPageContent";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = { title: "Refund Policy", description: "Robocode School refund policy." };

export default function RefundPolicyPage() {
  return <><Navbar /><LegalPageContent kind="refund" /><Footer /></>;
}
