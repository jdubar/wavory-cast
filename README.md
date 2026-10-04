<img src=".github/wordmark.svg" alt="wavory-cast" height="80">

The Google Cast receiver for [Wavory](https://github.com/jdubar/wavory), personal radio on a Plex music library. When
the Wavory Android app casts a station to a Google Home, Nest Hub or Chromecast, the device loads this page: it plays
the songs straight from the Plex server and shows the Wavory now-playing screen.

It's published with GitHub Pages at https://jdubar.github.io/wavory-cast/, which is the receiver URL registered for
Wavory's app ID in the [Google Cast SDK Developer Console](https://cast.google.com/publish).

## Files

- `index.html`, `receiver.css`, `receiver.js`: the receiver, built on Google's Cast Application Framework (CAF).
- `lib.js`: the receiver's pure helpers (time and progress formatting, thumbs), kept out of `receiver.js` so they can
  be tested without the Cast SDK.
- `test/`: the tests. `harness.js` loads the page in jsdom against a fake of the Cast SDK.
- `wordmark.svg`, `mark.svg`: the Wavory logo, from the app's `Wordmark.tsx`.

## Working on it

Serve the folder over http and open `index.html?demo` (or `?demo=<cover URL>`) to see the now-playing screen with a
sample song. `?debug` turns on CAF's debug logging on a device.

`npm install`, then `npm test` runs the tests (Vitest and jsdom); `npx vitest run --coverage` adds coverage. They
check what the page does with the Cast SDK, not the SDK itself or the layout on a device, so try changes on a real
Chromecast or Nest Hub too.

Cast devices cache receivers, so a change can take a few minutes to show; restarting the device helps.
