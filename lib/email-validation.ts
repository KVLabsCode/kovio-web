// Work-email validation shared by the advertiser and OEM login forms.
// Pure/isomorphic. "Work email" = a real email that isn't a common free/personal
// provider. Enforced on sign-up/registration; sign-in only checks basic format so
// existing accounts (some on personal domains) are never locked out.

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com',
  'aol.com', 'aim.com',
  'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com', 'pm.me',
  'gmx.com', 'gmx.net', 'mail.com', 'zoho.com', 'yandex.com', 'yandex.ru',
  'hey.com', 'fastmail.com', 'tutanota.com',
  'qq.com', '163.com', '126.com', 'sina.com',
]);

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? '';
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isFreeEmail(email: string): boolean {
  return FREE_EMAIL_DOMAINS.has(emailDomain(email));
}

// Returns an error message if `email` isn't acceptable, or null if it's fine.
// Pass `requireWork` (true on sign-up) to also reject free/personal providers.
export function emailError(email: string, requireWork: boolean): string | null {
  if (!isValidEmail(email)) return 'Enter a valid email address.';
  if (requireWork && isFreeEmail(email)) {
    return 'Please use your work email — personal addresses (Gmail, Outlook, iCloud, etc.) aren’t accepted.';
  }
  return null;
}
