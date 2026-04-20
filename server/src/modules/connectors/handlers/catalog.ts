import type { Request, Response } from 'express';

import { statusCodes } from '@/utils/http';
import { connectorRegistry } from '@/modules/connectors/registry';

export function handleConnectorCatalog(_req: Request, res: Response) {
  res.status(statusCodes.OK).json({
    data: connectorRegistry,
    errors: null,
  });
}
