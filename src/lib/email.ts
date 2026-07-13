/**
 * Phase 13d — transactional email (verification).
 *
 * This is a deliberately minimal, provider-agnostic seam. No email provider is
 * wired yet: if none is configured, we log and report `sent: false` rather than
 * failing signup. Wire a real provider (Resend/SES/etc.) here before going live
 * — the signup flow already calls this; only this function needs to change.
 */
export type SendResult = { sent: boolean };

export async function sendVerificationEmail(params: {
  to: string;
  orgName: string;
  verifyUrl: string;
}): Promise<SendResult> {
  const configured = !!process.env.EMAIL_PROVIDER_API_KEY;
  if (!configured) {
    console.warn(
      `[email] no provider configured — would send verification for ${params.orgName} to ${params.to}: ${params.verifyUrl}`
    );
    return { sent: false };
  }
  // TODO(13d-followup): call the real provider's API here.
  return { sent: true };
}
