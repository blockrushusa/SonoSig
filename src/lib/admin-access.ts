export const BOOTSTRAP_ADMIN_EMAILS = ["brucedseymour@gmail.com"];

export function isBootstrapAdminEmail(email: string | null | undefined) {
  return Boolean(
    email &&
      BOOTSTRAP_ADMIN_EMAILS.includes(email.trim().toLowerCase()),
  );
}
