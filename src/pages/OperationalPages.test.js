import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import StudentsPage from './StudentsPage';
import TripDetailsPage from './TripDetailsPage';
import AbsenceRequestsPage from './AbsenceRequestsPage';
import ParentsPage from './ParentsPage';
import { studentAPI, parentAPI, tripAPI, absenceAPI } from '../services/api';

jest.mock('../services/api', () => ({
  studentAPI: { getAll: jest.fn(), update: jest.fn(), delete: jest.fn() },
  parentAPI: { getAll: jest.fn(), create: jest.fn(), update: jest.fn(), issueActivationInvitation: jest.fn() },
  tripAPI: { getDetails: jest.fn(), logAction: jest.fn(), end: jest.fn() },
  absenceAPI: { getAll: jest.fn(), confirm: jest.fn(), reject: jest.fn() },
}));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'school_admin' } }) }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(), useParams: () => ({ id: '30' }), Link: ({ to, children }) => <a href={to}>{children}</a>,
}));
jest.mock('../components/Modal', () => ({ isOpen, title, children, footer }) => isOpen ? <div role="dialog">{title}{children}{footer}</div> : null);
jest.mock('../components/StudentImportModal', () => () => null);
jest.mock('../components/VehicleLocationCard', () => () => null);
jest.mock('../components/TripNotificationDiagnostics', () => () => null);
jest.mock('../components/ui', () => ({
  EmptyState: ({ message }) => <div>{message}</div>, LoadingState: () => <div>Loading</div>,
  PageHeader: ({ title, subtitle, actions }) => <div>{title}{subtitle}{actions}</div>,
  StatsGrid: ({ children }) => <div>{children}</div>, StatCard: ({ label, value }) => <div>{label}{value}</div>,
  StatusBadge: ({ children }) => <div>{children}</div>,
}));
jest.mock('@tabler/icons-react', () => new Proxy({}, { get: () => () => null }));
jest.mock('@mantine/core', () => {
  const React = require('react');
  const Container = ({ children }) => <div>{children}</div>;
  const Table = ({ children }) => <table>{children}</table>;
  for (const [name, tag] of Object.entries({ Thead: 'thead', Tbody: 'tbody', Tr: 'tr', Th: 'th', Td: 'td' })) Table[name] = ({ children }) => React.createElement(tag, {}, children);
  Table.ScrollContainer = Container;
  const Grid = Container; Grid.Col = Container;
  const Button = ({ children, onClick, disabled, ...props }) => <button onClick={onClick} disabled={disabled} aria-label={props['aria-label']}>{children}</button>;
  return {
    Table, Grid, Button, ActionIcon: Button, Group: Container, Paper: Container, Stack: Container, Text: Container,
    Title: Container, Badge: Container, SimpleGrid: Container, Box: Container, ThemeIcon: Container, Tooltip: Container,
    Progress: Container, Anchor: Container, Alert: ({ children }) => <div role="alert">{children}</div>,
    Select: ({ data = [], label, value, onChange }) => <select aria-label={label} value={value || ''} onChange={event => onChange(event.target.value)}>{data.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>,
    TextInput: ({ label, value, onChange, type, readOnly }) => <input aria-label={label} type={type || 'text'} value={value} onChange={onChange} readOnly={readOnly} />,
    NumberInput: ({ label, value, onChange }) => <input aria-label={label} value={value} onChange={event => onChange(event.target.value)} />,
    Textarea: ({ label, value, onChange }) => <textarea aria-label={label} value={value} onChange={onChange} />,
  };
});

let root, container, children, trip, absence;
const render = async element => act(async () => root.render(element));
const button = text => [...container.querySelectorAll('button')].find(element => element.textContent.includes(text));
const click = async text => act(async () => button(text).click());
const change = async (selector, value) => act(async () => {
  const input = container.querySelector(selector);
  const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { delete global.IS_REACT_ACT_ENVIRONMENT; });
beforeEach(() => {
  jest.resetAllMocks(); jest.useFakeTimers(); jest.spyOn(window, 'confirm').mockReturnValue(true);
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  children = [
    { id: 20, firstName: 'Active', lastName: 'Child', isActive: true, routes: [{ id: 9, name: 'Retained route' }] },
    { id: 21, firstName: 'Inactive', lastName: 'Child', isActive: false, routes: [{ id: 9, name: 'Retained route' }] },
  ];
  studentAPI.getAll.mockImplementation(async params => ({ data: { students: children.filter(child => !params.status || child.isActive === (params.status === 'active')) } }));
  studentAPI.update.mockImplementation(async (id, data) => Object.assign(children.find(child => child.id === id), data));
  parentAPI.getAll.mockResolvedValue({ data: { parents: [] } });
  trip = {
    id: 30, status: 'in_progress', scheduledDate: '2099-11-20', type: 'morning_pickup',
    route: { name: 'Test route' }, stats: { totalStudents: 1, total: 1 }, canEnd: false,
    pickupList: [{ studentId: 20, studentName: 'Active Child', stopNumber: 1, status: 'arrived_pickup' }],
    logs: [], currentStop: null,
  };
  tripAPI.getDetails.mockImplementation(async () => ({ data: { trip } }));
  tripAPI.logAction.mockResolvedValue({});
  absence = {
    id: 60, student: { firstName: 'Active', lastName: 'Child' }, parent: { firstName: 'Test', lastName: 'Parent' },
    date: '2099-11-20', status: 'confirmed', confirmedTripIds: [30],
    matchingTrips: [
      { id: 30, routeName: 'Morning route', type: 'morning_pickup', confirmed: true, studentStatus: 'absent', canConfirm: false },
      { id: 31, routeName: 'Afternoon route', type: 'afternoon_dropoff', confirmed: false, studentStatus: 'pending', canConfirm: true },
    ],
  };
  absenceAPI.getAll.mockResolvedValue({ data: { requests: [absence], pages: 1 } });
  absenceAPI.confirm.mockResolvedValue({});
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.restoreAllMocks(); jest.useRealTimers(); });

test('inactive students are clearly distinguished and can reactivate their retained route assignments', async () => {
  await render(<StudentsPage />);
  expect(studentAPI.getAll).toHaveBeenCalledWith({ status: 'active' });
  expect(container.textContent).not.toContain('Inactive Child');
  await change('select[aria-label="Student status"]', 'inactive');
  expect(container.textContent).toContain('Excluded from future trips. Route assignments retained');
  expect(container.textContent).toContain('Retained route');
  await click('Reactivate');
  expect(studentAPI.update).toHaveBeenCalledWith(21, { isActive: true });
  expect(children[1].routes).toEqual([{ id: 9, name: 'Retained route' }]);
});

test.each([
  ['', '', null, null],
  ['0', '0', '0', '0'],
])('parent creation normalizes optional coordinates %p, %p without discarding zero', async (lat, lng, savedLat, savedLng) => {
  parentAPI.create.mockResolvedValue({});
  await render(<ParentsPage />);
  await click('Add Parent');
  for (const [label, value] of [
    ['First Name *', 'Synthetic'], ['Last Name *', 'Parent'], ['Email *', 'synthetic@example.test'],
    ['Phone *', '+254711000001'], ['Pickup Latitude', lat], ['Pickup Longitude', lng],
  ]) await change(`input[aria-label="${label}"]`, value);
  await act(async () => [...container.querySelectorAll('[role="dialog"] button')]
    .find(element => element.textContent === 'Add Parent').click());
  expect(parentAPI.create).toHaveBeenCalledWith(expect.objectContaining({
    pickupLat: savedLat, pickupLng: savedLng, phone: '+254711000001',
  }));
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

test('staff issue an expiring code only after confirmation and the code disappears when the modal closes', async () => {
  parentAPI.getAll.mockResolvedValue({ data: { parents: [
    { id: 5, firstName: 'Pending', lastName: 'Parent', isActive: true, schoolAccessActive: true, mustSetPassword: true, children: [] },
    { id: 6, firstName: 'Activated', lastName: 'Parent', isActive: true, schoolAccessActive: true, mustSetPassword: false, children: [] },
  ] } });
  parentAPI.issueActivationInvitation.mockResolvedValue({ data: {
    code: 'synthetic-code', expiresAt: '2099-11-21T12:00:00Z',
  } });
  await render(<ParentsPage />);
  expect([...container.querySelectorAll('button')].filter(item => item.textContent === 'Issue activation code')).toHaveLength(1);
  window.confirm.mockReturnValueOnce(false);
  await click('Issue activation code');
  expect(parentAPI.issueActivationInvitation).not.toHaveBeenCalled();
  await click('Issue activation code');
  expect(parentAPI.issueActivationInvitation).toHaveBeenCalledWith(5);
  expect(container.querySelector('input[aria-label="Activation code"]').value).toBe('synthetic-code');
  expect(container.textContent).toContain('verified parent');
  await click('Close');
  expect(container.querySelector('input[aria-label="Activation code"]')).toBeNull();
});

test('activation issuance failures are visible and do not show a fabricated code', async () => {
  parentAPI.getAll.mockResolvedValue({ data: { parents: [
    { id: 5, firstName: 'Pending', lastName: 'Parent', isActive: true, schoolAccessActive: true, mustSetPassword: true, children: [] },
  ] } });
  parentAPI.issueActivationInvitation.mockRejectedValue({ response: { data: { error: 'Parent access was revoked.' } } });
  await render(<ParentsPage />);
  await click('Issue activation code');
  expect(container.textContent).toContain('Parent access was revoked.');
  expect(container.querySelector('input[aria-label="Activation code"]')).toBeNull();
});

test('active-trip deactivation errors are visible and the student is not silently removed', async () => {
  studentAPI.delete.mockRejectedValue({ response: { data: { error: 'Complete the active trip first.' } } });
  await render(<StudentsPage />);
  await act(async () => container.querySelector('button[aria-label="Deactivate Active Child"]').click());
  expect(container.textContent).toContain('Complete the active trip first.');
  expect(container.textContent).toContain('Active Child');
});

test('staff attendance requires notes and explicitly records a selected absence outcome', async () => {
  await render(<TripDetailsPage />);
  expect(button('Complete resolved trip').disabled).toBe(true);
  await click('Record outcome');
  expect(button('Confirm outcome').disabled).toBe(true);
  await change('select[aria-label="Verified outcome"]', 'absent');
  await change('textarea', 'Verified directly with the parent.');
  await click('Confirm outcome');
  expect(tripAPI.logAction).toHaveBeenCalledWith('30', {
    studentId: 20, action: 'absent', phase: 'pickup', notes: 'Verified directly with the parent.',
    idempotencyKey: expect.stringMatching(/^staff:30:20:/),
  });
});

test('boarded students offer only a safe drop-off outcome, not absence', async () => {
  trip.pickupList[0].status = 'on_bus';
  await render(<TripDetailsPage />);
  await click('Record outcome');
  const select = container.querySelector('select[aria-label="Verified outcome"]');
  expect([...select.options].map(option => option.value)).toEqual(['check_out']);
  await change('textarea', 'Driver confirmed the safe handover.');
  await click('Confirm outcome');
  expect(tripAPI.logAction.mock.calls[0][1].phase).toBe('dropoff');
});

test('drop-offs are blocked in the UI until every pickup is resolved', async () => {
  trip.pickupList.push({ studentId: 21, studentName: 'Onboard Child', status: 'on_bus', stopNumber: 2 });
  await render(<TripDetailsPage />);
  const actions = [...container.querySelectorAll('button')].filter(element => element.textContent === 'Record outcome');
  expect(actions.map(element => element.disabled)).toEqual([false, true]);
});

test('reconciliation errors remain visible and do not manufacture a completion', async () => {
  tripAPI.logAction.mockRejectedValue({ response: { data: { error: 'Student already boarded.' } } });
  await render(<TripDetailsPage />);
  await click('Record outcome');
  await change('textarea', 'Parent report needs reconciliation.');
  await click('Confirm outcome');
  expect(container.textContent).toContain('Student already boarded.');
  expect(tripAPI.end).not.toHaveBeenCalled();
});

test('historical records show the staff actor and warn when original expected totals are unknown', async () => {
  trip.status = 'completed';
  trip.rosterSource = 'recorded_logs';
  trip.logs = [{ id: 1, action: 'absent', timestamp: new Date().toISOString(), recordedBy: { firstName: 'School', lastName: 'Staff', role: 'school_admin' } }];
  await render(<TripDetailsPage />);
  expect(container.textContent).toContain('original expected roster cannot be reconstructed');
  expect(container.textContent).toContain('Recorded by School Staff (school admin)');
  expect(button('Record outcome')).toBeUndefined();
});

test('the review queue keeps afternoon follow-up visible after morning confirmation', async () => {
  await render(<AbsenceRequestsPage />);
  expect(container.textContent).toContain('Already confirmed for this trip');
  await click('Confirm absence for this trip');
  expect(container.textContent).toContain('Trip #31 (Afternoon)');
  expect(button('Confirm decision').disabled).toBe(true);
  await change('textarea', 'Parent confirmed the afternoon absence.');
  await click('Confirm decision');
  expect(absenceAPI.confirm).toHaveBeenCalledWith(60, { tripId: 31, notes: 'Parent confirmed the afternoon absence.' });
});

test('requests without matching active trips stay in the review queue without automatic attendance', async () => {
  absence.status = 'pending'; absence.confirmedTripIds = []; absence.matchingTrips = [];
  await render(<AbsenceRequestsPage />);
  expect(container.textContent).toContain('Awaiting a matching active trip');
  expect(button('Confirm absence for this trip')).toBeUndefined();
  expect(absenceAPI.confirm).not.toHaveBeenCalled();
});

test('rejecting a request requires an explicit note and does not call trip attendance APIs', async () => {
  absence.status = 'pending'; absence.confirmedTripIds = []; absence.matchingTrips = [];
  absenceAPI.reject.mockResolvedValue({});
  await render(<AbsenceRequestsPage />);
  await click('Reject request');
  await change('textarea', 'Parent corrected the absence date.');
  await click('Confirm decision');
  expect(absenceAPI.reject).toHaveBeenCalledWith(60, { notes: 'Parent corrected the absence date.' });
  expect(tripAPI.logAction).not.toHaveBeenCalled();
});
