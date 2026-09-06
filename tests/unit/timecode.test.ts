import { describe, it, expect } from 'vitest';
import {
  msToTimecode,
  timecodeToMs,
  stepFrameTime,
  formatCompactDuration,
} from '../../src/utils/timecode';

describe('Timecode Conversions & Frame Stepping', () => {
  describe('msToTimecode', () => {
    it('formats 0 milliseconds to 00:00:00:00', () => {
      const tc = msToTimecode(0);
      expect(tc.formatted).toBe('00:00:00:00');
      expect(tc.hours).toBe(0);
      expect(tc.minutes).toBe(0);
      expect(tc.seconds).toBe(0);
      expect(tc.frames).toBe(0);
    });

    it('clamps negative milliseconds to 0', () => {
      const tc = msToTimecode(-500);
      expect(tc.formatted).toBe('00:00:00:00');
    });

    it('formats 1 second and fractional frames accurately at 30 FPS', () => {
      // 1000ms is exactly 1 second
      expect(msToTimecode(1000, 30).formatted).toBe('00:00:01:00');

      // 1500ms is 1 second and 15 frames (half of 30)
      const tc = msToTimecode(1500, 30);
      expect(tc.seconds).toBe(1);
      expect(tc.frames).toBe(15);
      expect(tc.formatted).toBe('00:00:01:15');
    });

    it('formats multi-minute and multi-hour evidence timestamps correctly', () => {
      // 1 hour, 23 minutes, 45 seconds, 500ms
      const ms = (1 * 3600 + 23 * 60 + 45) * 1000 + 500;
      const tc = msToTimecode(ms, 30);
      expect(tc.hours).toBe(1);
      expect(tc.minutes).toBe(23);
      expect(tc.seconds).toBe(45);
      expect(tc.frames).toBe(15);
      expect(tc.formatted).toBe('01:23:45:15');
    });

    it('supports custom frame rates (24, 25, 60 FPS)', () => {
      // 500ms at 24 FPS = 12 frames
      expect(msToTimecode(500, 24).frames).toBe(12);
      // 500ms at 60 FPS = 30 frames
      expect(msToTimecode(500, 60).frames).toBe(30);
      // 500ms at 25 FPS = 12.5 -> floor to 12
      expect(msToTimecode(500, 25).frames).toBe(12);
    });
  });

  describe('timecodeToMs', () => {
    it('converts standard timecode strings back to milliseconds', () => {
      expect(timecodeToMs('00:00:00:00', 30)).toBe(0);
      expect(timecodeToMs('00:00:01:00', 30)).toBe(1000);
      expect(timecodeToMs('00:00:01:15', 30)).toBe(1500);
      expect(timecodeToMs('01:00:00:00', 30)).toBe(3600000);
    });

    it('maintains roundtrip conversion identity ms -> timecode -> ms', () => {
      const originalMs = 45500;
      const tc = msToTimecode(originalMs, 30);
      const roundtripMs = timecodeToMs(tc.formatted, 30);
      expect(roundtripMs).toBe(originalMs);
    });

    it('throws descriptive error on malformed timecode inputs', () => {
      expect(() => timecodeToMs('00:00')).toThrow(/Invalid timecode format/);
      expect(() => timecodeToMs('00:00:00:invalid')).toThrow(/Invalid numeric values/);
    });
  });

  describe('stepFrameTime', () => {
    const durationMs = 10000; // 10 seconds

    it('steps forward exactly one frame (33.33ms at 30 FPS)', () => {
      const nextTime = stepFrameTime(0, 1, durationMs, 30);
      expect(nextTime).toBeCloseTo(33.33, 1);
    });

    it('steps backward exactly one frame', () => {
      const prevTime = stepFrameTime(1000, -1, durationMs, 30);
      expect(prevTime).toBeCloseTo(966.67, 1);
    });

    it('clamps to 0 when stepping backward at 0ms', () => {
      expect(stepFrameTime(0, -1, durationMs, 30)).toBe(0);
      expect(stepFrameTime(10, -5, durationMs, 30)).toBe(0);
    });

    it('clamps to durationMs when stepping forward past media end', () => {
      expect(stepFrameTime(10000, 1, durationMs, 30)).toBe(10000);
      expect(stepFrameTime(9980, 5, durationMs, 30)).toBe(10000);
    });

    it('prevents floating-point drift over 1,000 successive frame steps', () => {
      let t = 0;
      for (let i = 0; i < 300; i++) {
        t = stepFrameTime(t, 1, 100000, 30);
      }
      // 300 frames at 30 FPS must equal exactly 10,000 milliseconds
      expect(t).toBe(10000);
    });
  });

  describe('formatCompactDuration', () => {
    it('formats millisecond timestamps into MM:SS.s', () => {
      expect(formatCompactDuration(0)).toBe('00:00.0');
      expect(formatCompactDuration(65400)).toBe('01:05.4');
      expect(formatCompactDuration(3661500)).toBe('61:01.5');
    });
  });
});
