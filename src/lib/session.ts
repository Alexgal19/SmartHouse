
// This file configures the iron-session library for session management.
// It defines session options.

import type { IronSessionOptions } from 'iron-session';
import type { SessionData } from '@/types';

export const sessionOptions: IronSessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD as string,
  cookieName: 'smarthouse-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

declare module 'iron-session' {
  interface IronSessionData {
    isLoggedIn: boolean;
    uid: string;
    name: string;
    isAdmin: boolean;
  }
}
