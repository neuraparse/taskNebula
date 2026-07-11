import { useNavigationReady } from './navigation-ready';

describe('navigation ready store', () => {
  beforeEach(() => {
    useNavigationReady.getState().reset();
  });

  it('publishes a monotonic ready signal for pending navigation retries', () => {
    expect(useNavigationReady.getState()).toMatchObject({
      ready: false,
      readyVersion: 0,
    });

    useNavigationReady.getState().markReady();
    expect(useNavigationReady.getState()).toMatchObject({
      ready: true,
      readyVersion: 1,
    });

    useNavigationReady.getState().markReady();
    expect(useNavigationReady.getState()).toMatchObject({
      ready: true,
      readyVersion: 2,
    });
  });
});
