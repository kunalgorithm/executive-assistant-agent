import { z } from 'zod';
import type { Request, Response } from 'express';

import { getZodErrors } from '@/utils/error';
import { statusCodes } from '@/utils/http';
import { listConnectedAccounts } from '@/modules/connectors/service';

const listAccountsQuerySchema = z.object({
  userId: z.string().uuid(),
});

export async function handleListConnectedAccounts(req: Request, res: Response) {
  const { data, errors } = getZodErrors(listAccountsQuerySchema, req.query);

  if (errors || !data) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors });
    return;
  }

  const accounts = await listConnectedAccounts(data.userId);
  res.status(statusCodes.OK).json({ data: accounts, errors: null });
}
