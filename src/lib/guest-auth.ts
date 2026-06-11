/**
 * Czysty walidator hasła gościa — bez zależności, testowalny w izolacji.
 * Fail-closed: jeśli sekret nie jest ustawiony, logowanie gościa jest niemożliwe.
 */
export function isValidGuestPassword(input: string, secret: string | undefined): boolean {
  if (!secret) return false;       // brak sekretu → fail-closed
  if (input.length === 0) return false;
  return input === secret;
}
