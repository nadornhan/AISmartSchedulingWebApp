import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const componentPath = new URL(
  '../../components/gamification/forest-ambient-audio.tsx',
  import.meta.url,
);
const forestPagePath = new URL(
  '../../components/gamification/forest-world-page.tsx',
  import.meta.url,
);
const audioPath = new URL('../../public/sounds/forest-ambience.mp3', import.meta.url);

test('forest ambience is a low-volume, fading, persistent loop', () => {
  const source = readFileSync(componentPath, 'utf8');

  assert.match(source, /FOREST_AMBIENCE_VOLUME = 0\.12/);
  assert.match(source, /FADE_DURATION_MS = 1_800/);
  assert.match(source, /audio\.loop = true/);
  assert.match(source, /localStorage\.setItem\(FOREST_AMBIENCE_PREFERENCE/);
  assert.match(source, /visibilitychange/);
});

test('forest page renders the ambience control and ships its audio asset', () => {
  const forestPage = readFileSync(forestPagePath, 'utf8');

  assert.match(forestPage, /<ForestAmbientAudio \/>/);
  assert.equal(existsSync(audioPath), true);
  assert.ok(statSync(audioPath).size > 100_000);
});
