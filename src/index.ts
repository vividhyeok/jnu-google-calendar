import puppeteer from 'puppeteer';
import { Value } from '@sinclair/typebox/value';

import { ResponseTObject } from './response';
import { iCalConverter } from './iCalConverter';
import { syncGoogleCalendar } from './googleCalendar';
import {
  username,
  password,
  START_YYYYMMDD,
  END_YYYYMMDD,
  ENABLE_S3_UPLOAD,
  SYNC_INTERVAL_HOURS,
} from './env';

const TIMETABLE_ENDPOINT = 'https://portal.jejunu.ac.kr/api/patis/timeTable.jsp';

async function fetchClassTables() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.goto('https://portal.jejunu.ac.kr/login.htm');
    await page.type('#userId', username);
    await page.type('#userPswd', password);
    await page.click('[type="submit"]');
    await page.waitForNavigation();

    const response = await page.goto(
      `${TIMETABLE_ENDPOINT}?sttLsnYmd=${START_YYYYMMDD}&endLsnYmd=${END_YYYYMMDD}`
    );

    if (!response?.ok()) throw new Error('Failed to fetch the data');

    const { classTables } = Value.Parse(ResponseTObject, await response.json());
    return classTables;
  } finally {
    await browser.close();
  }
}

async function syncOnce() {
  console.info(`[${new Date().toISOString()}] Fetching timetable...`);
  const classTables = await fetchClassTables();

  const { inserted, deleted } = await syncGoogleCalendar(classTables);
  console.info(
    `Google Calendar synced (inserted: ${inserted}, removed: ${deleted})`
  );

  if (ENABLE_S3_UPLOAD) {
    const { upload } = await import('./aws');
    await upload(iCalConverter(classTables));
    console.info('ICS feed uploaded to S3');
  }
}

async function run() {
  try {
    await syncOnce();
  } catch (error) {
    console.error('Failed to sync timetable', error);
  }

  if (SYNC_INTERVAL_HOURS > 0) {
    const interval = SYNC_INTERVAL_HOURS * 60 * 60 * 1000;
    setTimeout(run, interval);
  }
}

run();
