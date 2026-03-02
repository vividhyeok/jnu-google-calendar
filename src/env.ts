import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const requiredVariables = [
  'START_YYYYMMDD',
  'END_YYYYMMDD',
  'GOOGLE_CLIENT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_CALENDAR_ID',
] as const;

for (const key of requiredVariables) {
  if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
}

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value;
  }
  return undefined;
}

function requireEnv(keys: string[], label = keys[0]) {
  const value = readEnv(...keys);
  if (!value) {
    throw new Error(
      `Missing environment variable: ${label} (accepted keys: ${keys.join(', ')})`
    );
  }
  return value;
}

function parseYyyymmdd(name: string, value: string) {
  if (!/^\d{8}$/.test(value)) {
    throw new Error(
      `${name} must be in YYYYMMDD format (e.g. 20260302), received "${value}"`
    );
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));

  const date = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValid) {
    throw new Error(`${name} is not a valid calendar date: "${value}"`);
  }

  return value;
}

const SYNC_INTERVAL_HOURS = Number(process.env.SYNC_INTERVAL_HOURS ?? '24');

if (Number.isNaN(SYNC_INTERVAL_HOURS) || SYNC_INTERVAL_HOURS < 0)
  throw new Error('SYNC_INTERVAL_HOURS must be zero or a positive number');

const username = requireEnv(['PORTAL_USERNAME', 'username'], 'PORTAL_USERNAME');
const password = requireEnv(['PORTAL_PASSWORD', 'password'], 'PORTAL_PASSWORD');
const START_YYYYMMDD = parseYyyymmdd(
  'START_YYYYMMDD',
  requireEnv(['START_YYYYMMDD'])
);
const END_YYYYMMDD = parseYyyymmdd(
  'END_YYYYMMDD',
  requireEnv(['END_YYYYMMDD'])
);

if (START_YYYYMMDD > END_YYYYMMDD) {
  throw new Error(
    `START_YYYYMMDD (${START_YYYYMMDD}) must be less than or equal to END_YYYYMMDD (${END_YYYYMMDD})`
  );
}

const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL!;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY!;
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;

export {
  username,
  password,
  START_YYYYMMDD,
  END_YYYYMMDD,
  GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_CALENDAR_ID,
  SYNC_INTERVAL_HOURS,
};
