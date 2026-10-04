'use strict';

/*
 * Wavory's Cast receiver. The phone app (CastBridge.java) loads a queue of Plex streams, each with its title, artist,
 * album, cover and custom data { qid, key, station }, and keeps it topped up; this page plays them and shows what's
 * playing. The streams and covers come straight from the Plex server, usually over plain http on the home network.
 *
 * On a touch display (Nest Hub) the Cast SDK draws its controls over this page when it's touched: thumbs down,
 * play/pause, skip, thumbs up. Thumbs are the station's, so they go to the phone on NAMESPACE as
 * { type: 'thumb', rating, qid }; the phone answers { type: 'rating', qid, rating }, which lights the thumb.
 */

const context = cast.framework.CastReceiverContext.getInstance();
const player = context.getPlayerManager();
const { EventType } = cast.framework.events;
const { Command, MessageType, PlayerState, UserAction, UserActionState } = cast.framework.messages;
const { Controls, ControlsButton, ControlsSlot } = cast.framework.ui;
const $ = (id) => document.getElementById(id);
const NAMESPACE = 'urn:x-cast:com.toethumb.wavory';
const { fmt, progressWidth, stateLabel, stationLabel, ratingOf, actionOf } = WavoryLib;

/** Thumbs by queue ID, as the phone last said. */
const ratings = new Map();
let shownCover;

function show(media) {
  document.body.classList.toggle('idle', !media);
  if (!media) return;
  const meta = media.metadata || {};
  $('title').textContent = meta.title || '';
  $('artist').textContent = meta.artist || '';
  $('album').textContent = meta.albumName || '';
  $('station').textContent = stationLabel(media.customData && media.customData.station);
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
  $('fill').style.width = progressWidth(position, duration);
  $('state').textContent = stateLabel(player.getPlayerState(), PlayerState);
}

function qidOf(media) {
  return media && media.customData ? media.customData.qid : undefined;
}

/** Lights the touch controls' thumb for the playing song. */
function showRating() {
  const media = player.getMediaInformation();
  const qid = qidOf(media);
  if (!qid) return;
  const action = actionOf(ratings.get(qid), UserAction);
  media.userActionStates = action ? [new UserActionState(action)] : [];
  try {
    player.setMediaInformation(media, true);
  } catch (e) {
    // Between songs: the next one's rating comes with it.
  }
}

const params = new URLSearchParams(location.search);

/** Leaves room for the touch controls (receiver.css). ?touch shows the layout in a browser. */
function markTouch() {
  let touch = params.has('touch') || matchMedia('(pointer: coarse)').matches;
  try {
    const caps = context.getDeviceCapabilities();
    if (caps && cast.framework.system.DeviceCapabilities.TOUCH_INPUT_SUPPORTED in caps) {
      touch = !!caps[cast.framework.system.DeviceCapabilities.TOUCH_INPUT_SUPPORTED];
    }
  } catch (e) {
    // not started yet
  }
  document.body.classList.toggle('touch', touch);
}
markTouch();

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
  player.setMediaElement($('audio'));
  player.addEventListener(EventType.PLAYER_LOAD_COMPLETE, () => {
    tick();
    showRating();
  });
  player.addEventListener(EventType.MEDIA_STATUS, tick);
  setInterval(tick, 500);

  if (params.has('debug')) context.setLoggerLevel(cast.framework.LoggerLevel.DEBUG);

  // The touch controls' thumbs: the phone decides (a second press takes the thumb off) and answers with the result.
  player.setMessageInterceptor(MessageType.USER_ACTION, (request) => {
    const qid = qidOf(player.getMediaInformation());
    const rating = ratingOf(request.userAction, UserAction);
    if (qid && rating) context.sendCustomMessage(NAMESPACE, undefined, { type: 'thumb', rating, qid });
    return request;
  });

  context.addEventListener(cast.framework.system.EventType.READY, markTouch);

  context.addCustomMessageListener(NAMESPACE, (event) => {
    const message = event.data || {};
    if (message.type === 'rating' && message.qid) {
      ratings.set(message.qid, message.rating || null);
      if (message.qid === qidOf(player.getMediaInformation())) showRating();
    }
  });

  const controls = Controls.getInstance();
  controls.clearDefaultSlotAssignments();
  controls.assignButton(ControlsSlot.SLOT_SECONDARY_1, ControlsButton.DISLIKE);
  controls.assignButton(ControlsSlot.SLOT_PRIMARY_2, ControlsButton.QUEUE_NEXT);
  controls.assignButton(ControlsSlot.SLOT_SECONDARY_2, ControlsButton.LIKE);

  const options = new cast.framework.CastReceiverOptions();
  options.supportedCommands = Command.ALL_BASIC_MEDIA | Command.QUEUE_NEXT | Command.LIKE | Command.DISLIKE;
  // Plain audio files: no HLS, DASH or Smooth Streaming players to load.
  options.skipPlayersLoad = true;
  options.statusText = 'Wavory';
  // This page shows what's playing, so a Nest Hub draws its controls over it instead of its own media screen.
  options.uiConfig = new cast.framework.ui.UiConfig();
  options.uiConfig.touchScreenOptimizedApp = true;
  options.customNamespaces = { [NAMESPACE]: cast.framework.system.MessageType.JSON };
  context.start(options);
}
