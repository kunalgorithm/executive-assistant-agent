import type { ConnectedAccountContext } from '@/modules/connectors/contracts';

export type ContactSummary = {
  externalId: string;
  displayName: string;
  givenName?: string | null;
  familyName?: string | null;
  emailAddresses: string[];
  phoneNumbers: string[];
};

export type CreateContactInput = {
  givenName?: string;
  familyName?: string;
  displayName?: string;
  emailAddresses?: string[];
  phoneNumbers?: string[];
};

export interface ContactsConnector {
  searchContacts(account: ConnectedAccountContext, query: string): Promise<ContactSummary[]>;
  createContact(account: ConnectedAccountContext, input: CreateContactInput): Promise<ContactSummary>;
}
