import { NextFunction, Request, Response, RequestHandler } from 'express';
import { ZodTypeAny, z } from 'zod';
import { Types } from 'mongoose';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Express 4 does not catch rejected promises; this wrapper forwards them to the error handler. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Validate data with zod; throws a 400 with the first readable message. */
export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issue = r.error.issues[0];
    const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
    throw new HttpError(400, `${path}${issue.message}`);
  }
  return r.data;
}

export function objectId(id: string, label = 'Item'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, `${label} not found`);
  return new Types.ObjectId(id);
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const paging = (q: Record<string, unknown>, defLimit = 20, maxLimit = 100) => {
  const page = Math.max(1, parseInt(String(q.page ?? '1'), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(q.limit ?? defLimit), 10) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
};
