#!/usr/bin/env node
/**
 * Brand asset parity guard.
 *
 * The mobile app should feel like the web product before the first screen loads.
 * This verifies native launcher and launch assets keep the same TaskNebula mark
 * as the web PWA icon and keep platform-required sizes.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(mobileRoot, '..');
const failures = [];
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  failures.push(message);
}

function read(relativePath, base = mobileRoot) {
  return fs.readFileSync(path.join(base, relativePath));
}

function readText(relativePath, base = mobileRoot) {
  return fs.readFileSync(path.join(base, relativePath), 'utf8');
}

function parsePng(relativePath, base = mobileRoot) {
  const data = read(relativePath, base);
  if (!data.subarray(0, 8).equals(pngSignature)) {
    fail(`${relativePath} must be a PNG file.`);
    return null;
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];

  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString('ascii');
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      const bitDepth = chunk.readUInt8(8);
      colorType = chunk.readUInt8(9);
      const interlace = chunk.readUInt8(12);
      if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
        fail(`${relativePath} must be a non-interlaced 8-bit RGB/RGBA PNG.`);
        return { width, height, pixels: null };
      }
    } else if (type === 'IDAT') {
      idat.push(chunk);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!width || !height || idat.length === 0) {
    fail(`${relativePath} must contain IHDR and IDAT chunks.`);
    return null;
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rows = [];
  let rawOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const scanline = Buffer.from(raw.subarray(rawOffset, rawOffset + stride));
    rawOffset += stride;
    const prior = rows[y - 1];

    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? scanline[x - channels] : 0;
      const up = prior ? prior[x] : 0;
      const upLeft = prior && x >= channels ? prior[x - channels] : 0;
      if (filter === 1) scanline[x] = (scanline[x] + left) & 0xff;
      else if (filter === 2) scanline[x] = (scanline[x] + up) & 0xff;
      else if (filter === 3) scanline[x] = (scanline[x] + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) scanline[x] = (scanline[x] + paeth(left, up, upLeft)) & 0xff;
      else if (filter !== 0) {
        fail(`${relativePath} contains unsupported PNG filter ${filter}.`);
        return { width, height, pixels: null };
      }
    }

    rows.push(scanline);
  }

  return {
    width,
    height,
    pixelAt(x, y) {
      const clampedX = Math.max(0, Math.min(width - 1, x));
      const clampedY = Math.max(0, Math.min(height - 1, y));
      const index = clampedX * channels;
      const row = rows[clampedY];
      return {
        r: row[index],
        g: row[index + 1],
        b: row[index + 2],
        a: channels === 4 ? row[index + 3] : 255,
      };
    },
    opaqueBounds() {
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y += 1) {
        const row = rows[y];
        for (let x = 0; x < width; x += 1) {
          const alpha = channels === 4 ? row[x * channels + 3] : 255;
          if (alpha === 0) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      return maxX === -1 ? null : { minX, minY, maxX, maxY };
    },
  };
}

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function assertImage(relativePath, expectedWidth, expectedHeight, base = mobileRoot) {
  const image = parsePng(relativePath, base);
  if (!image) return null;
  if (image.width !== expectedWidth || image.height !== expectedHeight) {
    fail(
      `${relativePath} must be ${expectedWidth}x${expectedHeight}, got ${image.width}x${image.height}.`,
    );
  }
  return image;
}

function colorDistance(left, right) {
  return Math.max(
    Math.abs(left.r - right.r),
    Math.abs(left.g - right.g),
    Math.abs(left.b - right.b),
    Math.abs(left.a - right.a),
  );
}

function assertCenterMatchesWeb(relativePath, image, webCenter) {
  if (!image?.pixelAt) return;
  const center = image.pixelAt(Math.floor(image.width / 2), Math.floor(image.height / 2));
  const tolerance = image.width < 60 ? 140 : image.width < 96 ? 70 : 45;
  if (
    colorDistance(center, webCenter) > tolerance ||
    center.a < 240 ||
    center.b < 220 ||
    center.r < 45 ||
    center.g < 45
  ) {
    fail(
      `${relativePath} center color must stay in the web TaskNebula icon palette, got rgba(${center.r}, ${center.g}, ${center.b}, ${center.a}).`,
    );
  }
}

const webIcon = assertImage('apps/web/public/icons/icon-512.png', 512, 512, repoRoot);
const webCenter = webIcon?.pixelAt(256, 256);
if (!webCenter || colorDistance(webCenter, { r: 101, g: 105, b: 241, a: 255 }) > 3) {
  fail('Web PWA icon center must stay on the TaskNebula brand blue/violet mark.');
}

const androidIconSizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};
for (const [density, size] of Object.entries(androidIconSizes)) {
  const iconPath = `android/app/src/main/res/mipmap-${density}/ic_launcher.png`;
  const roundPath = `android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`;
  const foregroundPath = `android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`;
  assertCenterMatchesWeb(iconPath, assertImage(iconPath, size, size), webCenter);
  assertCenterMatchesWeb(roundPath, assertImage(roundPath, size, size), webCenter);
  assertCenterMatchesWeb(
    foregroundPath,
    assertImage(foregroundPath, Math.round(size * 2.25), Math.round(size * 2.25)),
    webCenter,
  );
}

const iosContents = JSON.parse(
  readText('ios/TaskNebulaMobile/Images.xcassets/AppIcon.appiconset/Contents.json'),
);
for (const entry of iosContents.images ?? []) {
  if (!entry.filename) continue;
  const [width] = String(entry.size).split('x').map(Number);
  const scale = Number(String(entry.scale).replace('x', ''));
  const expectedSize = Math.round(width * scale);
  const iconPath = `ios/TaskNebulaMobile/Images.xcassets/AppIcon.appiconset/${entry.filename}`;
  assertCenterMatchesWeb(iconPath, assertImage(iconPath, expectedSize, expectedSize), webCenter);
}

const launchLogoSizes = {
  'LaunchLogo.png': 112,
  'LaunchLogo@2x.png': 224,
  'LaunchLogo@3x.png': 336,
};
for (const [filename, size] of Object.entries(launchLogoSizes)) {
  const logoPath = `ios/TaskNebulaMobile/Images.xcassets/LaunchLogo.imageset/${filename}`;
  const logo = assertImage(logoPath, size, size);
  assertCenterMatchesWeb(logoPath, logo, webCenter);
  const bounds = logo?.opaqueBounds();
  const minPadding = filename === 'LaunchLogo.png' ? 1 : filename === 'LaunchLogo@2x.png' ? 4 : 8;
  if (
    !bounds ||
    bounds.minX < minPadding ||
    bounds.minY < minPadding ||
    bounds.maxX > size - minPadding - 1 ||
    bounds.maxY > size - minPadding - 1
  ) {
    fail(`${logoPath} must keep transparent padding for the native launch screen mark.`);
  }
}

const launchStoryboard = readText('ios/TaskNebulaMobile/LaunchScreen.storyboard');
if (!launchStoryboard.includes('image="LaunchLogo"')) {
  fail('iOS LaunchScreen.storyboard must render the checked LaunchLogo image set.');
}

const androidAdaptiveIcon = readText('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml');
if (!androidAdaptiveIcon.includes('@drawable/ic_launcher_background')) {
  fail('Android adaptive launcher icon must keep the TaskNebula background layer.');
}
if (!androidAdaptiveIcon.includes('@mipmap/ic_launcher_foreground')) {
  fail('Android adaptive launcher icon must keep the TaskNebula foreground layer.');
}

if (failures.length) {
  console.error(`Brand asset verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  'Brand asset verification passed: native launcher and launch assets match the web mark.',
);
