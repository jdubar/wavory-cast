'use strict';

/*
 * The receiver's pure helpers, kept apart from receiver.js so the tests can load them without the Cast SDK. A plain
 * script, like receiver.js: it puts them on window.WavoryLib. The Cast enums they need are passed in.
 */
(function () {
  /** Seconds as m:ss. */
  function fmt(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** The progress bar's CSS width. */
  function progressWidth(position, duration) {
    return duration > 0 ? `${Math.min(100, (position / duration) * 100)}%` : '0';
  }

  /** The word shown between the times: nothing while playing. */
  function stateLabel(state, PlayerState) {
    return state === PlayerState.PAUSED ? 'Paused' : state === PlayerState.BUFFERING ? 'Loading' : '';
  }

  function stationLabel(station) {
    return station ? `Now playing on ${station}` : 'Now playing';
  }

  /** A touch-controls thumb as the phone's rating ('up' or 'down'), or null. */
  function ratingOf(action, UserAction) {
    return action === UserAction.LIKE ? 'up' : action === UserAction.DISLIKE ? 'down' : null;
  }

  /** The phone's rating as the touch-controls thumb to light, or null. */
  function actionOf(rating, UserAction) {
    return rating === 'up' ? UserAction.LIKE : rating === 'down' ? UserAction.DISLIKE : null;
  }

  window.WavoryLib = { fmt, progressWidth, stateLabel, stationLabel, ratingOf, actionOf };
})();
