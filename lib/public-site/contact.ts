import { buildWhatsAppUrl } from "@/lib/contact-utils";

// Official academy contact; separate from student/parent contact records.
export const ACADEMY_PHONE = "01285864902";
export const ACADEMY_TEL_URL = `tel:${ACADEMY_PHONE}`;
export const ACADEMY_WHATSAPP_URL = buildWhatsAppUrl(ACADEMY_PHONE, null)!;
