import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GarminAuth } from '../src/garmin-auth.js';
import { GarminClient } from '../src/garmin/client.js';
import { garminFetch, responseError } from '../src/errors.js';

const directories: string[] = [];
afterEach(() => { vi.unstubAllGlobals(); directories.forEach(path => rmSync(path, { recursive: true, force: true })); directories.length = 0; });
const auth = { cookies: 'example=test', csrfToken: 'test', capturedAt: 1 };
function session() {
  const directory = mkdtempSync(join(tmpdir(), 'garmin-errors-')); directories.push(directory);
  writeFileSync(join(directory, 'auth.json'), JSON.stringify(auth));
  return directory;
}

describe('error classification', () => {
  it.each([[401, 'AUTH_REQUIRED'], [403, 'AUTH_REQUIRED'], [429, 'RATE_LIMITED'], [503, 'GARMIN_UNAVAILABLE'], [400, 'API_ERROR']])('classifies HTTP %s without reflecting a response body', (status, code) => {
    const error = responseError(new Response('token=private', { status: status as number }));
    expect(error.code).toBe(code);
    expect(error.message).not.toContain('private');
  });
  it('returns a bounded retry hint for rate limiting', () => {
    expect(responseError(new Response('', { status: 429, headers: { 'retry-after': '42' } })).retryAfterSeconds).toBe(42);
    expect(responseError(new Response('', { status: 429, headers: { 'retry-after': 'invalid' } })).retryAfterSeconds).toBeUndefined();
  });
  it.each([429, 503])('preserves stored credentials and exposes HTTP %s instead of asking for login', async status => {
    const directory = session();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status })));
    await expect(new GarminAuth(directory).getValidAuth()).rejects.toMatchObject({ code: status === 429 ? 'RATE_LIMITED' : 'GARMIN_UNAVAILABLE' });
    expect(JSON.parse(readFileSync(join(directory, 'auth.json'), 'utf8'))).toEqual(auth);
  });
  it('sanitizes transport failures, keeps credentials, and never retries writes', async () => {
    const directory = session();
    const fetch = vi.fn(async () => { throw new Error('https://example.test?token=private'); }); vi.stubGlobal('fetch', fetch);
    await expect(new GarminAuth(directory).getValidAuth()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(JSON.parse(readFileSync(join(directory, 'auth.json'), 'utf8'))).toEqual(auth);
    await expect(new GarminClient(auth).deleteWorkout(12)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(fetch).toHaveBeenCalledTimes(2);
    const options = fetch.mock.calls[1]?.[1] as any;
    expect(options.redirect).toBe('error'); expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});
