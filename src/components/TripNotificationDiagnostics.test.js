import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TripNotificationDiagnostics from './TripNotificationDiagnostics';
import { tripAPI } from '../services/api';

jest.mock('../services/api', () => ({ tripAPI: { getNotifications: jest.fn() } }));
jest.mock('@mantine/core', () => {
  const React = require('react');
  const Container = ({ children }) => <div>{children}</div>;
  const Table = ({ children }) => <table>{children}</table>;
  for (const [name, tag] of Object.entries({ Thead: 'thead', Tbody: 'tbody', Tr: 'tr', Th: 'th', Td: 'td' })) {
    Table[name] = ({ children }) => React.createElement(tag, null, children);
  }
  Table.ScrollContainer = Container;
  return { Table, Alert: Container, Badge: Container, Group: Container, Paper: Container, Stack: Container, Text: Container, Title: Container };
});

let root, container;
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { delete global.IS_REACT_ACT_ENVIRONMENT; });
beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  tripAPI.getNotifications.mockResolvedValue({ data: { events: [] } });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
});
const render = async id => { await act(async () => { root.render(<TripNotificationDiagnostics tripId={id} />); }); };

test('shows provider acceptance without claiming parent delivery or read', async () => {
  tripAPI.getNotifications.mockResolvedValue({ data: { events: [
    { id: 1, event: 'trip-started', status: 'accepted', attempts: 1, providerResults: { fcm: { status: 'accepted' } } },
    { id: 2, event: 'student-dropped-off', status: 'unregistered', attempts: 2, lastError: 'NO_REGISTERED_DEVICE' },
  ] } });
  await render(5);
  expect(container.textContent).toContain('accepted: 1');
  expect(container.textContent).toContain('fcm: accepted');
  expect(container.textContent).toContain('unregistered: 1');
  expect(container.textContent).toContain('NO_REGISTERED_DEVICE');
  expect(container.textContent).toContain('not that the parent read it');
});
test('surfaces failures, recovers on polling, and cancels outstanding requests on unmount', async () => {
  tripAPI.getNotifications.mockRejectedValueOnce(new Error('offline'));
  await render(5);
  expect(container.textContent).toContain('could not be loaded');
  await act(async () => { jest.advanceTimersByTime(15000); });
  expect(container.textContent).toContain('No trip notifications queued yet');
  const signal = tripAPI.getNotifications.mock.calls[0][1].signal;
  act(() => root.unmount());
  expect(signal.aborted).toBe(true);
  root = createRoot(container);
});
test('a late response from the previous trip cannot replace the current diagnostics', async () => {
  let resolve;
  tripAPI.getNotifications.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  await render(5);
  await render(6);
  await act(async () => { resolve({ data: { events: [{ id: 1, event: 'old-event', status: 'failed', attempts: 1 }] } }); });
  expect(container.textContent).not.toContain('old-event');
});
