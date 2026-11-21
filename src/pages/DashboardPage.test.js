import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import DashboardPage from './DashboardPage';
import FleetActivity, { fleetStatus } from '../components/FleetActivity';
import { schoolAPI, tripAPI, vehicleAPI, driverAPI } from '../services/api';

let mockUser = { schoolId: 1 };
const mockNavigate = jest.fn();
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../services/api', () => ({
  schoolAPI: { getDashboard: jest.fn() }, tripAPI: { getAll: jest.fn() },
  vehicleAPI: { getStats: jest.fn(), getLocation: jest.fn() }, driverAPI: { getAll: jest.fn() },
  messageAPI: { sendTripNotification: jest.fn() },
}));
jest.mock('../components/Modal', () => ({ isOpen, children, footer }) => isOpen ? <div>{children}{footer}</div> : null);
jest.mock('../components/ui', () => ({
  EmptyState: ({ message }) => <div>{message}</div>, LoadingState: () => <div>Loading</div>, statusColor: () => 'gray',
}));
jest.mock('@tabler/icons-react', () => new Proxy({}, { get: () => () => null }));
jest.mock('@mantine/core', () => {
  const React = require('react');
  const Container = ({ children }) => <div>{children}</div>;
  const Grid = Container; Grid.Col = Container;
  return {
    Grid, Group: Container, Paper: Container, Stack: Container, Text: Container, Title: Container,
    Badge: Container, SimpleGrid: Container, ThemeIcon: Container, Progress: Container, MultiSelect: Container,
    Alert: ({ children }) => <div role="alert">{children}</div>,
    Box: ({ component = 'div', title, src, children }) => React.createElement(component, { title, src }, children),
    Button: ({ children, onClick, disabled, ...props }) => <button disabled={disabled} onClick={onClick} aria-pressed={props['aria-pressed']}>{children}</button>,
    ActionIcon: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
    Tooltip: ({ children }) => <div>{children}</div>,
    Textarea: ({ label, value, onChange }) => <textarea aria-label={label} value={value} onChange={onChange} />,
    SegmentedControl: ({ value, data, onChange }) => <select aria-label="Average period" value={value} onChange={event => onChange(event.target.value)}>{data.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>,
  };
});

const now = Date.parse('2099-11-20T05:00:00Z');
const dailyTrips = [1, 2, 3].map(id => ({
  id, scheduledDate: id === 3 ? '2099-11-19' : '2099-11-20', status: 'in_progress',
  type: id === 1 ? 'morning_pickup' : 'afternoon_dropoff',
  route: { name: `Route ${id}` }, vehicle: { id: id + 100, plateNumber: `Bus ${id}` },
  studentStats: { total: 1, pending: 1, arrived: id === 1 ? 1 : 0 },
}));
const entry = (trip = dailyTrips[0], extra = {}) => ({
  trip, location: { lat: 0, lng: 0, speed: 0, recordedAt: new Date(now).toISOString(), ...extra }, error: '',
});
let root, container;
const render = async element => act(async () => root.render(element));
const button = text => [...container.querySelectorAll('button')].find(element => element.textContent.includes(text));
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { delete global.IS_REACT_ACT_ENVIRONMENT; });
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(now);
  mockUser = { schoolId: 1 };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  schoolAPI.getDashboard.mockResolvedValue({ data: { dashboard: { studentCount: 1 } } });
  vehicleAPI.getStats.mockResolvedValue({ data: { stats: {} } });
  driverAPI.getAll.mockResolvedValue({ data: { drivers: [] } });
  tripAPI.getAll.mockResolvedValue({ data: { trips: dailyTrips, schoolDate: '2099-11-20' } });
  vehicleAPI.getLocation.mockImplementation(async id => {
    const value = entry(dailyTrips.find(trip => trip.vehicle.id === id));
    return { data: { trip: value.trip, location: value.location } };
  });
});
afterEach(() => { if (root) act(() => root.unmount()); container.remove(); jest.useRealTimers(); });

test.each([
  [{}, 'fresh'], [{ recordedAt: new Date(now - 120001).toISOString() }, 'stale'],
  [{ recordedAt: new Date(now + 30001).toISOString() }, 'stale'],
  [{ isLastKnown: true }, 'stale'], [{ isFresh: false }, 'stale'],
  [{ recordedAt: null }, 'stale'], [{ lat: null }, 'missing'], [{ lng: 181 }, 'missing'],
])('classifies GPS safely using timestamps, flags and coordinates: %p', (extra, expected) => {
  expect(fleetStatus(entry(undefined, extra), now)).toBe(expected);
});

test('shows a real geographical map, excludes stale and failed updates from live counts, and keeps bus selection', async () => {
  const entries = [entry(), entry(dailyTrips[1], { lat: 1, lng: 2, isLastKnown: true }), { ...entry(dailyTrips[2]), error: 'GPS service unavailable' }];
  await render(<FleetActivity entries={entries} now={now} />);
  expect(container.textContent).toContain('1 live');
  expect(container.querySelector('iframe').src).toContain('marker=0%2C0');
  await act(async () => button('Bus 2').click());
  expect(container.querySelector('iframe').src).toContain('marker=1%2C2');
  expect(container.textContent).toContain('This position is not live');
  await render(<FleetActivity entries={[{ ...entries[0] }, { ...entries[1], location: { ...entries[1].location, lng: 3 } }, entries[2]]} now={now} />);
  expect(container.querySelector('iframe').src).toContain('marker=1%2C3');
  await act(async () => button('Bus 3').click());
  expect(container.textContent).toContain('GPS service unavailable');
});

