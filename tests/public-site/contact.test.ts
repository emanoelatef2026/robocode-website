import { describe, expect, it } from "vitest";
import { ACADEMY_PHONE, ACADEMY_TEL_URL, ACADEMY_WHATSAPP_URL } from "@/lib/public-site/contact";
import { buildWhatsAppUrl } from "@/lib/contact-utils";

describe("official academy contact", () => {
  it("uses the approved business phone for calls and WhatsApp", () => {
    expect(ACADEMY_PHONE).toBe("01285864902");
    expect(ACADEMY_TEL_URL).toBe("tel:01285864902");
    expect(ACADEMY_WHATSAPP_URL).toBe("https://wa.me/201285864902");
  });

  it("normalizes branch WhatsApp numbers without changing personal contacts", () => {
    expect(buildWhatsAppUrl("01285864902", null)).toBe(ACADEMY_WHATSAPP_URL);
    expect(buildWhatsAppUrl("01123456789", null)).toBe("https://wa.me/201123456789");
  });
});
