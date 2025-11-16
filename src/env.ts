import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const requiredVariables = [
  'username',
  'password',
  'START_YYYYMMDD',
  'END_YYYYMMDD',
  'GOOGLE_CLIENT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_CALENDAR_ID',
] as const;

for (const key of requiredVariables) {
  if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
}

const ENABLE_S3_UPLOAD = process.env.ENABLE_S3_UPLOAD === 'true';
const SYNC_INTERVAL_HOURS = Number(process.env.SYNC_INTERVAL_HOURS ?? '0');

if (Number.isNaN(SYNC_INTERVAL_HOURS) || SYNC_INTERVAL_HOURS < 0)
  throw new Error('SYNC_INTERVAL_HOURS must be zero or a positive number');

const username = process.env.username!;
const password = process.env.password!;
const START_YYYYMMDD = process.env.START_YYYYMMDD!;
const END_YYYYMMDD = process.env.END_YYYYMMDD!;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL!;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY!;
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

if (
  ENABLE_S3_UPLOAD &&
  (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY)
)
  throw new Error('AWS credentials are required when ENABLE_S3_UPLOAD=true');

export {
  username,
  password,
  START_YYYYMMDD,
  END_YYYYMMDD,
  GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_CALENDAR_ID,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  ENABLE_S3_UPLOAD,
  SYNC_INTERVAL_HOURS,
};
