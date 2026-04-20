import { db } from '@/utils/db';
import type { ConnectorProviderId } from '@/modules/connectors/contracts';
import { decryptConnectorSecret, encryptConnectorSecret } from '@/modules/connectors/crypto';

type UpsertConnectedAccountInput = {
  userId: string;
  provider: ConnectorProviderId;
  externalAccountId: string;
  accountEmail?: string | null;
  accountName?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  idToken?: string | null;
  tokenType?: string | null;
  scopes?: string[];
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
};

export async function listConnectedAccounts(userId: string) {
  return db.connectedAccount.findMany({
    where: { userId },
    orderBy: [{ provider: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      provider: true,
      status: true,
      accountEmail: true,
      accountName: true,
      externalAccountId: true,
      scopes: true,
      expiresAt: true,
      lastSyncedAt: true,
      lastValidatedAt: true,
      lastErrorAt: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function upsertConnectedAccount(input: UpsertConnectedAccountInput) {
  const existing = await db.connectedAccount.findUnique({
    where: {
      userId_provider_externalAccountId: {
        userId: input.userId,
        provider: input.provider,
        externalAccountId: input.externalAccountId,
      },
    },
  });

  const accessTokenCiphertext = input.accessToken
    ? encryptConnectorSecret(input.accessToken)
    : (existing?.accessTokenCiphertext ?? null);
  const refreshTokenCiphertext = input.refreshToken
    ? encryptConnectorSecret(input.refreshToken)
    : (existing?.refreshTokenCiphertext ?? null);
  const idTokenCiphertext = input.idToken
    ? encryptConnectorSecret(input.idToken)
    : (existing?.idTokenCiphertext ?? null);

  return db.connectedAccount.upsert({
    where: {
      userId_provider_externalAccountId: {
        userId: input.userId,
        provider: input.provider,
        externalAccountId: input.externalAccountId,
      },
    },
    create: {
      userId: input.userId,
      provider: input.provider,
      externalAccountId: input.externalAccountId,
      accountEmail: input.accountEmail ?? null,
      accountName: input.accountName ?? null,
      accessTokenCiphertext,
      refreshTokenCiphertext,
      idTokenCiphertext,
      tokenType: input.tokenType ?? null,
      scopes: input.scopes ?? [],
      expiresAt: input.expiresAt ?? null,
      lastValidatedAt: new Date(),
      metadata: input.metadata ?? undefined,
    },
    update: {
      status: 'ACTIVE',
      accountEmail: input.accountEmail ?? null,
      accountName: input.accountName ?? null,
      accessTokenCiphertext,
      refreshTokenCiphertext,
      idTokenCiphertext,
      tokenType: input.tokenType ?? null,
      scopes: input.scopes ?? existing?.scopes ?? [],
      expiresAt: input.expiresAt ?? null,
      lastValidatedAt: new Date(),
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: input.metadata ?? undefined,
    },
    select: {
      id: true,
      provider: true,
      status: true,
      accountEmail: true,
      accountName: true,
      externalAccountId: true,
      scopes: true,
      expiresAt: true,
      lastValidatedAt: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getConnectedAccountTokens(connectedAccountId: string) {
  const account = await db.connectedAccount.findUnique({
    where: { id: connectedAccountId },
    select: {
      accessTokenCiphertext: true,
      refreshTokenCiphertext: true,
      idTokenCiphertext: true,
      expiresAt: true,
      tokenType: true,
      scopes: true,
    },
  });

  if (!account) return null;

  return {
    accessToken: account.accessTokenCiphertext ? decryptConnectorSecret(account.accessTokenCiphertext) : null,
    refreshToken: account.refreshTokenCiphertext ? decryptConnectorSecret(account.refreshTokenCiphertext) : null,
    idToken: account.idTokenCiphertext ? decryptConnectorSecret(account.idTokenCiphertext) : null,
    expiresAt: account.expiresAt,
    tokenType: account.tokenType,
    scopes: account.scopes,
  };
}

export function normalizePersonAlias(alias: string) {
  return alias.trim().toLowerCase().replace(/\s+/g, ' ');
}
