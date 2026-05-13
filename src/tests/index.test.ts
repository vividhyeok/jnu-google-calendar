import { describe, expect, test } from 'vitest';

import cases from './testcases.json';
import { classTables } from './response.json';
import {
  formatToICalDate,
  iCalConverter,
  lectureToICalEvent,
  mergeLectures,
  parseLectureStatus,
  reconstructedLecture,
} from '../iCalConverter';
import { buildCalendarEvents } from '../googleEvents';

import fs from 'node:fs/promises';
import path from 'node:path';

describe('강의 데이터 처리하기', () => {
  test('강의 데이터 중 시간 정보 파싱하기', () => {
    // https://icalendar.org/iCalendar-RFC-5545/3-3-5-date-time.html

    expect(formatToICalDate('20211011', '09:00')).toBe('20211011T090000');
  });

  describe('보강인 경우', () => {
    const { input, expected } = cases.supplement;
    const parsedLectureStatus = parseLectureStatus(input);

    test('강의 상태 파싱하기', () => {
      expect(parsedLectureStatus).toBe(expected.status);
    });

    test('데이터 재구조화', () => {
      expect(reconstructedLecture(input, parsedLectureStatus)).toEqual(
        expected.reconstructed
      );
    });
  });
  describe('온라인인 경우', () => {
    const { input, expected } = cases.online;
    const parsedLectureStatus = parseLectureStatus(input);

    test('강의 상태 파싱하기', () => {
      expect(parsedLectureStatus).toBe(expected.status);
    });

    test('데이터 재구조화', () => {
      expect(reconstructedLecture(input, parsedLectureStatus)).toEqual(
        expected.reconstructed
      );
    });
  });
  describe('휴강인지 확인하기', () => {
    const { input, expected } = cases.absent;
    const parsedLectureStatus = parseLectureStatus(input);

    test('강의 상태 파싱하기', () => {
      expect(parsedLectureStatus).toBe(expected.status);
    });

    test('데이터 재구조화', () => {
      expect(reconstructedLecture(input, parsedLectureStatus)).toEqual(
        expected.reconstructed
      );
    });
  });

  test('연강: 보강 또는 온라인 정보가 있는 경우 유지되아야 함. 휴강인 경우에는 스킵', () => {
    const { input, expected } = cases.merge;

    const reconstructedLectures = input.map((lecture) => {
      const status = parseLectureStatus(lecture);
      return reconstructedLecture(lecture, status);
    });

    expect(mergeLectures(reconstructedLectures)).toEqual(expected);
  });

  test('동일 과목이라도 시간 간격이 크면 병합하지 않아야 함', () => {
    const base = cases.merge.input[0];
    const first = { ...base, bgngHr: '09:00', endHr: '09:50' };
    const second = { ...base, bgngHr: '13:00', endHr: '13:50' };

    const merged = mergeLectures(
      [first, second]
        .map((lecture) =>
          reconstructedLecture(lecture, parseLectureStatus(lecture))
        )
        .filter(
          (
            lecture
          ): lecture is Exclude<ReturnType<typeof reconstructedLecture>, null> =>
            lecture !== null
        )
    );

    expect(merged).toHaveLength(2);
  });

  test('구글 캘린더 이벤트로 변환', () => {
    const events = buildCalendarEvents([cases.online.input]);
    expect(events).toEqual([
      {
        sourceKey:
          '소프트웨어분석및설계|온라인(녹화)|김수균||20240909T100000|20240909T105000',
        summary: '소프트웨어분석및설계 - 온라인(녹화)',
        description: '담당: 김수균',
        start: {
          dateTime: '2024-09-09T10:00:00+09:00',
          timeZone: 'Asia/Seoul',
        },
        end: {
          dateTime: '2024-09-09T10:50:00+09:00',
          timeZone: 'Asia/Seoul',
        },
        location: undefined,
      },
    ]);
  });
});

describe('lectures to iCal event', () => {
  test('통합 테스트', async () => {
    const expected = await fs.readFile(path.join(__dirname, 'excepted.ics'), {
      encoding: 'utf8',
    });
    const normalize = (text: string) => text.replace(/\r\n/g, '\n');
    expect(normalize(iCalConverter(classTables))).toBe(normalize(expected));
  });
});
