import { describe, expect, test } from 'vitest';
import { diffAssignments, formatAssignmentChanges, formatReminder, parseAssignmentsIcs } from '../canvasWatch';

const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:event-assignment-1\r\nDTSTART;VALUE=DATE:20260911T000000\r\nSUMMARY:문단쓰기 [정보·컴퓨터교과논리및\r\n 논술 280305]\r\nURL:https://canvas.jejunu.ac.kr/calendar#assignment_1\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:event-calendar-2\r\nDTSTART;VALUE=DATE:20260912\r\nSUMMARY:일반 일정\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;

describe('Canvas ICS assignment parsing', () => {
  test('keeps only assignment events and unfolds lines', () => {
    expect(parseAssignmentsIcs(ics)).toEqual([{
      uid: 'event-assignment-1',
      title: '문단쓰기',
      course: '정보·컴퓨터교과논리및논술',
      dueDate: '2026-09-11',
      url: 'https://canvas.jejunu.ac.kr/calendar#assignment_1',
    }]);
  });
});

describe('assignment change detection', () => {
  const oldItem = { uid:'event-assignment-1', title:'과제 1', course:'운영체제', dueDate:'2026-09-11', url:'https://example.test/1' };
  test('detects new, changed, and future deletion', () => {
    const changes = diffAssignments(
      [oldItem, { ...oldItem, uid:'event-assignment-2', title:'삭제될 과제', dueDate:'2026-09-12' }],
      [{ ...oldItem, dueDate:'2026-09-13' }, { ...oldItem, uid:'event-assignment-3', title:'새 과제' }],
      '2026-09-08',
    );
    expect(changes.map(c => c.type)).toEqual(['changed', 'new', 'deleted']);
    expect(formatAssignmentChanges(changes)).toContain('2026-09-11 → 2026-09-13');
  });

  test('does not call an old disappeared assignment a deletion', () => {
    expect(diffAssignments([{ ...oldItem, dueDate:'2026-09-01' }], [], '2026-09-08')).toEqual([]);
  });
});

test('daily reminder is compact and uses D-day labels', () => {
  const message = formatReminder([
    { title:'오늘 과제', course:'소프트웨어공학', dueDate:'2026-09-08', url:'' },
    { title:'곧 과제', course:'운영체제', dueDate:'2026-09-11', url:'' },
  ], '2026-09-08');
  expect(message).toContain('D-DAY');
  expect(message).toContain('D-3');
  expect(message).toContain('[운영체제] 곧 과제');
});
