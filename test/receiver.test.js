import { afterEach, describe, expect, it } from 'vitest';
import { loadReceiver } from './harness.js';

const NAMESPACE = 'urn:x-cast:com.toethumb.wavory';

const song = (qid, extra = {}) => ({
  contentId: `http://plex.test/stream/${qid}`,
  duration: 200,
  metadata: {
    title: `Song ${qid}`,
    artist: 'An Artist',
    albumName: 'An Album',
    images: [{ url: `http://plex.test/cover/${qid}.jpg` }],
  },
  customData: { qid, key: `/library/metadata/${qid}`, station: 'Rock Radio' },
  ...extra,
});

let page;
const load = (options) => (page = loadReceiver(options));
afterEach(() => page && page.close());

/** Starts a song the way CAF reports it: the media changes, then PLAYER_LOAD_COMPLETE. */
function play(media) {
  page.player.media = media;
  page.player.state = 'PLAYING';
  page.player.emit('PLAYER_LOAD_COMPLETE');
}

describe('startup', () => {
  it('starts the receiver with the commands, controls and namespace Wavory uses', () => {
    load();
    const { started } = page.context;
    expect(started).toBeTruthy();
    expect(started.supportedCommands).toBe(0b1111 | 0b1_0000 | 0b10_0000 | 0b100_0000);
    expect(started.skipPlayersLoad).toBe(true);
    expect(started.uiConfig.touchScreenOptimizedApp).toBe(true);
    expect(started.customNamespaces).toEqual({ [NAMESPACE]: 'json' });
    expect(page.buttons).toEqual({ SECONDARY_1: 'DISLIKE', PRIMARY_2: 'QUEUE_NEXT', SECONDARY_2: 'LIKE' });
    expect(page.player.mediaElement).toBe(page.$('audio'));
  });

  it('turns on debug logging only with ?debug', () => {
    load();
    expect(page.context.loggerLevel).toBeNull();
    page.close();
    load({ query: '?debug' });
    expect(page.context.loggerLevel).toBe('DEBUG');
  });

  it('shows the sample song with ?demo and does not start the receiver', () => {
    load({ query: '?demo' });
    expect(page.context.started).toBeNull();
    expect(page.document.body.classList.contains('idle')).toBe(false);
    expect(page.$('title').textContent).toBe('Bullet With Butterfly Wings');
    expect(page.$('station').textContent).toBe('Now playing on Rock Radio');
    expect(page.images).toHaveLength(0);
  });

  it('loads the cover given to ?demo', () => {
    load({ query: '?demo=http://example.test/cover.jpg' });
    expect(page.images.map((i) => i.src)).toEqual(['http://example.test/cover.jpg']);
  });
});

describe('touch layout', () => {
  const touch = () => page.document.body.classList.contains('touch');

  it('is off on a TV', () => {
    load({ capabilities: { touch_input_supported: false } });
    expect(touch()).toBe(false);
  });

  it('follows the device capability over the pointer', () => {
    load({ capabilities: { touch_input_supported: true } });
    expect(touch()).toBe(true);
    page.close();
    load({ capabilities: { touch_input_supported: false }, coarsePointer: true });
    expect(touch()).toBe(false);
  });

  it('falls back to the pointer when the device does not say', () => {
    load({ coarsePointer: true });
    expect(touch()).toBe(true);
  });

  it('is forced on by ?touch in a browser', () => {
    load({ query: '?touch' });
    expect(touch()).toBe(true);
  });

  it('is checked again once the receiver is ready', () => {
    const capabilities = {};
    load({ capabilities });
    expect(touch()).toBe(false);
    capabilities.touch_input_supported = true;
    page.context.emit('ready');
    expect(touch()).toBe(true);
  });
});

describe('now playing', () => {
  it('stays idle until there is a song', () => {
    load();
    page.player.emit('MEDIA_STATUS');
    expect(page.document.body.classList.contains('idle')).toBe(true);
  });

  it('shows the song, its station and its progress', () => {
    load();
    page.player.duration = 200;
    page.player.time = 50;
    play(song('q1'));
    expect(page.document.body.classList.contains('idle')).toBe(false);
    expect(page.$('title').textContent).toBe('Song q1');
    expect(page.$('artist').textContent).toBe('An Artist');
    expect(page.$('album').textContent).toBe('An Album');
    expect(page.$('station').textContent).toBe('Now playing on Rock Radio');
    expect(page.$('elapsed').textContent).toBe('0:50');
    expect(page.$('duration').textContent).toBe('3:20');
    expect(page.$('fill').style.width).toBe('25%');
    expect(page.$('state').textContent).toBe('');
  });

  it("falls back to the media's duration while the player has none", () => {
    load();
    page.player.duration = 0;
    play(song('q1', { duration: 125 }));
    expect(page.$('duration').textContent).toBe('2:05');
  });

  it('shows paused and loading', () => {
    load();
    play(song('q1'));
    page.player.state = 'PAUSED';
    page.player.emit('MEDIA_STATUS');
    expect(page.$('state').textContent).toBe('Paused');
    page.player.state = 'BUFFERING';
    page.player.emit('MEDIA_STATUS');
    expect(page.$('state').textContent).toBe('Loading');
  });

  it('copes with a song missing its metadata', () => {
    load();
    play({ contentId: 'x' });
    expect(page.$('title').textContent).toBe('');
    expect(page.$('station').textContent).toBe('Now playing');
    expect(page.images).toHaveLength(0);
  });

  it('goes back to idle when the queue ends', () => {
    load();
    play(song('q1'));
    page.player.media = null;
    page.player.emit('MEDIA_STATUS');
    expect(page.document.body.classList.contains('idle')).toBe(true);
  });
});

