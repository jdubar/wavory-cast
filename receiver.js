'use strict';

/*
 * Wavory's Cast receiver. The phone app (CastBridge.java) loads a queue of Plex streams, each with its title, artist,
 * album, cover and custom data { qid, key, station }, and keeps it topped up; this page plays them and shows what's
 * playing. The streams and covers come straight from the Plex server, usually over plain http on the home network.
 */

const context = cast.framework.CastReceiverContext.getInstance();
const player = context.getPlayerManager();
const { EventType } = cast.framework.events;
const { Command, PlayerState } = cast.framework.messages;
const $ = (id) => document.getElementById(id);

player.setMediaElement($('audio'));

let shownCover;

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function show(media) {
  document.body.classList.toggle('idle', !media);
  if (!media) return;
  const meta = media.metadata || {};
  $('title').textContent = meta.title || '';
  $('artist').textContent = meta.artist || '';
  $('album').textContent = meta.albumName || '';
  const station = media.customData && media.customData.station;
  $('station').textContent = station ? `Now playing on ${station}` : 'Now playing';
  setCover(meta.images && meta.images[0] && meta.images[0].url);
}

/** Swaps in once loaded; if it won't load, the Wavory mark stays. */
function setCover(url) {
  if (url === shownCover) return;
  shownCover = url;
  const img = $('cover');
  img.classList.remove('loaded');
  $('backdrop').style.backgroundImage = '';
  if (!url) return;
  const probe = new Image();
  probe.onload = () => {
    if (shownCover !== url) return;
    img.src = url;
    img.classList.add('loaded');
    $('backdrop').style.backgroundImage = `url("${url}")`;
  };
  probe.src = url;
}

function tick() {
  const media = player.getMediaInformation();
  show(media);
  if (!media) return;
  const position = player.getCurrentTimeSec();
  const duration = player.getDurationSec() || (media.duration ?? 0);
  $('elapsed').textContent = fmt(position);
  $('duration').textContent = fmt(duration);
  $('fill').style.width = duration > 0 ? `${Math.min(100, (position / duration) * 100)}%` : '0';
  const state = player.getPlayerState();
  $('state').textContent = state === PlayerState.PAUSED ? 'Paused' : state === PlayerState.BUFFERING ? 'Loading' : '';
}

const params = new URLSearchParams(location.search);
if (params.has('demo')) {
  // For working on the design in a browser: ?demo, or ?demo=<cover URL>.
  show({
    metadata: {
      title: 'Bullet With Butterfly Wings',
      artist: 'The Smashing Pumpkins',
      albumName: 'Mellon Collie and the Infinite Sadness',
      images: params.get('demo') ? [{ url: params.get('demo') }] : [],
    },
    customData: { station: 'Rock Radio' },
  });
  $('elapsed').textContent = '1:13';
  $('duration').textContent = '4:36';
  $('fill').style.width = '27%';
} else {
  player.addEventListener(EventType.PLAYER_LOAD_COMPLETE, tick);
  player.addEventListener(EventType.MEDIA_STATUS, tick);
  setInterval(tick, 500);

  if (params.has('debug')) context.setLoggerLevel(cast.framework.LoggerLevel.DEBUG);

  const options = new cast.framework.CastReceiverOptions();
  options.supportedCommands = Command.ALL_BASIC_MEDIA | Command.QUEUE_NEXT;
  // Plain audio files: no HLS, DASH or Smooth Streaming players to load.
  options.skipPlayersLoad = true;
  options.statusText = 'Wavory';
  context.start(options);
}
