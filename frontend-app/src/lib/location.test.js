import { getLocation } from './location';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: jest.fn().mockResolvedValue({ state: 'granted' }) } });
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: jest.fn() } });
});

test('granted permission reads coordinates using the browser cache', async () => {
  const success = jest.fn();
  await getLocation(success);
  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledWith(success, expect.any(Function), { timeout: 10000, maximumAge: 300000 });
});

test.each(['prompt', 'denied'])('does not request GPS when permission is %s even after a previous grant', async (state) => {
  localStorage.setItem('location_requested', 'true');
  navigator.permissions.query.mockResolvedValue({ state });
  const error = jest.fn();
  await getLocation(jest.fn(), error);
  expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalled();
});

test('location-off preference prevents automatic GPS reads', async () => {
  localStorage.setItem('location_requested', 'denied');
  await getLocation(jest.fn());
  expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
});

test('unsupported Permissions API never triggers an automatic prompt', async () => {
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
  await getLocation(jest.fn());
  expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
});

test('failed permission query never triggers an automatic prompt', async () => {
  navigator.permissions.query.mockRejectedValue(new Error('unsupported'));
  await getLocation(jest.fn());
  expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
});

test('an explicit action can request permission', async () => {
  navigator.permissions.query.mockResolvedValue({ state: 'prompt' });
  localStorage.setItem('location_requested', 'denied');
  await getLocation(jest.fn(), jest.fn(), { requestPermission: true });
  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
  expect(navigator.geolocation.getCurrentPosition.mock.calls[0][2]).not.toHaveProperty('requestPermission');
});

test('GPS timeout is reported without overwriting the location preference', async () => {
  localStorage.setItem('location_requested', 'true');
  navigator.geolocation.getCurrentPosition.mockImplementation((success, error) => error({ code: 3 }));
  const error = jest.fn();
  await getLocation(jest.fn(), error);
  expect(error).toHaveBeenCalledWith({ code: 3 });
  expect(localStorage.getItem('location_requested')).toBe('true');
});
