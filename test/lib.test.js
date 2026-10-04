import { describe, expect, it } from 'vitest';
import { loadLib } from './harness.js';

const { fmt, progressWidth, stateLabel, stationLabel, ratingOf, actionOf } = loadLib();
const PlayerState = { PLAYING: 'PLAYING', PAUSED: 'PAUSED', BUFFERING: 'BUFFERING', IDLE: 'IDLE' };
const UserAction = { LIKE: 'LIKE', DISLIKE: 'DISLIKE', FOLLOW: 'FOLLOW' };

describe('fmt', () => {
  it('shows minutes and two-digit seconds', () => {
    expect(fmt(0)).toBe('0:00');
    expect(fmt(5)).toBe('0:05');
    expect(fmt(61)).toBe('1:01');
    expect(fmt(276)).toBe('4:36');
  });

  it('rounds down part seconds', () => {
    expect(fmt(59.9)).toBe('0:59');
  });

  it('keeps counting minutes past an hour', () => {
    expect(fmt(3600)).toBe('60:00');
    expect(fmt(3725)).toBe('62:05');
  });

  it('shows 0:00 for times it cannot show', () => {
    expect(fmt(-1)).toBe('0:00');
    expect(fmt(NaN)).toBe('0:00');
    expect(fmt(Infinity)).toBe('0:00');
    expect(fmt(undefined)).toBe('0:00');
  });
});

describe('progressWidth', () => {
  it('is the share of the song played', () => {
    expect(progressWidth(0, 200)).toBe('0%');
    expect(progressWidth(50, 200)).toBe('25%');
    expect(progressWidth(200, 200)).toBe('100%');
  });

  it('stops at 100% when the position runs past the duration', () => {
    expect(progressWidth(250, 200)).toBe('100%');
  });

  it('is empty without a duration', () => {
    expect(progressWidth(30, 0)).toBe('0');
    expect(progressWidth(30, undefined)).toBe('0');
    expect(progressWidth(30, NaN)).toBe('0');
  });
});

describe('stateLabel', () => {
  it('names the paused and loading states', () => {
    expect(stateLabel(PlayerState.PAUSED, PlayerState)).toBe('Paused');
    expect(stateLabel(PlayerState.BUFFERING, PlayerState)).toBe('Loading');
  });

  it('says nothing otherwise', () => {
    expect(stateLabel(PlayerState.PLAYING, PlayerState)).toBe('');
    expect(stateLabel(PlayerState.IDLE, PlayerState)).toBe('');
    expect(stateLabel(undefined, PlayerState)).toBe('');
  });
});

describe('stationLabel', () => {
  it('names the station when there is one', () => {
    expect(stationLabel('Rock Radio')).toBe('Now playing on Rock Radio');
    expect(stationLabel('')).toBe('Now playing');
    expect(stationLabel(undefined)).toBe('Now playing');
  });
});

describe('ratingOf and actionOf', () => {
  it('turn thumbs into ratings and back', () => {
    expect(ratingOf(UserAction.LIKE, UserAction)).toBe('up');
    expect(ratingOf(UserAction.DISLIKE, UserAction)).toBe('down');
    expect(actionOf('up', UserAction)).toBe(UserAction.LIKE);
    expect(actionOf('down', UserAction)).toBe(UserAction.DISLIKE);
  });

  it('ignore anything else', () => {
    expect(ratingOf(UserAction.FOLLOW, UserAction)).toBeNull();
    expect(ratingOf(undefined, UserAction)).toBeNull();
    expect(actionOf(null, UserAction)).toBeNull();
    expect(actionOf(undefined, UserAction)).toBeNull();
    expect(actionOf('sideways', UserAction)).toBeNull();
  });
});
