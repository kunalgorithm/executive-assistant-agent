import type { ConnectorProviderDescriptor } from '@/modules/connectors/contracts';

export const connectorRegistry: ConnectorProviderDescriptor[] = [
  {
    provider: 'GOOGLE',
    displayName: 'Google',
    authStrategy: 'oauth2',
    domains: [
      {
        domain: 'CALENDAR',
        implementationStatus: 'SCAFFOLDED',
        capabilities: ['list', 'read', 'create', 'update', 'delete'],
      },
      { domain: 'CONTACTS', implementationStatus: 'SCAFFOLDED', capabilities: ['search', 'read', 'create', 'update'] },
      {
        domain: 'TASKS',
        implementationStatus: 'SCAFFOLDED',
        capabilities: ['list', 'read', 'create', 'update', 'complete'],
      },
    ],
  },
  {
    provider: 'MICROSOFT',
    displayName: 'Microsoft 365',
    authStrategy: 'oauth2',
    domains: [
      {
        domain: 'CALENDAR',
        implementationStatus: 'PLANNED',
        capabilities: ['list', 'read', 'create', 'update', 'delete'],
      },
      { domain: 'CONTACTS', implementationStatus: 'PLANNED', capabilities: ['search', 'read', 'create', 'update'] },
      {
        domain: 'TASKS',
        implementationStatus: 'PLANNED',
        capabilities: ['list', 'read', 'create', 'update', 'complete'],
      },
    ],
  },
  {
    provider: 'APPLE',
    displayName: 'Apple (native bridge)',
    authStrategy: 'native-bridge',
    domains: [
      {
        domain: 'CALENDAR',
        implementationStatus: 'PLANNED',
        capabilities: ['list', 'read', 'create', 'update', 'delete'],
      },
      { domain: 'CONTACTS', implementationStatus: 'PLANNED', capabilities: ['search', 'read', 'create', 'update'] },
      {
        domain: 'TASKS',
        implementationStatus: 'PLANNED',
        capabilities: ['list', 'read', 'create', 'update', 'complete'],
      },
    ],
  },
  {
    provider: 'CALDAV',
    displayName: 'CalDAV',
    authStrategy: 'standards-based',
    domains: [
      {
        domain: 'CALENDAR',
        implementationStatus: 'PLANNED',
        capabilities: ['list', 'read', 'create', 'update', 'delete', 'sync'],
      },
    ],
  },
  {
    provider: 'CARDDAV',
    displayName: 'CardDAV',
    authStrategy: 'standards-based',
    domains: [
      {
        domain: 'CONTACTS',
        implementationStatus: 'PLANNED',
        capabilities: ['search', 'read', 'create', 'update', 'sync'],
      },
    ],
  },
  {
    provider: 'TODOIST',
    displayName: 'Todoist',
    authStrategy: 'oauth2',
    domains: [
      {
        domain: 'TASKS',
        implementationStatus: 'PLANNED',
        capabilities: ['list', 'read', 'create', 'update', 'complete'],
      },
    ],
  },
];
