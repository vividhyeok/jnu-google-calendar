import type { Lecture } from './response';
import { mergeLectures, toReconstructedLectures } from './iCalConverter';

const ASIA_SEOUL = 'Asia/Seoul';

export type CalendarEventPayload = {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: typeof ASIA_SEOUL };
  end: { dateTime: string; timeZone: typeof ASIA_SEOUL };
  location?: string | null;
};

const toRfc3339 = (icalDate: string) =>
  `${icalDate.slice(0, 4)}-${icalDate.slice(4, 6)}-${icalDate.slice(6, 8)}T${icalDate.slice(9, 11)}:${icalDate.slice(11, 13)}:${icalDate.slice(13, 15)}+09:00`;

export function buildCalendarEvents(lectures: Lecture[]) {
  return mergeLectures(toReconstructedLectures(lectures)).map((lecture) => {
    const summary = `${lecture.name}${
      lecture.status !== '일반' ? ` - ${lecture.status}` : ''
    }`;
    const description = [
      `담당: ${lecture.lecturer}`,
      lecture.location ? `장소: ${lecture.location}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      summary,
      description,
      start: {
        dateTime: toRfc3339(lecture.startTime),
        timeZone: ASIA_SEOUL,
      },
      end: {
        dateTime: toRfc3339(lecture.endTime),
        timeZone: ASIA_SEOUL,
      },
      location: lecture.location ?? undefined,
    } satisfies CalendarEventPayload;
  });
}