test('missing or invalid positions never become a geographical marker', async () => {
  await render(<FleetActivity entries={[entry(undefined, { lat: '' })]} now={now} />);
  expect(container.textContent).toContain('0 live');
  expect(container.querySelector('iframe')).toBeNull();
});

test('dashboard polls continuously, includes overnight active trips, and does not double-count pickup arrival', async () => {
  await render(<DashboardPage />);
  expect(tripAPI.getAll).toHaveBeenCalledWith({ date: 'today', includeActive: 'true' }, expect.objectContaining({ signal: expect.any(Object) }));
  expect(container.textContent).toContain('3 live');
  const label = [...container.querySelectorAll('div')].find(element => element.textContent === 'Not boarded');
  expect(label.parentElement.firstChild.textContent).toBe('1');
  await act(async () => jest.advanceTimersByTime(15000));
  expect(tripAPI.getAll).toHaveBeenCalledTimes(2);
  expect(vehicleAPI.getLocation).toHaveBeenCalledTimes(6);
});

test('GPS failures remain visible instead of reporting that everything is fine', async () => {
  vehicleAPI.getLocation.mockRejectedValue(new Error('GPS unavailable'));
  await render(<DashboardPage />);
  expect(container.textContent).toContain('0 live');
  expect(container.textContent).toContain('GPS needs attention');
  expect(container.textContent).toContain('GPS unavailable');
  expect(container.querySelector('iframe')).toBeNull();
});

test('freshness expires even while a later dashboard request is still pending', async () => {
  await render(<DashboardPage />);
  tripAPI.getAll.mockImplementation(() => new Promise(() => {}));
  await act(async () => jest.advanceTimersByTime(130000));
  expect(container.textContent).toContain('0 live');
  expect(container.textContent).toContain('GPS needs attention');
  expect(tripAPI.getAll).toHaveBeenCalledTimes(2);
});

test('period analytics refresh through the same polling cycle', async () => {
  await render(<DashboardPage />);
  await act(async () => {
    const select = container.querySelector('select[aria-label="Average period"]');
    select.value = 'weekly'; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(tripAPI.getAll).toHaveBeenCalledWith({ startDate: '2099-11-14', endDate: '2099-11-20' }, expect.any(Object));
  const count = tripAPI.getAll.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(15000));
  expect(tripAPI.getAll.mock.calls.length).toBe(count + 2);
});

test('a superseded school request cannot overwrite the newly selected school', async () => {
  let resolveOld;
  schoolAPI.getDashboard.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  await render(<DashboardPage />);
  mockUser = { schoolId: 2 };
  await render(<DashboardPage />);
  expect(container.textContent).toContain('3 live');
  const gpsCalls = vehicleAPI.getLocation.mock.calls.length;
  await act(async () => resolveOld({ data: { dashboard: { studentCount: 999 } } }));
  expect(container.textContent).not.toContain('999');
  expect(vehicleAPI.getLocation).toHaveBeenCalledTimes(gpsCalls);
});

test('unmount aborts requests and stops polling', async () => {
  await render(<DashboardPage />);
  const signal = tripAPI.getAll.mock.calls[0][1].signal;
  const count = tripAPI.getAll.mock.calls.length;
  act(() => root.unmount()); root = null;
  await act(async () => jest.advanceTimersByTime(45000));
  expect(signal.aborted).toBe(true);
  expect(tripAPI.getAll).toHaveBeenCalledTimes(count);
});
test('attention precedes metrics, shows every disruption, and routes review actions to the correct trip', async () => {
  const disrupted = Array.from({ length: 6 }, (_, index) => ({
    id: index + 10, scheduledDate: '2099-11-20', status: index === 5 ? 'cancelled' : 'delayed',
    route: { name: `Disrupted route ${index + 1}` }, vehicle: { id: index + 200 },
  }));
  tripAPI.getAll.mockResolvedValue({ data: { trips: disrupted, schoolDate: '2099-11-20' } });
  await render(<DashboardPage />);
  expect(container.textContent.indexOf('Needs attention')).toBeLessThan(container.textContent.indexOf('Total Students'));
  expect(container.textContent).toContain('6 alerts');
  expect(container.textContent).toContain('Trip cancelled');
  expect(container.textContent).toContain('Disrupted route 6');
  await act(async () => button('Review trip').click());
  expect(mockNavigate).toHaveBeenCalledWith('/trips/10');
  await act(async () => button('Review parent absences').click());
  expect(mockNavigate).toHaveBeenCalledWith('/absences');
});
test('disruption notification targets the selected trip using the school date, not the local UTC date', async () => {
  const { messageAPI } = require('../services/api');
  tripAPI.getAll.mockResolvedValue({ data: { trips: [{
    id: 44, status: 'missed', scheduledDate: '2099-11-21', route: { name: 'Morning route' },
  }], schoolDate: '2099-11-21' } });
  messageAPI.sendTripNotification.mockResolvedValue({ data: { message: 'Queued', tripCount: 1 } });
  await render(<DashboardPage />);
  await act(async () => button('Notify affected parents').click());
  expect(container.textContent).toContain('1 trips selected');
  await act(async () => {
    const field = container.querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, 'Synthetic disruption update');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => button('Send notification').click());
  expect(messageAPI.sendTripNotification).toHaveBeenCalledWith({
    content: 'Synthetic disruption update', allTrips: false, tripIds: [44], date: '2099-11-21',
  });
});
