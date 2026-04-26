import { db } from '@/utils/db';

export type IntegrationProvider = 'google' | 'microsoft';
export type IntegrationFeature = 'calendar' | 'contacts' | 'tasks' | 'email';

export type ConnectedAccountSummary = {
  id: string;
  provider: IntegrationProvider;
  email: string | null;
  displayName: string | null;
  calendarConnectedAt: Date | null;
  contactsConnectedAt: Date | null;
  tasksConnectedAt: Date | null;
  emailConnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ConnectedAccountCredentials = ConnectedAccountSummary & {
  refreshToken: string | null;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
};

type UpsertConnectedAccountArgs = {
  userId: string;
  provider: IntegrationProvider;
  providerAccountId: string;
  email: string | null;
  displayName: string | null;
  scopes: string[];
  refreshToken: string | null;
  accessToken: string;
  accessTokenExpiresAt: Date;
  calendarConnectedAt?: Date | null;
  contactsConnectedAt?: Date | null;
  tasksConnectedAt?: Date | null;
  emailConnectedAt?: Date | null;
};

const featureConnectedField = {
  calendar: 'calendarConnectedAt',
  contacts: 'contactsConnectedAt',
  tasks: 'tasksConnectedAt',
  email: 'emailConnectedAt',
} as const satisfies Record<IntegrationFeature, keyof ConnectedAccountSummary>;

export async function upsertConnectedAccount(args: UpsertConnectedAccountArgs) {
  const connectedAt = new Date();
  return db.connectedAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: args.provider,
        providerAccountId: args.providerAccountId,
      },
    },
    create: {
      userId: args.userId,
      provider: args.provider,
      providerAccountId: args.providerAccountId,
      email: args.email,
      displayName: args.displayName,
      scopes: args.scopes,
      refreshToken: args.refreshToken,
      accessToken: args.accessToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      calendarConnectedAt: args.calendarConnectedAt ?? connectedAt,
      contactsConnectedAt: args.contactsConnectedAt ?? connectedAt,
      tasksConnectedAt: args.tasksConnectedAt ?? connectedAt,
      emailConnectedAt: args.emailConnectedAt ?? connectedAt,
    },
    update: {
      userId: args.userId,
      email: args.email,
      displayName: args.displayName,
      scopes: args.scopes,
      ...(args.refreshToken ? { refreshToken: args.refreshToken } : {}),
      accessToken: args.accessToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      calendarConnectedAt: args.calendarConnectedAt ?? connectedAt,
      contactsConnectedAt: args.contactsConnectedAt ?? connectedAt,
      tasksConnectedAt: args.tasksConnectedAt ?? connectedAt,
      emailConnectedAt: args.emailConnectedAt ?? connectedAt,
    },
  });
}

export async function getConnectedAccounts(userId: string): Promise<ConnectedAccountSummary[]> {
  return db.connectedAccount.findMany({
    where: { userId },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      provider: true,
      email: true,
      displayName: true,
      calendarConnectedAt: true,
      contactsConnectedAt: true,
      tasksConnectedAt: true,
      emailConnectedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  }) as Promise<ConnectedAccountSummary[]>;
}

export async function getConnectedAccountStatus(userId: string) {
  const accounts = await getConnectedAccounts(userId);
  return {
    accounts,
    calendarConnected: accounts.some((account) => account.calendarConnectedAt !== null),
    contactsConnected: accounts.some((account) => account.contactsConnectedAt !== null),
    tasksConnected: accounts.some((account) => account.tasksConnectedAt !== null),
    gmailConnected: accounts.some((account) => account.emailConnectedAt !== null),
  };
}

export async function getAccountsForFeature(
  userId: string,
  feature: IntegrationFeature,
  providers?: IntegrationProvider[],
): Promise<ConnectedAccountCredentials[]> {
  const field = featureConnectedField[feature];
  return db.connectedAccount.findMany({
    where: {
      userId,
      ...(providers ? { provider: { in: providers } } : {}),
      [field]: { not: null },
      refreshToken: { not: null },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      provider: true,
      email: true,
      displayName: true,
      refreshToken: true,
      accessToken: true,
      accessTokenExpiresAt: true,
      calendarConnectedAt: true,
      contactsConnectedAt: true,
      tasksConnectedAt: true,
      emailConnectedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  }) as Promise<ConnectedAccountCredentials[]>;
}

export async function getPrimaryAccountForFeature(
  userId: string,
  feature: IntegrationFeature,
  providers?: IntegrationProvider[],
) {
  const accounts = await getAccountsForFeature(userId, feature, providers);
  return accounts[0] ?? null;
}

export async function updateConnectedAccountAccessToken(accountId: string, accessToken: string, expiresAt: Date) {
  await db.connectedAccount.update({
    where: { id: accountId },
    data: {
      accessToken,
      accessTokenExpiresAt: expiresAt,
    },
  });
}
