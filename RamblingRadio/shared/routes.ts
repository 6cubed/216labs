import { z } from 'zod';
import { insertSessionSchema, logs, sessions } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  sessions: {
    create: {
      method: 'POST' as const,
      path: '/api/sessions',
      input: z.object({
        seedInterests: z.string(),
      }),
      responses: {
        201: z.custom<typeof sessions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    next: {
      method: 'POST' as const,
      path: '/api/sessions/:id/next',
      input: z.object({
        count: z.number().optional(),
      }).optional(),
      responses: {
        200: z.object({
          sentences: z.array(z.object({
            logId: z.number(),
            content: z.string(),
          })),
        }),
        404: errorSchemas.notFound,
      },
    },
    feedback: {
      method: 'POST' as const,
      path: '/api/sessions/:id/feedback',
      input: z.object({
        logId: z.number(),
        feedback: z.enum(['up', 'down']),
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
      },
    },
  },
  tts: {
    generate: {
      method: 'POST' as const,
      path: '/api/tts',
      input: z.object({
        text: z.string(),
      }),
      responses: {
        200: z.any(), // Returns audio buffer/blob
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
