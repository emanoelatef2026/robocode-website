"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Constants ────────────────────────────────────────────────────────────────

const DAYS = [
  "Saturday", "Sunday", "Monday",
  "Tuesday", "Wednesday", "Thursday",
];

function buildTimes(): string[] {
  const out: string[] = [];
  for (let total = 10 * 60; total <= 22 * 60; total += 30) {
    const h      = Math.floor(total / 60);
    const m      = total % 60;
    const period = h < 12 ? "AM" : "PM";
    const hour   = h === 12 ? 12 : h > 12 ? h - 12 : h;
    out.push(`${hour}:${m === 0 ? "00" : "30"} ${period}`);
  }
  return out; // 25 slots: 10:00 AM → 10:00 PM
}

const TIMES = buildTimes();

// ── Shared style tokens ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-[#0B132B]/[0.08] bg-white/60 px-4 py-4 text-sm text-[#0B132B] placeholder:text-slate-400 backdrop-blur-sm transition duration-200 focus:border-[#19C6F4] focus:outline-none focus:ring-2 focus:ring-[#19C6F4]/20 hover:border-[#0B132B]/[0.15]";

const labelCls =
  "mb-3 block text-[13px] font-semibold text-[#0B132B]/80";

const chipBase =
  "inline-flex min-h-[44px] items-center rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none";

const chipActive =
  "bg-[#19C6F4] text-white shadow-[0_0_14px_rgba(25,198,244,0.4)]";

const chipIdle =
  "border border-[#0B132B]/10 bg-white/60 text-[#0B132B]/60 hover:border-[#19C6F4]/40 hover:bg-[#19C6F4]/5 hover:text-[#0B132B]";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
  name:   string;
  age:    string;
  school: string;
  phone:  string;
  phone2: string;
  day:    string;
  time:   string;
  notes:  string;
}

