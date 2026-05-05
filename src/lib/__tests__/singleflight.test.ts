import { singleflight } from '../singleflight';

describe('singleflight', () => {
  it('calls fn exactly once for concurrent requests', async () => {
    const fn = jest.fn(async () => {
      await new Promise(r => setTimeout(r, 30));
      return 'result';
    });

    const results = await Promise.all([
      singleflight('key1', fn),
      singleflight('key1', fn),
      singleflight('key1', fn),
    ]);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['result', 'result', 'result']);
  });

  it('allows a new call after the previous one completes', async () => {
    const fn = jest.fn(async () => 'result');

    await singleflight('key2', fn);
    await singleflight('key2', fn);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propagates errors to all concurrent callers', async () => {
    const fn = jest.fn(async () => {
      throw new Error('Sheets error');
    });

    const results = await Promise.allSettled([
      singleflight('key3', fn),
      singleflight('key3', fn),
    ]);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    expect((results[0] as PromiseRejectedResult).reason.message).toBe('Sheets error');
  });

  it('handles different keys independently', async () => {
    const fnA = jest.fn(async () => 'a');
    const fnB = jest.fn(async () => 'b');

    const [a, b] = await Promise.all([
      singleflight('keyA', fnA),
      singleflight('keyB', fnB),
    ]);

    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
    expect(a).toBe('a');
    expect(b).toBe('b');
  });
});