describe('cover', () => {
  it('shows the cover and backdrop once the image loads', () => {
    load();
    play(song('q1'));
    expect(page.images).toHaveLength(1);
    expect(page.$('cover').classList.contains('loaded')).toBe(false);
    page.images[0].onload();
    expect(page.$('cover').src).toBe('http://plex.test/cover/q1.jpg');
    expect(page.$('cover').classList.contains('loaded')).toBe(true);
    expect(page.$('backdrop').style.backgroundImage).toContain('http://plex.test/cover/q1.jpg');
  });

  it('loads each cover once, however often the screen refreshes', () => {
    load();
    play(song('q1'));
    page.player.emit('MEDIA_STATUS');
    page.player.emit('MEDIA_STATUS');
    expect(page.images).toHaveLength(1);
  });

  it('keeps the Wavory mark when the cover never loads', () => {
    load();
    play(song('q1'));
    expect(page.$('cover').classList.contains('loaded')).toBe(false);
    expect(page.$('cover').getAttribute('src')).toBeNull();
  });

  it('ignores a cover that loads after the song has moved on', () => {
    load();
    play(song('q1'));
    play(song('q2'));
    const [first, second] = page.images;
    second.onload();
    first.onload();
    expect(page.$('cover').src).toBe('http://plex.test/cover/q2.jpg');
    expect(page.$('backdrop').style.backgroundImage).toContain('q2.jpg');
  });

  it('clears the old cover when the next song has none', () => {
    load();
    play(song('q1'));
    page.images[0].onload();
    play(song('q2', { metadata: { title: 'No art' } }));
    expect(page.$('cover').classList.contains('loaded')).toBe(false);
    expect(page.$('backdrop').style.backgroundImage).toBe('');
  });
});

describe('thumbs', () => {
  const intercept = (userAction) => page.interceptors.USER_ACTION({ userAction });

  it('sends a touch-controls thumb to the phone and lets the request through', () => {
    load();
    play(song('q1'));
    const request = { userAction: 'LIKE' };
    expect(page.interceptors.USER_ACTION(request)).toBe(request);
    intercept('DISLIKE');
    expect(page.sent).toEqual([
      { namespace: NAMESPACE, senderId: undefined, data: { type: 'thumb', rating: 'up', qid: 'q1' } },
      { namespace: NAMESPACE, senderId: undefined, data: { type: 'thumb', rating: 'down', qid: 'q1' } },
    ]);
  });

  it('sends nothing without a song or for other actions', () => {
    load();
    intercept('LIKE');
    play(song('q1', { customData: {} }));
    intercept('LIKE');
    play(song('q2'));
    intercept('FOLLOW');
    expect(page.sent).toEqual([]);
  });

  it('lights the thumb the phone answers with for the playing song', () => {
    load();
    play(song('q1'));
    page.context.receive(NAMESPACE, { type: 'rating', qid: 'q1', rating: 'up' });
    expect(page.player.media.userActionStates.map((s) => s.userAction)).toEqual(['LIKE']);
    page.context.receive(NAMESPACE, { type: 'rating', qid: 'q1', rating: 'down' });
    expect(page.player.media.userActionStates.map((s) => s.userAction)).toEqual(['DISLIKE']);
  });

  it('turns the thumb off when the phone takes it off', () => {
    load();
    play(song('q1'));
    page.context.receive(NAMESPACE, { type: 'rating', qid: 'q1', rating: 'up' });
    page.context.receive(NAMESPACE, { type: 'rating', qid: 'q1', rating: null });
    expect(page.player.media.userActionStates).toEqual([]);
  });

  it('keeps a rating for a later song until that song plays', () => {
    load();
    play(song('q1'));
    page.context.receive(NAMESPACE, { type: 'rating', qid: 'q2', rating: 'down' });
    expect(page.player.media.userActionStates).toEqual([]);
    play(song('q2'));
    expect(page.player.media.userActionStates.map((s) => s.userAction)).toEqual(['DISLIKE']);
  });

  it('clears the thumb for an unrated song', () => {
    load();
    play(song('q1', { userActionStates: [{ userAction: 'LIKE' }] }));
    expect(page.player.media.userActionStates).toEqual([]);
  });

  it('ignores other messages and ratings without a song', () => {
    load();
    play(song('q1'));
    page.context.receive(NAMESPACE, { type: 'hello', qid: 'q1', rating: 'up' });
    page.context.receive(NAMESPACE, { type: 'rating', rating: 'up' });
    page.context.receive(NAMESPACE, undefined);
    expect(page.player.media.userActionStates).toEqual([]);
  });

  it('does not fail when the player refuses the update between songs', () => {
    load();
    play(song('q1'));
    page.player.setMediaInformation = () => {
      throw new Error('no media session');
    };
    expect(() => page.context.receive(NAMESPACE, { type: 'rating', qid: 'q1', rating: 'up' })).not.toThrow();
  });
});
