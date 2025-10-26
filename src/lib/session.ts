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

// This is where we specify the typings of the session object
declare module 'iron-session' {
  interface IronSessionData extends SessionData {}
}
