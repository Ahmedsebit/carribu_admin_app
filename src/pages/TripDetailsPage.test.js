import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TripDetailsPage from './TripDetailsPage';
import { tripAPI, vehicleAPI } from '../services/api';

jest.mock('../services/api', () => ({
  tripAPI: { getDetails: jest.fn() },
  vehicleAPI: { getLocation: jest.fn() },
}));
jest.mock('react-router-dom', () => ({
  useParams: () => ({ id: '5' }),
  useNavigate: () => jest.fn(),
  Link: ({ children }) => <span>{children}</span>,
}));
jest.mock('../components/ui', () => ({
  StatusBadge: ({ children }) => <span>{children}</span>,
  EmptyState: ({ message }) => <p>{message}</p>,
  LoadingState: () => <p>Loading</p>,
}));
jest.mock('@mantine/core', () => {
  const React = require('react');
  const Container = ({ children }) => <div>{children}</div>;
  const Table = Object.assign(Container, {
    ScrollContainer: Container, Thead: Container, Tr: Container,
    Th: Container, Tbody: Container, Td: Container,
  });
  return {
    Alert: ({ children }) => <div role="alert">{children}</div>,
    Button: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
    Anchor: ({ href, to, children }) => <a href={href || to}>{children}</a>,
    Box: ({ component = 'div', title, src, children }) => React.createElement(component, { title, src }, children),
    Grid: Object.assign(({ children }) => <div>{children}</div>, { Col: Container }),
    Table, Badge: Container, Group: Container, Paper: Container, SimpleGrid: Container,
    Stack: Container, Text: Container, ThemeIcon: Container, Title: Container, Progress: () => null,
  };
});

let container, root, trip, locationResponse;
const render = async () => { await act(async () => { root.render(<TripDetailsPage />); }); };
const tick = async () => {
  await act(async () => { jest.advanceTimersByTime(10000); });
};

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { delete global.IS_REACT_ACT_ENVIRONMENT; });

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  trip = {
    id: 5, status: 'in_progress', type: 'morning_pickup',
    vehicle: { id: 12, plateNumber: 'TEST 012', trackerUniqueId: 'test-device' },
    route: { id: 9, name: 'Test route' }, stats: {}, pickupList: [], logs: [], location: null,
  };
  locationResponse = {
    trip: { id: 5, route: trip.route }, locationSource: 'traccar',
    location: {
      lat: -1.3, lng: 36.8, speed: 0, recordedAt: '2026-10-28T07:00:00Z',
      isLastKnown: true, predatesTrip: true, source: 'traccar',
    },
  };
  tripAPI.getDetails.mockImplementation(async () => ({ data: { trip } }));
  vehicleAPI.getLocation.mockImplementation(async () => ({ data: locationResponse }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
});

test('the actual trip details page uses the same last-known Traccar map as Live', async () => {
  await render();
  expect(vehicleAPI.getLocation).toHaveBeenCalledWith(12, expect.objectContaining({ signal: expect.anything() }));
  expect(container.textContent).toContain('Active trip location');
  expect(container.textContent).toContain('Traccar device');
  expect(container.textContent).toContain('recorded before this trip started');
  expect(container.textContent).toContain('-1.30000, 36.80000');
  expect(container.querySelector('iframe[title="Vehicle location"]')).not.toBeNull();
  expect(container.textContent).not.toContain('No GPS location was recorded for this trip.');
});

test('trip details refresh from a last-known snapshot to a fresh fix every 10 seconds', async () => {
  await render();
  locationResponse = {
    ...locationResponse,
    location: { lat: -1.4, lng: 36.9, speed: 0, recordedAt: '2026-10-29T08:05:00Z', source: 'traccar' },
  };
  await tick();
  expect(container.textContent).toContain('-1.40000, 36.90000');
  expect(container.textContent).not.toContain('recorded before this trip started');
});

test('the details location card surfaces request failures rather than an empty historical map', async () => {
  vehicleAPI.getLocation.mockRejectedValueOnce({ response: { data: { error: 'Device location unavailable.' } } });
  await render();
  expect(container.textContent).toContain('Device location unavailable.');
  expect(container.querySelector('iframe')).toBeNull();
});

test('completed trips retain their recorded location and never query the current vehicle snapshot', async () => {
  trip = { ...trip, status: 'completed', location: {
    lat: -1, lng: 36, speed: 0, recordedAt: '2026-10-28T08:30:00Z', source: 'phone',
  } };
  await render();
  expect(vehicleAPI.getLocation).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Last recorded location');
  expect(container.textContent).toContain('-1.00000, 36.00000');
  expect(container.querySelector('iframe[title="Bus location"]')).not.toBeNull();
  expect(container.textContent).not.toContain('recorded before this trip started');
});

test('active trip details explicitly report missing vehicle assignments', async () => {
  trip = { ...trip, vehicle: null };
  await render();
  expect(container.textContent).toContain('This trip has no vehicle assigned');
  expect(vehicleAPI.getLocation).not.toHaveBeenCalled();
});
