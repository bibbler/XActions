// Copyright (c) 2024-2026 nich (@nichxbt). Licensed under the Apache License, Version 2.0.
/**
 * Security regressions for the API server.
 *
 * Each block reproduces a vulnerability that was found in the real app and
 * asserts it stays closed. The app is booted through createApp() with stub env,
 * as in contract.test.js, so no Postgres or Redis is needed.
 *
 * @author nich (@nichxbt)
 * @license Apache-2.0
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

// A private home, so dataset paths resolve inside it. Set before any import
// that computes ~/.xactions.
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'xactions-sec-'));
process.env.HOME = HOME;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'security-test-jwt-secret';
process.env.SESSION_SECRET = 'security-test-session-secret';
process.env.DATABASE_URL = 'postgresql://user:password@127.0.0.1:1/xactions?schema=public';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '1';
process.env.XACTIONS_NO_TELEMETRY = '1';

let app;
let io;

beforeAll(async () => {
  const server = await import('../../api/server.js');
  ({ app, io } = server.createApp({ rateLimiting: false }));
});

afterAll(() => {
  io?.close();
  fs.rmSync(HOME, { recursive: true, force: true });
});

describe('datasets: path traversal', () => {
  it('the store refuses any name that could leave the datasets directory', async () => {
    const { DatasetStore, InvalidDatasetNameError } = await import('../../src/scraping/paginationEngine.js');
    for (const name of ['..', '../victim', '../../../victim', 'a/b', 'a\\b', '.hidden', '', 'x'.repeat(200), '/etc']) {
      expect(() => new DatasetStore(name), name).toThrow(InvalidDatasetNameError);
    }
    expect(new DatasetStore('trending-hashtags_2026.v1').name).toBe('trending-hashtags_2026.v1');
  });

  it('an unauthenticated DELETE with an encoded ../ no longer deletes anything', async () => {
    const victim = path.join(HOME, 'victim');
    fs.mkdirSync(victim, { recursive: true });
    fs.writeFileSync(path.join(victim, 'keep.txt'), 'still here');

    const res = await request(app).delete('/api/datasets/..%2F..%2Fvictim');

    expect(res.status).toBe(401);
    expect(fs.existsSync(path.join(victim, 'keep.txt'))).toBe(true);
  });

  it('read and export are closed to anonymous callers too', async () => {
    expect((await request(app).get('/api/datasets')).status).toBe(401);
    expect((await request(app).get('/api/datasets/..%2F..%2Fetc')).status).toBe(401);
    expect((await request(app).get('/api/datasets/x/export')).status).toBe(401);
  });
});

describe('x402: the payment gate cannot be skipped by URL spelling', () => {
  it('normalises the path the way Express routes it', async () => {
    const { paymentGatePath } = await import('../../api/utils/paymentGatePath.js');
    expect(paymentGatePath('/API/ai/posting/tweet')).toBe('/api/ai/posting/tweet');
    expect(paymentGatePath('/api/Scripts/run')).toBe('/api/scripts/run');
    expect(paymentGatePath('//api//ai//health/')).toBe('/api/ai/health');
  });

  it('gates mixed-case paths exactly like the canonical one', async () => {
    // Outside production an unconfigured gate lets the request through but
    // marks it, which proves the gate saw it as a paid path.
    for (const url of ['/api/ai/posting/tweet', '/API/ai/posting/tweet', '/api/AI/Posting/Tweet', '/api/Scripts/run']) {
      const res = await request(app).post(url).send({});
      expect(res.headers['x-payment-bypassed'], url).toMatch(/x402-not-configured/);
    }
  });

  it('leaves the free endpoints free in any spelling', async () => {
    for (const url of ['/api/ai/health', '/API/AI/HEALTH', '/api/ai/pricing/']) {
      const res = await request(app).get(url);
      expect(res.headers['x-payment-bypassed'], url).toBeUndefined();
    }
  });
});
