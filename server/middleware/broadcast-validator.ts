/**
 * Middleware para validar que un broadcastId existe y está en estado válido.
 * Se aplica a endpoints SDK que reciben broadcastId como parámetro.
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export async function validateBroadcastId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const broadcastId = req.body?.broadcastId as string || req.query.broadcastId as string || req.query.matchId as string || req.params.broadcastId;

  if (!broadcastId) {
    return next();
  }

  try {
    const broadcast = await storage.getBroadcast(broadcastId);

    if (!broadcast) {
      return res.status(404).json({
        error: `Broadcast '${broadcastId}' not found`,
        broadcastId,
      });
    }

    if (broadcast.status === 'ended') {
      (req as any).broadcastEnded = true;
    }

    (req as any).broadcast = broadcast;

    next();
  } catch (error) {
    console.error('Error validating broadcast:', error);
    return res.status(500).json({ error: 'Error validating broadcast' });
  }
}
