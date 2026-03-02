import crypto from 'node:crypto';

import type { Lecture } from './response';
import { buildCalendarEvents } from './googleEvents';
import {
  END_YYYYMMDD,
  GOOGLE_CALENDAR_ID,
  GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  START_YYYYMMDD,
} from './env';
import { withRetry } from './retry';

const GOOGLE_TOKEN_AUDIENCE = 'https://oauth2.googleapis.com/token';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

type AccessTokenState = { token: string; expiresAt: number } | null;
let accessToken: AccessTokenState = null;

class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
    readonly path: string
  ) {
    super(
      `Google Calendar API request failed (${status}) for ${path}: ${responseBody}`
    );
    this.name = 'GoogleApiError';
  }
}

const base64Url = (input: Buffer | string) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

async function getAccessToken() {
  if (accessToken && accessToken.expiresAt > Date.now() + 60_000)
    return accessToken.token;

  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    iss: GOOGLE_CLIENT_EMAIL,
    scope: CALENDAR_SCOPE,
    aud: GOOGLE_TOKEN_AUDIENCE,
    exp: iat + 3600,
    iat,
  } satisfies Record<string, unknown>;
  const header = { alg: 'RS256', typ: 'JWT' };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload)
  )}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'));
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const response = await fetch(GOOGLE_TOKEN_AUDIENCE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!response.ok)
    throw new Error(
      `Failed to issue Google access token: ${response.status} ${response.statusText}`
    );

  const json = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  accessToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };

  return accessToken.token;
}

async function googleRequest(path: string, init: RequestInit = {}) {
  return withRetry(
    async () => {
      const token = await getAccessToken();
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/${path}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(init.headers as Record<string, string> | undefined),
          },
        }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new GoogleApiError(response.status, body, path);
      }

      return response;
    },
    {
      retries: 2,
      delayMs: 1000,
      shouldRetry(error) {
        if (!(error instanceof GoogleApiError)) return false;
        return error.status === 429 || error.status >= 500;
      },
      onRetry(error, attempt, delayMs) {
        console.warn(
          `Google API request failed (attempt ${attempt}). Retrying in ${delayMs}ms...`,
          error
        );
      },
    }
  );
}

async function deleteEventsBetween(
  timeMin: string,
  timeMax: string
): Promise<number> {
  const calendarId = encodeURIComponent(GOOGLE_CALENDAR_ID);
  let deleted = 0;
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      maxResults: '2500',
      orderBy: 'startTime',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await googleRequest(
      `calendars/${calendarId}/events?${params.toString()}`
    );
    const body = (await response.json()) as {
      nextPageToken?: string;
      items?: { id?: string }[];
    };

    for (const event of body.items ?? []) {
      if (!event.id) continue;
      await googleRequest(
        `calendars/${calendarId}/events/${encodeURIComponent(event.id)}`,
        { method: 'DELETE' }
      );
      deleted += 1;
    }

    pageToken = body.nextPageToken;
  } while (pageToken);

  return deleted;
}

async function insertEvents(events: ReturnType<typeof buildCalendarEvents>) {
  const calendarId = encodeURIComponent(GOOGLE_CALENDAR_ID);
  for (const event of events) {
    await googleRequest(`calendars/${calendarId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        ...(event.location ? { location: event.location } : {}),
      }),
    });
  }
}

export async function syncGoogleCalendar(lectures: Lecture[]) {
  const events = buildCalendarEvents(lectures);
  const timeMin = `${START_YYYYMMDD.slice(0, 4)}-${START_YYYYMMDD.slice(4, 6)}-${START_YYYYMMDD.slice(6, 8)}T00:00:00+09:00`;
  const timeMax = `${END_YYYYMMDD.slice(0, 4)}-${END_YYYYMMDD.slice(4, 6)}-${END_YYYYMMDD.slice(6, 8)}T23:59:59+09:00`;

  const deleted = await deleteEventsBetween(timeMin, timeMax);
  if (events.length === 0) return { inserted: 0, deleted };
  await insertEvents(events);

  return { inserted: events.length, deleted };
}
