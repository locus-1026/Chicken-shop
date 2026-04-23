// Mock email + WhatsApp — just log to console for now.

export async function sendEmail(opts: { to: string; subject: string; body: string }) {
  console.log("[resend:mock]", JSON.stringify(opts, null, 2));
  return { id: "mock-" + Date.now() };
}

export async function sendWhatsApp(opts: { to: string; message: string }) {
  console.log("[whatsapp:mock]", opts.to, "—", opts.message);
  return { id: "wa-mock-" + Date.now() };
}

export async function notifyRoyaltyDue(outletCode: string, email: string, amount: number) {
  await sendEmail({
    to: email,
    subject: `[JI FAN WANG] Royalty statement ready for ${outletCode}`,
    body: `Your royalty + marketing fee of RM ${amount.toLocaleString()} is ready. Please settle by the 14th.`,
  });
}

export async function notifyContractExpiry(email: string, outletCode: string, daysLeft: number) {
  await sendEmail({
    to: email,
    subject: `[JI FAN WANG] Contract renewal reminder — ${daysLeft} days left`,
    body: `Your agreement for ${outletCode} expires in ${daysLeft} days. Please get in touch with HQ.`,
  });
}
