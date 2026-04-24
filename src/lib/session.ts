
// This file configures the iron-session library for session management.
// It defines session options.

import type { SessionOptions } from 'iron-session';

export const sessionOptions: SessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD as string,
  cookieName: 'smarthouse-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    httpOnly: true,
    maxAge: 8 * 60 * 60, // 8 godzin
  },
};

declare module 'iron-session' {
  interface IronSessionData {
    isLoggedIn: boolean;
    uid: string;
    name: string;
    isAdmin: boolean;
    isDriver: boolean;
    isRekrutacja: boolean;
  }
}
