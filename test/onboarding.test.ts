import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/doctor.js', () => ({ doctor: vi.fn(), setup: vi.fn() }));
import { doctor, setup } from '../src/doctor.js';
import { connectGarmin, prepareConnection } from '../src/onboarding.js';
afterEach(() => vi.resetAllMocks());

describe('conversation onboarding', () => {
  it('returns a connected state without restarting a valid session', async () => {
    const auth = { getValidAuth: vi.fn(async () => ({ capturedAt: 1 })) }; const session = { start: vi.fn() };
    expect((await connectGarmin(true, auth as any, session as any)).state).toBe('success');
    expect(session.start).not.toHaveBeenCalled();
  });
  it('starts background provisioning and preserves the no-download preference', async () => {
    const auth = { getValidAuth: vi.fn(async () => null) }; const session = { start: vi.fn(() => ({ state: 'pending', message: 'Preparing' })) };
    expect((await connectGarmin(false, auth as any, session as any)).state).toBe('pending');
    expect(session.start).toHaveBeenCalledWith({ installBrowser: false });
    await connectGarmin(true, auth as any, session as any);
    expect(session.start).toHaveBeenLastCalledWith({ installBrowser: true });
  });
  it('does not start sign-in when Garmin connectivity is failing', async () => {
    const auth = { getValidAuth: vi.fn(async () => { throw new Error('network'); }) }; const session = { start: vi.fn() };
    await expect(connectGarmin(true, auth as any, session as any)).rejects.toThrow('network');
    expect(session.start).not.toHaveBeenCalled();
  });
  it('fails before downloads when the desktop/runtime is unavailable', async () => {
    vi.mocked(doctor).mockResolvedValue({ ok: false, checks: [{ name: 'display', ok: false, message: 'Graphical desktop required' }] });
    await expect(prepareConnection(true)).rejects.toMatchObject({ code: 'SETUP_REQUIRED' });
    expect(setup).not.toHaveBeenCalled();
  });
  it('provisions a missing browser in the helper after prerequisite checks', async () => {
    vi.mocked(doctor).mockResolvedValue({ ok: false, checks: [{ name: 'browser', ok: false, message: 'Missing' }, { name: 'storage', ok: true, message: 'Ready' }] });
    await prepareConnection(true); expect(setup).toHaveBeenCalledWith(true);
  });
});
