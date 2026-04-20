export const googleIdentityScopes = ['openid', 'email', 'profile'] as const;

export const googleConnectorScopes = [
  ...googleIdentityScopes,
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/contacts.other.readonly',
  'https://www.googleapis.com/auth/tasks',
] as const;
