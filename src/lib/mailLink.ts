export function mailLink(
  email: { provider: "google" | "microsoft"; externalId: string; threadId?: string; webUrl?: string },
  googleAccount?: string | null,
) {
  if (email.provider === "google") {
    const id = email.threadId ?? email.externalId.replace(/^google:/, "");
    const account = googleAccount ? `?authuser=${encodeURIComponent(googleAccount)}` : "";
    return `https://mail.google.com/mail/u/${account}#all/${encodeURIComponent(id)}`;
  }
  if (email.webUrl?.startsWith("https://")) return email.webUrl;
  return `https://outlook.office.com/mail/deeplink/read/${encodeURIComponent(email.externalId.replace(/^microsoft:/, ""))}`;
}
