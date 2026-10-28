import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies, globals = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(new URL(`../../lib/${file}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    ...globals,
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return module.exports;
}

function harness() {
  let now = 1_000_000;
  let user = 'user-a';
  let respond = async (url) => ({ url, user, sequence: calls.length });
  const calls = [];
  const window = new EventTarget();
  const cache = load('read-cache', {}, { Date: { now: () => now } });
  const dependencies = {
    './read-cache': cache,
    './settings': { getBrowserTimezone: () => 'Australia/Sydney' },
    './api': {
      getSessionKey: () => user,
      apiRequest(url, options = {}) {
        calls.push({ url, options });
        return respond(url, options);
      },
    },
  };
  return {
    cache,
    calls,
    events: load('data-events', dependencies, { window, CustomEvent }),
    analytics: load('analytics', dependencies),
    forest: load('gamification', dependencies, { window, CustomEvent }),
    advance(ms) {
      now += ms;
    },
    login(value) {
      user = value;
    },
    respond(callback) {
      respond = callback;
    },
  };
}

test('page remounts reuse recent insight and forest reads, then revalidate expired data', async () => {
  const h = harness();
  const read = () =>
    Promise.all([
      h.analytics.getInsightsSummary(),
      h.forest.getForest(),
      h.forest.getForestScene(),
      h.forest.getPlantCatalog(),
      h.forest.getAchievements(),
      h.forest.getGamificationProfile(),
    ]);
  const first = await read();
  const second = await read();
  assert.equal(h.calls.length, 6);
  assert.equal(first[0], second[0]);
  assert.equal(h.analytics.getCachedInsightsSummary(), first[0]);
  assert.equal(h.forest.getCachedForest(), first[1]);
  assert.equal(h.forest.getCachedForestScene(), first[2]);
  assert.equal(h.forest.getCachedPlantCatalog(), first[3]);
  assert.equal(h.forest.getCachedAchievements(), first[4]);
  assert.match(h.calls[0].url, /include_schedule=false/);
  h.advance(60_001);
  assert.equal(h.analytics.getCachedInsightsSummary(), first[0]);
  await read();
  assert.equal(h.calls.length, 12);
});

test('tasks, focus, settings, and rewards invalidate affected cached pages', async () => {
  const h = harness();
  for (const change of [
    () => h.events.emitTaskDataChanged(),
    () => h.events.emitFocusDataChanged(),
    () => h.events.emitSettingsDataChanged(),
    () => h.forest.emitGrowthReward({ awarded: true }),
  ]) {
    const [before] = await Promise.all([h.analytics.getInsightsSummary(), h.forest.getForest()]);
    change();
    assert.equal(h.analytics.getCachedInsightsSummary(), undefined);
    assert.equal(h.forest.getCachedForest(), undefined);
    const [after] = await Promise.all([h.analytics.getInsightsSummary(), h.forest.getForest()]);
    assert.notEqual(after, before);
  }
});

test('forest mutations invalidate reads even when no growth reward is emitted', async () => {
  for (const mutate of [
    (f) => f.selectPlant('oak'),
    (f) => f.renamePlant('tree', 'New name'),
    (f) => f.renameForest('New forest'),
    (f) => f.placePlant('tree', { position_x: 1, position_z: 2 }),
    (f) => f.claimAchievement('first-task'),
  ]) {
    const h = harness();
    await h.forest.getForest();
    await mutate(h.forest);
    assert.equal(h.forest.getCachedForest(), undefined);
    await h.forest.getForest();
    assert.equal(
      h.calls.filter((call) => call.url === '/gamification/forest' && !call.options.method).length,
      2,
    );
  }
});

test('leaving one page cancels its subscription without cancelling a shared request', async () => {
  const h = harness();
  let complete;
  h.respond(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const controller = new AbortController();
  const first = h.forest.getForest({ signal: controller.signal });
  const second = h.forest.getForest();
  const cancelled = assert.rejects(first, { name: 'AbortError' });
  controller.abort();
  await cancelled;
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.signal, undefined);
  const data = { forest_name: 'Shared forest' };
  complete(data);
  assert.equal(await second, data);
  assert.equal(await h.forest.getForest(), data);
  assert.equal(h.calls.length, 1);
});

test('account changes isolate snapshots and discard late results from the previous account', async () => {
  const h = harness();
  const complete = [];
  h.respond(
    () =>
      new Promise((resolve) => {
        complete.push(resolve);
      }),
  );
  const previous = h.forest.getForest();
  await Promise.resolve();
  h.login('user-b');
  assert.equal(h.forest.getCachedForest(), undefined);
  const current = h.forest.getForest();
  await Promise.resolve();
  const currentData = { forest_name: 'User B forest' };
  complete[1](currentData);
  await current;
  complete[0]({ forest_name: 'User A forest' });
  await previous;
  assert.equal(h.forest.getCachedForest(), currentData);
});

test('failed reads can retry, and weekly narrative has a separate longer cache', async () => {
  const h = harness();
  h.respond(async () => {
    throw new Error('Temporarily unavailable');
  });
  await assert.rejects(h.analytics.getInsightsSummary(), /Temporarily unavailable/);
  assert.equal(h.analytics.getCachedInsightsSummary(), undefined);
  h.respond(async (url) => ({ url }));
  await h.analytics.getInsightsSummary();
  const weekly = await h.analytics.getWeeklyInsight();
  h.advance(60_001);
  assert.equal(await h.analytics.getWeeklyInsight(), weekly);
  assert.equal(h.analytics.getCachedWeeklyInsight(), weekly);
  h.advance(5 * 60_000);
  assert.notEqual(await h.analytics.getWeeklyInsight(), weekly);
});
