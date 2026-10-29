import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TripsPage from './TripsPage';
import { tripAPI, routeAPI, vehicleAPI, locationAPI } from '../services/api';

jest.mock('../services/api', () => ({
  tripAPI: { getAll: jest.fn(), getLogs: jest.fn() },
  routeAPI: { getAll: jest.fn() },
  vehicleAPI: { getLocation: jest.fn() },
  locationAPI: { getBusLocation: jest.fn() },
}));
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children }) => <span>{children}</span>,
}));
jest.mock('../components/Modal', () => ({ isOpen, onClose, children }) => isOpen ? (
  <section data-testid="modal">
    <button onClick={onClose}>Close modal</button>
    {children}
  </section>
) : null);
jest.mock('../components/ui', () => {
  const Container = ({ children }) => <div>{children}</div>;
  return {
    PageHeader: ({ actions }) => <div>{actions}</div>,
    StatsGrid: Container, StatCard: () => null, StatusBadge: Container,
    EmptyState: ({ message }) => <p>{message}</p>, LoadingState: () => <p>Loading</p>,
  };
});
jest.mock('@mantine/core', () => {
  const React = require('react');
  const Container = ({ children }) => <div>{children}</div>;
  const Table = Object.assign(Container, {
    ScrollContainer: Container, Thead: Container, Tr: Container,
    Th: Container, Tbody: Container, Td: Container,
  });
  return {
    Alert: ({ children }) => <div role="alert">{children}</div>,
    Button: ({ children, onClick, disabled }) => <button onClick={onClick} disabled={disabled}>{children}</button>,
    Anchor: ({ href, to, children }) => <a href={href || to}>{children}</a>,
    Box: ({ component = 'div', title, src, children }) => React.createElement(component, { title, src }, children),
    Grid: Object.assign(({ children }) => <div>{children}</div>, { Col: Container }),
    Table, Checkbox: () => null, TextInput: () => null, Select: () => null,
    Group: Container, Paper: Container, Badge: Container, Text: Container,
    Title: Container, Stack: Container, SimpleGrid: Container, Progress: () => null, ThemeIcon: Container,
  };
});

let container, root, trip;
const click = async label => {
  const button = [...container.querySelectorAll('button')].find(item => item.textContent === label);
  expect(button).toBeDefined();
  await act(async () => { button.click(); });
};
const tick = async () => {
  await act(async () => { jest.advanceTimersByTime(10000); });
};

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { delete global.IS_REACT_ACT_ENVIRONMENT; });

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  trip = {
    id: 5, vehicleId: 12, status: 'in_progress', type: 'morning_pickup',
    scheduledDate: '2026-10-29', startedAt: '2026-10-29T08:00:00Z',
    vehicle: { id: 12, plateNumber: 'TEST 012' },
    route: { id: 9, name: 'Test route', students: [] },
  };
  tripAPI.getAll.mockImplementation(async () => ({ data: { trips: [trip] } }));
  tripAPI.getLogs.mockResolvedValue({ data: { logs: [] } });
  routeAPI.getAll.mockResolvedValue({ data: { routes: [] } });
  vehicleAPI.getLocation.mockResolvedValue({ data: {
    trip: { id: 5, route: { name: 'Test route' } }, locationSource: 'traccar',
    location: { lat: -1.3, lng: 36.8, speed: 0, recordedAt: '2026-10-29T08:05:00Z', source: 'traccar' },
  } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
});

const render = async () => { await act(async () => { root.render(<TripsPage />); }); };

test('the actual Live button opens the shared Traccar-backed vehicle map', async () => {
  await render();
  expect(vehicleAPI.getLocation).not.toHaveBeenCalled();
  await click('Live');
  expect(vehicleAPI.getLocation).toHaveBeenCalledWith(12, expect.objectContaining({ signal: expect.anything() }));
  expect(locationAPI.getBusLocation).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Traccar device');
  expect(container.textContent).toContain('-1.30000, 36.80000');
  expect(container.querySelector('iframe').src).toContain('marker=-1.3%2C36.8');
});

test('missing device fixes wait for Traccar rather than driver-phone sharing', async () => {
  vehicleAPI.getLocation.mockResolvedValue({ data: {
    trip: { id: 5 }, location: null, locationSource: 'traccar',
  } });
  await render();
  await click('Live');
  expect(container.textContent).toContain('Waiting for a Traccar GPS fix');
  expect(container.textContent).not.toContain('Waiting for the driver');
});

test('location failures are displayed rather than disguised as no GPS data', async () => {
  vehicleAPI.getLocation.mockRejectedValue({ response: { data: { error: 'Location service unavailable.' } } });
  await render();
  await click('Live');
  expect(container.textContent).toContain('Location service unavailable.');
  expect(container.querySelector('iframe')).toBeNull();
});

test('student-log failures remain visible while the Traccar map works and recover on refresh', async () => {
  tripAPI.getLogs.mockRejectedValueOnce({ response: { data: { error: 'Student updates unavailable.' } } });
  await render();
  await click('Live');
  expect(container.textContent).toContain('Student updates unavailable.');
  expect(container.querySelector('iframe')).not.toBeNull();
  await tick();
  expect(container.textContent).not.toContain('Student updates unavailable.');
});

test('closing Live aborts location and roster requests and stops their polling', async () => {
  tripAPI.getLogs.mockImplementation(() => new Promise(() => {}));
  vehicleAPI.getLocation.mockImplementation(() => new Promise(() => {}));
  await render();
  await click('Live');
  const locationSignal = vehicleAPI.getLocation.mock.calls[0][1].signal;
  const rosterSignal = tripAPI.getLogs.mock.calls[0][1].signal;
  await click('Close modal');
  expect(locationSignal.aborted).toBe(true);
  expect(rosterSignal.aborted).toBe(true);
  await tick();
  expect(vehicleAPI.getLocation).toHaveBeenCalledTimes(1);
  expect(tripAPI.getLogs).toHaveBeenCalledTimes(1);
});

test('uses the vehicle association when vehicleId is absent', async () => {
  delete trip.vehicleId;
  await render();
  await click('Live');
  expect(vehicleAPI.getLocation).toHaveBeenCalledWith(12, expect.anything());
});

test('surfaces a missing vehicle instead of requesting an invalid vehicle location', async () => {
  delete trip.vehicleId;
  trip.vehicle = null;
  await render();
  await click('Live');
  expect(container.textContent).toContain('This trip has no vehicle assigned');
  expect(vehicleAPI.getLocation).not.toHaveBeenCalled();
});
