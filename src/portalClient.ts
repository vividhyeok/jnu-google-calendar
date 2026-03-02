import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';
import { Value } from '@sinclair/typebox/value';

import {
  END_YYYYMMDD,
  START_YYYYMMDD,
  password,
  username,
} from './env';
import { Lecture, ResponseTObject } from './response';
import { withRetry } from './retry';

const LOGIN_URL = 'https://portal.jejunu.ac.kr/login.htm';
const TIMETABLE_ENDPOINT =
  'https://portal.jejunu.ac.kr/api/patis/timeTable.jsp';

async function login(page: Page) {
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#userId');
  await page.waitForSelector('#userPswd');
  await page.type('#userId', username, { delay: 20 });
  await page.type('#userPswd', password, { delay: 20 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('[type="submit"]'),
  ]);

  if (page.url().includes('/login')) {
    throw new Error('Portal login failed. Check PORTAL_USERNAME/PASSWORD.');
  }
}

function isRetriablePortalError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network|socket|ECONNRESET|ECONNREFUSED|ETIMEDOUT|429|5\d\d/i.test(
    message
  );
}

export async function fetchPortalLectures(): Promise<Lecture[]> {
  return withRetry(
    async () => {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });

      try {
        const page = await browser.newPage();
        await login(page);

        const url = `${TIMETABLE_ENDPOINT}?sttLsnYmd=${START_YYYYMMDD}&endLsnYmd=${END_YYYYMMDD}`;
        const response = await page.goto(url, { waitUntil: 'networkidle2' });

        if (!response || !response.ok()) {
          throw new Error(
            `Failed to fetch timetable payload from the portal (${response?.status() ?? 'NO_RESPONSE'})`
          );
        }

        const text = await response.text();
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(
            'Portal timetable response was not valid JSON. Session may be expired.'
          );
        }

        const { classTables } = Value.Parse(ResponseTObject, json);
        return classTables;
      } finally {
        await browser.close();
      }
    },
    {
      retries: 2,
      delayMs: 2000,
      shouldRetry: isRetriablePortalError,
      onRetry(error, attempt, delayMs) {
        console.warn(
          `Portal fetch failed (attempt ${attempt}). Retrying in ${delayMs}ms...`,
          error
        );
      },
    }
  );
}
