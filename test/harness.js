import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const path = (file) => fileURLToPath(new URL(`../${file}`, import.meta.url));
const read = (file) => readFileSync(path(file), 'utf8');

/** Runs one of the page's scripts in the window, under its own filename so coverage counts it. */
function run(dom, file) {
  vm.runInContext(read(file), dom.getInternalVMContext(), { filename: path(file) });
}

/**
 * Just enough of the Cast Application Framework for receiver.js, recording what the page does with it. The enum values
 * are made up; the receiver only compares them.
 */
export function fakeCast({ capabilities = {} } = {}) {
  const listeners = {};
  const playerListeners = {};
  const customListeners = {};
  const interceptors = {};
  const sent = [];
  const buttons = {};

  class UserActionState {
    constructor(userAction) {
      this.userAction = userAction;
    }
  }

  const player = {
    media: null,
    time: 0,
    duration: 0,
    state: 'IDLE',
    mediaElement: null,
    setMediaElement(element) {
      this.mediaElement = element;
    },
    setMediaInformation(media) {
      this.media = media;
    },
    addEventListener(type, fn) {
      (playerListeners[type] ||= []).push(fn);
    },
    getMediaInformation() {
      return this.media;
    },
    getCurrentTimeSec() {
      return this.time;
    },
    getDurationSec() {
      return this.duration;
    },
    getPlayerState() {
      return this.state;
    },
    setMessageInterceptor(type, fn) {
      interceptors[type] = fn;
    },
    /** Fires a player event, as CAF would. */
    emit(type, event = {}) {
      for (const fn of playerListeners[type] || []) fn(event);
    },
  };

  const context = {
    started: null,
    loggerLevel: null,
    getPlayerManager: () => player,
    getDeviceCapabilities: () => capabilities,
    setLoggerLevel(level) {
      this.loggerLevel = level;
    },
    sendCustomMessage(namespace, senderId, data) {
      sent.push({ namespace, senderId, data });
    },
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    addCustomMessageListener(namespace, fn) {
      (customListeners[namespace] ||= []).push(fn);
    },
    start(options) {
      this.started = options;
    },
    emit(type, event = {}) {
      for (const fn of listeners[type] || []) fn(event);
    },
    /** A message from the phone on a custom namespace. */
    receive(namespace, data) {
      for (const fn of customListeners[namespace] || []) fn({ data, senderId: 'phone' });
    },
  };

  const cast = {
    framework: {
      CastReceiverContext: { getInstance: () => context },
      CastReceiverOptions: class {},
      LoggerLevel: { DEBUG: 'DEBUG', NONE: 'NONE' },
      events: { EventType: { PLAYER_LOAD_COMPLETE: 'PLAYER_LOAD_COMPLETE', MEDIA_STATUS: 'MEDIA_STATUS' } },
      messages: {
        Command: { ALL_BASIC_MEDIA: 0b1111, QUEUE_NEXT: 0b1_0000, LIKE: 0b10_0000, DISLIKE: 0b100_0000 },
        MessageType: { USER_ACTION: 'USER_ACTION' },
        PlayerState: { IDLE: 'IDLE', PLAYING: 'PLAYING', PAUSED: 'PAUSED', BUFFERING: 'BUFFERING' },
        UserAction: { LIKE: 'LIKE', DISLIKE: 'DISLIKE', FOLLOW: 'FOLLOW' },
        UserActionState,
      },
      ui: {
        Controls: {
          getInstance: () => ({
            clearDefaultSlotAssignments() {
              for (const slot of Object.keys(buttons)) delete buttons[slot];
            },
            assignButton(slot, button) {
              buttons[slot] = button;
            },
          }),
        },
        ControlsButton: { LIKE: 'LIKE', DISLIKE: 'DISLIKE', QUEUE_NEXT: 'QUEUE_NEXT' },
        ControlsSlot: { SLOT_SECONDARY_1: 'SECONDARY_1', SLOT_PRIMARY_2: 'PRIMARY_2', SLOT_SECONDARY_2: 'SECONDARY_2' },
        UiConfig: class {},
      },
      system: {
        DeviceCapabilities: { TOUCH_INPUT_SUPPORTED: 'touch_input_supported' },
        EventType: { READY: 'ready' },
        MessageType: { JSON: 'json' },
      },
    },
  };

  return { cast, context, player, sent, buttons, interceptors };
}

/** lib.js's helpers, loaded into an empty window without the Cast SDK. */
export function loadLib() {
  const dom = new JSDOM('', { runScripts: 'outside-only' });
  run(dom, 'lib.js');
  return dom.window.WavoryLib;
}

/**
 * Loads index.html with lib.js and receiver.js run against a fake Cast SDK. `query` is the page's query string,
 * `coarsePointer` what matchMedia('(pointer: coarse)') answers. Images never load by themselves: `images` lists the
 * ones the page made, and a test calls `onload()` on one to finish it.
 */
export function loadReceiver({ query = '', capabilities, coarsePointer = false } = {}) {
  const fake = fakeCast({ capabilities });
  const dom = new JSDOM(read('index.html'), { url: `https://receiver.test/${query}`, runScripts: 'outside-only' });
  const { window } = dom;
  const images = [];
  window.cast = fake.cast;
  window.matchMedia = (q) => ({ matches: q === '(pointer: coarse)' && coarsePointer, media: q });
  window.Image = class {
    constructor() {
      this.onload = null;
      this.src = '';
      images.push(this);
    }
  };
  run(dom, 'lib.js');
  run(dom, 'receiver.js');
  const $ = (id) => window.document.getElementById(id);
  return { ...fake, window, document: window.document, $, images, close: () => window.close() };
}
