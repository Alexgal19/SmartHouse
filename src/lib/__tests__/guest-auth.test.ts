import { isValidGuestPassword } from '../guest-auth';

describe('isValidGuestPassword', () => {
  it('zwraca true gdy hasło zgadza się z sekretem', () => {
    expect(isValidGuestPassword('Sh21$', 'Sh21$')).toBe(true);
  });

  it('zwraca false gdy hasło jest błędne', () => {
    expect(isValidGuestPassword('zle', 'Sh21$')).toBe(false);
  });

  it('fail-closed: zwraca false gdy sekret nie jest ustawiony', () => {
    expect(isValidGuestPassword('Sh21$', undefined)).toBe(false);
    expect(isValidGuestPassword('', undefined)).toBe(false);
  });

  it('fail-closed: zwraca false gdy sekret jest pustym stringiem', () => {
    expect(isValidGuestPassword('', '')).toBe(false);
  });

  it('zwraca false gdy podane hasło jest puste', () => {
    expect(isValidGuestPassword('', 'Sh21$')).toBe(false);
  });
});