const EMPTY: FormData = {
  name: "", age: "", school: "", phone: "",
  phone2: "", day: "", time: "", notes: "",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrialForm() {
  const [form,        setForm]        = useState<FormData>(EMPTY);
  const [loading,     setLoading]     = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [showErrors,  setShowErrors]  = useState(false);
  const [serverError, setServerError] = useState("");

  const set = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "day" || key === "time") setShowErrors(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => set(e.target.name as keyof FormData, e.target.value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.day || !form.time) {
      setShowErrors(true);
      return;
    }

    setLoading(true);
    setServerError("");

    try {
      const res  = await fetch("/api/book-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] as const }}
      className="relative w-full overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-2xl backdrop-blur-xl"
    >
      {/* Brand dual-tone accent bar */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-[#19C6F4] to-[#F97316]" />

      <div className="p-8 md:p-12">
        <AnimatePresence mode="wait">

          {/* ── SUCCESS ── */}
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center py-14 text-center"
            >
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#19C6F4]/10">
                <svg viewBox="0 0 24 24" fill="none" stroke="#19C6F4"
                  strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
                  className="h-9 w-9"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-[#0B132B]">
                You&apos;re all set!
              </h3>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
                We received your trial session request. Our team will reach out
                within 24 hours to confirm your booking.
              </p>

              <button
                onClick={() => { setSubmitted(false); setForm(EMPTY); setShowErrors(false); setServerError(""); }}
                className="mt-10 rounded-full border border-[#0B132B]/20 px-7 py-2.5 text-sm font-medium text-[#0B132B]/60 transition duration-200 hover:border-[#0B132B]/40 hover:text-[#0B132B]"
              >
                Book Another Session
              </button>
            </motion.div>

          ) : (

            /* ── FORM ── */
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleSubmit}
              noValidate
              className="space-y-7"
            >

              {/* Student Name */}
              <div>
                <label htmlFor="name" className={labelCls}>
                  Student Name <span className="text-[#19C6F4]">*</span>
                </label>
                <input id="name" name="name" type="text" required
                  placeholder="e.g. Ahmed Mohamed"
                  value={form.name} onChange={handleChange}
                  className={inputCls}
                />
              </div>

              {/* Age + School */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="age" className={labelCls}>
                    Age <span className="text-[#19C6F4]">*</span>
                  </label>
                  <input id="age" name="age" type="number" required
                    min={4} max={18} placeholder="e.g. 10"
                    value={form.age} onChange={handleChange}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="school" className={labelCls}>School</label>
                  <input id="school" name="school" type="text"
                    placeholder="e.g. Cairo International School"
                    value={form.school} onChange={handleChange}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Phone + Phone 2 */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="phone" className={labelCls}>
                    Phone (Call &amp; WhatsApp){" "}
                    <span className="text-[#19C6F4]">*</span>
                  </label>
                  <input id="phone" name="phone" type="tel" required
                    placeholder="e.g. 01012345678"
                    value={form.phone} onChange={handleChange}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="phone2" className={labelCls}>
                    Another Phone Number
                  </label>
                  <input id="phone2" name="phone2" type="tel"
                    placeholder="Optional"
                    value={form.phone2} onChange={handleChange}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* ── Preferred Day ── */}
              <div>
                <label className={labelCls}>
                  Preferred Day <span className="text-[#19C6F4]">*</span>
                </label>

                <div className="flex flex-wrap gap-2.5">
                  {DAYS.map((d) => (
                    <motion.button
                      key={d}
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => set("day", d)}
                      className={`${chipBase} ${form.day === d ? chipActive : chipIdle}`}
                    >
                      {d}
                    </motion.button>
                  ))}
                </div>

                {showErrors && !form.day && (
                  <p className="mt-2 text-xs font-medium text-rose-400">
                    Please select a preferred day.
                  </p>
                )}
              </div>

              {/* ── Preferred Time — select dropdown ── */}
              <div>
                <label htmlFor="time" className={labelCls}>
                  Preferred Time <span className="text-[#19C6F4]">*</span>
                </label>

                <div className="relative">
                  <select
                    id="time"
                    name="time"
                    value={form.time}
                    onChange={(e) => set("time", e.target.value)}
                    className="w-full appearance-none rounded-xl border border-[#0B132B]/[0.08] bg-white/60 px-4 py-4 pr-10 text-sm text-[#0B132B] backdrop-blur-sm transition duration-200 focus:border-[#19C6F4] focus:outline-none focus:ring-2 focus:ring-[#19C6F4]/20 hover:border-[#0B132B]/[0.15]"
                  >
                    <option value="" disabled>Select a preferred time...</option>
                    {TIMES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>

                  {/* Custom chevron */}
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#0B132B]/40">
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true">
                      <path
                        d="M1 1.5l5 5 5-5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                {showErrors && !form.time && (
                  <p className="mt-2 text-xs font-medium text-rose-400">
                    Please select a preferred time.
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className={labelCls}>Notes</label>
                <textarea id="notes" name="notes" rows={4}
                  placeholder="Any questions, special requirements, or additional information..."
                  value={form.notes} onChange={handleChange}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Server error */}
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-start gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-5 py-4 backdrop-blur-sm"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100">
                    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-rose-500">
                      <path d="M8 5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <p className="text-sm leading-relaxed text-rose-600">{serverError}</p>
                </motion.div>
              )}

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={loading ? {} : { scale: 1.01 }}
                whileTap={loading  ? {} : { scale: 0.99 }}
                className="flex w-full items-center justify-center gap-2.5 rounded-full bg-[#19C6F4] py-4 text-sm font-semibold text-white shadow-[0_0_24px_rgba(25,198,244,0.38)] transition duration-300 hover:shadow-[0_0_36px_rgba(25,198,244,0.55)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Booking your session...
                  </>
                ) : (
                  "Book Free Trial Session"
                )}
              </motion.button>

              <p className="text-center text-xs text-slate-500">
                Free session &middot; No commitment &middot; We&apos;ll confirm within 24 hrs
              </p>

            </motion.form>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}
