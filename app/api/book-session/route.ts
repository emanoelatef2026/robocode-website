import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

interface BookingBody {
  name:   string;
  age:    string;
  school: string;
  phone:  string;
  phone2: string;
  day:    string;
  time:   string;
  notes:  string;
}

export async function POST(request: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const body: BookingBody = await request.json();

    // Server-side validation
    if (!body.name?.trim())  return validation("Student name is required.");
    if (!body.phone?.trim()) return validation("Phone number is required.");
    if (!body.day?.trim())   return validation("Preferred day is required.");
    if (!body.time?.trim())  return validation("Preferred time is required.");

    // 1. Save to Supabase
    const { error: dbError } = await getSupabaseAdmin()
      .from("trial_bookings")
      .insert({
        student_name:   body.name.trim(),
        age:            body.age ? Number(body.age) : null,
        school:         body.school?.trim()  || null,
        phone:          body.phone.trim(),
        another_phone:  body.phone2?.trim()  || null,
        preferred_day:  body.day.trim(),
        preferred_time: body.time.trim(),
        notes:          body.notes?.trim()   || null,
      });

    if (dbError) {
      console.error("[book-session] Supabase error:", dbError.message);
      return NextResponse.json(
        { error: "Failed to save booking. Please try again." },
        { status: 500 }
      );
    }

    // 2. Send email notification
    const submittedAt = new Date().toLocaleString("en-US", {
      timeZone:  "Africa/Cairo",
      dateStyle: "full",
      timeStyle: "short",
    });

    const { error: emailError } = await resend.emails.send({
      from:    "Robocode School <onboarding@resend.dev>",
      to:      ["emanoel.atef@gmail.com"],
      subject: `New Trial Session Booking — ${escape(body.name)} · Robocode School`,
      html:    buildEmail(body, submittedAt),
    });

    if (emailError) {
      // Booking is already saved — log the email failure but don't fail the request
      console.error("[book-session] Email error:", emailError);
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    console.error("[book-session] Unexpected error:", err);
    return NextResponse.json(
      { error: "Server error. Please try again." },
      { status: 500 }
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function validation(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string): string {
  if (!value) return "";
  return `
    <tr>
      <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
        <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8;">${label}</p>
        <p style="margin: 0; font-size: 15px; font-weight: 500; color: #0B132B; line-height: 1.5; white-space: pre-wrap;">${escape(value)}</p>
      </td>
    </tr>`;
}

function buildEmail(d: BookingBody, submittedAt: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>New Trial Session Booking</title>
</head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <tr>
          <td style="background:#0B132B;border-radius:16px 16px 0 0;padding:36px 40px 28px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.4);">Robocode School</p>
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">New Trial Session Booking</h1>
            <div style="height:2px;background:linear-gradient(90deg,#19C6F4,#F97316);border-radius:2px;"></div>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:32px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#F4F7FB;border-radius:12px;padding:20px 24px;">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Student</p>
                  <p style="margin:0;font-size:20px;font-weight:700;color:#0B132B;">${escape(d.name)}</p>
                  <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">Submitted ${submittedAt}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:8px 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td style="padding:20px 0 0;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="50%" style="padding-right:12px;">
                        <div style="background:rgba(25,198,244,0.08);border-radius:10px;padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#19C6F4;">Preferred Day</p>
                          <p style="margin:0;font-size:16px;font-weight:700;color:#0B132B;">${escape(d.day)}</p>
                        </div>
                      </td>
                      <td width="50%" style="padding-left:12px;">
                        <div style="background:rgba(249,115,22,0.08);border-radius:10px;padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#F97316;">Preferred Time</p>
                          <p style="margin:0;font-size:16px;font-weight:700;color:#0B132B;">${escape(d.time)}</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr><td style="padding-top:24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${row("Age", d.age ? `${d.age} years old` : "")}
                  ${row("School", d.school)}
                  ${row("Phone (Call & WhatsApp)", d.phone)}
                  ${row("Second Phone Number", d.phone2)}
                  ${row("Notes", d.notes)}
                </table>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#F4F7FB;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              Robocode School &nbsp;·&nbsp; Empowering future builders, one line of code at a time.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}
