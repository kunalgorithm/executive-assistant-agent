export const connectorProviders = ['GOOGLE', 'MICROSOFT', 'APPLE', 'CALDAV', 'CARDDAV', 'TODOIST'] as const;
export type ConnectorProviderId = (typeof connectorProviders)[number];

export const connectorDomains = ['CALENDAR', 'CONTACTS', 'TASKS', 'EMAIL'] as const;
export type ConnectorDomainId = (typeof connectorDomains)[number];

export const connectorImplementationStatuses = ['SCAFFOLDED', 'PLANNED', 'READY'] as const;
export type ConnectorImplementationStatus = (typeof connectorImplementationStatuses)[number];

export type ConnectorCapability = 'list' | 'search' | 'read' | 'create' | 'update' | 'delete' | 'complete' | 'sync';

export type ConnectedAccountContext = {
  userId: string;
  connectedAccountId: string;
  provider: ConnectorProviderId;
  scopes: string[];
};

export type ConnectorDomainDescriptor = {
  domain: ConnectorDomainId;
  implementationStatus: ConnectorImplementationStatus;
  capabilities: ConnectorCapability[];
};

export type ConnectorProviderDescriptor = {
  provider: ConnectorProviderId;
  displayName: string;
  authStrategy: 'oauth2' | 'native-bridge' | 'standards-based' | 'api-token';
  domains: ConnectorDomainDescriptor[];
};
