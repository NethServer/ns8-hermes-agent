//
// Copyright (C) 2023 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Browser stand-in for the Node `crypto` module. webpack 5 no longer ships
// Node polyfills and @nethserver/ns8-ui-lib bundles uuid's Node RNG, which only
// needs `randomBytes(16)` to return 16 random byte values.

export function randomBytes(size) {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export default { randomBytes };
