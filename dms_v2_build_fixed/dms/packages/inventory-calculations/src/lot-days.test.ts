import {
  calendarDaysBetweenUtcYmd,
  computeLotDays,
  lotDaysColor,
  utcCalendarYmdFromDate,
} from './lot-days';

describe('lot days', () => {
  describe('calendarDaysBetweenUtcYmd', () => {
    it('returns 0 for same calendar day', () => {
      expect(calendarDaysBetweenUtcYmd('2025-01-01', '2025-01-01')).toBe(0);
    });

    it('counts inclusive calendar span as difference', () => {
      expect(calendarDaysBetweenUtcYmd('2025-01-01', '2025-01-02')).toBe(1);
      expect(calendarDaysBetweenUtcYmd('2025-01-01', '2025-02-01')).toBe(31);
    });

    it('never returns negative (clamps)', () => {
      expect(calendarDaysBetweenUtcYmd('2025-02-01', '2025-01-01')).toBe(0);
    });

    it('throws on invalid YYYY-MM-DD', () => {
      expect(() => calendarDaysBetweenUtcYmd('bad', '2025-01-01')).toThrow(/Invalid YYYY-MM-DD/);
      expect(() => calendarDaysBetweenUtcYmd('2025-01-01', 'not-a-date')).toThrow();
    });
  });

  describe('utcCalendarYmdFromDate', () => {
    it('uses UTC calendar fields', () => {
      const ref = new Date(Date.UTC(2025, 2, 21, 15, 30, 0));
      expect(utcCalendarYmdFromDate(ref)).toBe('2025-03-21');
    });
  });

  describe('computeLotDays', () => {
    const ref = new Date(Date.UTC(2025, 2, 21, 15, 30, 0));

    it('uses reference date when not sold', () => {
      expect(computeLotDays('2025-03-01', null, ref)).toBe(20);
    });

    it('treats whitespace-only dateSold as unsold', () => {
      expect(computeLotDays('2025-03-01', '   ', ref)).toBe(20);
    });

    it('uses sale date when sold', () => {
      expect(computeLotDays('2025-03-01', '2025-03-21', ref)).toBe(20);
    });

    it('zero days when purchased and sold same day', () => {
      expect(computeLotDays('2025-03-01', '2025-03-01', ref)).toBe(0);
    });
  });

  describe('lotDaysColor', () => {
    it('maps thresholds: green <30, yellow 30–60, red >60', () => {
      expect(lotDaysColor(0)).toBe('green');
      expect(lotDaysColor(29)).toBe('green');
      expect(lotDaysColor(30)).toBe('yellow');
      expect(lotDaysColor(60)).toBe('yellow');
      expect(lotDaysColor(61)).toBe('red');
    });
  });
});
