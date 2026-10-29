import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import VehicleLocationCard from './VehicleLocationCard';
import { vehicleAPI } from '../services/api';

jest.mock('../services/api', () => ({ vehicleAPI: { getLocation: jest.fn() } }));
jest.mock('./ui', () => ({ EmptyState: ({ message }) => <p>{message}</p> }));
jest.mock('@tabler/icons-react', () => ({ IconAlertCircle: () => null }));
jest.mock('@mantine/core', () => {
  const React = require('react');
  const Container = ({ children }) => <div>{children}</div>;
  return {
    Alert: ({ children }) => <div role="alert">{children}</div>,
    Anchor: ({ href, to, children }) => <a href={href || to}>{children}</a>,
    Box: ({ component = 'div', title, src, children }) => React.createElement(component, { title, src }, children),
    Badge: Container, Group: Container, Paper: Container, Stack: Container, Text: Container, Title: Container,
  };
});

let container, root;
const noTrip = { trip: null, location: null, locationSource: 'traccar' };
const activeTrip = {
  trip: { id: 5, status: 'in_progress', route: { name: 'Test route' } },
  locationSource: 'traccar',
  location: { lat: 0, lng: 0, speed: 0, source: 'traccar', recordedAt: '2026-10-29T08:00:00Z' },
};
const render = async (vehicleId = '12', tripId) => {
  await act(async () => { root.render(<VehicleLocationCard vehicleId={vehicleId} tripId={tripId} />); });
};
const tick = async () => {
  await act(async () => { jest.advanceTimersByTime(10000); });
};

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { delete global.IS_REACT_ACT_ENVIRONMENT; });

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vehicleAPI.getLocation.mockResolvedValue({ data: activeTrip });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
});

test('shows Traccar coordinates, zero speed, fix time and active trip link', async () => {
  await render();
  expect(container.textContent).toContain('Traccar device');
  expect(container.textContent).toContain('0.00000, 0.00000');
  expect(container.textContent).toContain('0 km/h');
  expect(container.textContent).toContain(`Last GPS fix: ${new Date(activeTrip.location.recordedAt).toLocaleString()}`);
  expect(container.querySelector('iframe').src).toContain('marker=0%2C0');
  expect(container.querySelector('a').getAttribute('href')).toBe('/trips/5');
});

test('shows no map when the vehicle has no active trip', async () => {
  vehicleAPI.getLocation.mockResolvedValue({ data: noTrip });
  await render();
  expect(container.textContent).toContain('This vehicle has no active trip');
  expect(container.querySelector('iframe')).toBeNull();
});

test('waits for a Traccar fix without showing a phone location', async () => {
  vehicleAPI.getLocation.mockResolvedValue({ data: { ...activeTrip, location: null } });
  await render();
  expect(container.textContent).toContain('Waiting for a Traccar GPS fix');
  expect(container.querySelector('iframe')).toBeNull();
});

test('identifies unlinked vehicles as using driver-phone GPS', async () => {
  vehicleAPI.getLocation.mockResolvedValue({ data: { ...activeTrip, locationSource: 'phone', location: null } });
  await render();
  expect(container.textContent).toContain('Driver phone GPS');
  expect(container.textContent).toContain('Waiting for the driver phone');
});

test('refreshes fixes and removes the map when the trip ends', async () => {
  await render();
  vehicleAPI.getLocation.mockResolvedValueOnce({ data: {
    ...activeTrip, location: { ...activeTrip.location, lat: -1.3, lng: 36.8 },
  } });
  await tick();
  expect(container.textContent).toContain('-1.30000, 36.80000');
  vehicleAPI.getLocation.mockResolvedValueOnce({ data: noTrip });
  await tick();
  expect(container.querySelector('iframe')).toBeNull();
  expect(container.textContent).toContain('This vehicle has no active trip');
});

test('detects a trip starting while the vehicle page remains open', async () => {
  vehicleAPI.getLocation.mockResolvedValueOnce({ data: noTrip });
  await render();
  expect(container.querySelector('iframe')).toBeNull();
  await tick();
  expect(container.querySelector('iframe')).not.toBeNull();
});

test('shows errors explicitly, removes a stale map and recovers on the next poll', async () => {
  await render();
  vehicleAPI.getLocation.mockRejectedValueOnce({ response: { data: { error: 'Location database unavailable.' } } });
  await tick();
  expect(container.querySelector('[role="alert"]').textContent).toBe('Location database unavailable.');
  expect(container.querySelector('iframe')).toBeNull();
  await tick();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelector('iframe')).not.toBeNull();
});

test('does not overlap polls and cancels outstanding requests on unmount', async () => {
  vehicleAPI.getLocation.mockImplementation(() => new Promise(() => {}));
  await render();
  await tick();
  expect(vehicleAPI.getLocation).toHaveBeenCalledTimes(1);
  const { signal } = vehicleAPI.getLocation.mock.calls[0][1];
  act(() => root.unmount());
  expect(signal.aborted).toBe(true);
  root = createRoot(container);
  await tick();
  expect(vehicleAPI.getLocation).toHaveBeenCalledTimes(1);
});

test('ignores a previous vehicle response after navigation', async () => {
  let resolvePrevious;
  vehicleAPI.getLocation.mockImplementationOnce(() => new Promise(resolve => { resolvePrevious = resolve; }));
  vehicleAPI.getLocation.mockResolvedValueOnce({ data: noTrip });
  await render('12');
  const { signal } = vehicleAPI.getLocation.mock.calls[0][1];
  await render('13');
  expect(signal.aborted).toBe(true);
  await act(async () => { resolvePrevious({ data: activeTrip }); });
  expect(container.querySelector('iframe')).toBeNull();
  expect(container.textContent).toContain('This vehicle has no active trip');
});

test('shows Traccar for the selected trip, including string trip IDs', async () => {
  await render('12', '5');
  expect(container.textContent).toContain('Traccar device');
  expect(container.querySelector('iframe')).not.toBeNull();
});

test('does not switch the selected trip map to a different trip on the same vehicle', async () => {
  await render('12', 5);
  vehicleAPI.getLocation.mockResolvedValueOnce({ data: {
    ...activeTrip, trip: { ...activeTrip.trip, id: 6 },
  } });
  await tick();
  expect(container.querySelector('iframe')).toBeNull();
  expect(container.textContent).toContain('This trip is no longer active');
});

test('clears selected-trip tracking when the trip ends', async () => {
  await render('12', 5);
  vehicleAPI.getLocation.mockResolvedValueOnce({ data: noTrip });
  await tick();
  expect(container.querySelector('iframe')).toBeNull();
  expect(container.textContent).toContain('Location tracking has stopped');
});

test('cancels the previous request when the selected trip changes on the same vehicle', async () => {
  let resolvePrevious;
  vehicleAPI.getLocation.mockImplementationOnce(() => new Promise(resolve => { resolvePrevious = resolve; }));
  vehicleAPI.getLocation.mockResolvedValueOnce({ data: {
    ...activeTrip, trip: { ...activeTrip.trip, id: 6 }, location: null,
  } });
  await render('12', 5);
  const { signal } = vehicleAPI.getLocation.mock.calls[0][1];
  await render('12', 6);
  expect(signal.aborted).toBe(true);
  await act(async () => { resolvePrevious({ data: activeTrip }); });
  expect(container.querySelector('iframe')).toBeNull();
  expect(container.textContent).toContain('Waiting for a Traccar GPS fix');
});
