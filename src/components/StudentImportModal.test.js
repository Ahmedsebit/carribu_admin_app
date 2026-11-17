import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import StudentImportModal from './StudentImportModal';
import { importAPI } from '../services/api';

jest.mock('../services/api', () => ({
  importAPI: { preview: jest.fn(), importParentsStudents: jest.fn(), history: jest.fn(), getRecord: jest.fn(), download: jest.fn() },
}));
jest.mock('./Modal', () => ({ isOpen, children, footer }) => isOpen ? <div>{children}{footer}</div> : null);
jest.mock('@mantine/core', () => {
  const React = require('react');
  const Container = ({ children }) => <div>{children}</div>;
  const Table = ({ children }) => <table>{children}</table>;
  for (const [name, tag] of Object.entries({ Thead: 'thead', Tbody: 'tbody', Tr: 'tr', Th: 'th', Td: 'td' })) {
    Table[name] = ({ children, colSpan }) => React.createElement(tag, { colSpan }, children);
  }
  return {
    Table, Alert: ({ children, title }) => <div role="alert">{title}{children}</div>,
    Badge: Container, Box: Container, Group: Container, Paper: Container, ScrollArea: Container,
    Stack: Container, Text: Container, Title: Container, Pagination: Container,
    Button: ({ children, onClick, disabled }) => <button disabled={disabled} onClick={onClick}>{children}</button>,
    FileInput: ({ onChange, disabled }) => <input type="file" disabled={disabled} onChange={event => onChange(event.target.files[0])} />,
    SegmentedControl: ({ data, value, onChange }) => <select aria-label="Row category" value={value} onChange={event => onChange(event.target.value)}>
      {data.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>,
  };
});

const row = (action, number, extra = {}) => ({
  rowNumber: number, action, data: { admissionNumber: `ADM-${number}`, firstName: 'Test', lastName: `Student ${number}` },
  changes: {}, errors: [], ...extra,
});
const plan = {
  id: 'preview-1', filename: 'students.csv', status: 'previewed',
  counts: { totalRows: 3, studentsToCreate: 1, studentsToUpdate: 1, errorRows: 1, unchangedRows: 0, studentsCreated: 0, studentsUpdated: 0 },
  rows: [
    row('create', 2),
    row('update', 3, { changes: { grade: { from: 'Grade 1', to: 'Grade 2' } } }),
    row('error', 4, { errors: ['Admission number is required.'] }),
  ],
};
let root, container, onImported, onClose;
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { delete global.IS_REACT_ACT_ENVIRONMENT; });
beforeEach(() => {
  jest.resetAllMocks();
  importAPI.history.mockResolvedValue({ data: { imports: [], total: 0 } });
  importAPI.preview.mockResolvedValue({ data: plan });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  onImported = jest.fn(); onClose = jest.fn();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = async (isOpen = true) => act(async () => root.render(
  <StudentImportModal isOpen={isOpen} onClose={onClose} onImported={onImported} />
));
const click = async text => act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes(text)).click());
const selectFile = async (name = 'students.csv') => act(async () => {
  const input = container.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['test content'], name)] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
const selectCategory = async value => act(async () => {
  const input = container.querySelector('select');
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

test('requires validation before confirm and previews new students, updates and row errors', async () => {
  await render();
  expect(container.textContent).not.toContain('Confirm import');
  await selectFile();
  await click('Validate and preview');
  expect(importAPI.importParentsStudents).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Preview only - not imported');
  expect(container.textContent).toContain('Student 2');
  await selectCategory('update');
  expect(container.textContent).toContain('Grade: Grade 1 -> Grade 2');
  await selectCategory('error');
  expect(container.textContent).toContain('Admission number is required.');

  const completed = {
    ...plan, status: 'completed',
    counts: { ...plan.counts, studentsCreated: 1, studentsUpdated: 1, studentsToCreate: 0, studentsToUpdate: 0 },
    rows: plan.rows.map(item => ({ ...item, action: { create: 'created', update: 'updated' }[item.action] || item.action })),
  };
  importAPI.importParentsStudents.mockResolvedValue({ data: completed });
  await click('Confirm import');
  expect(importAPI.importParentsStudents).toHaveBeenCalledWith('preview-1');
  expect(onImported).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('1 students created, 1 updated, 1 error rows');
  expect(container.textContent).not.toContain('Confirm import');
});

test('changing the selected file invalidates the prior preview and invalid extensions never reach the API', async () => {
  await render();
  await selectFile();
  await click('Validate and preview');
  expect(container.textContent).toContain('Confirm import');
  await selectFile('invalid.pdf');
  expect(container.textContent).not.toContain('Confirm import');
  await click('Validate and preview');
  expect(importAPI.preview).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('Select a .csv, .xls or .xlsx file.');
});

test('shows column validation failures and never enables confirmation', async () => {
  importAPI.preview.mockRejectedValue({ response: { data: { stage: 'columns', error: 'Admission Number column is required.' } } });
  await render();
  await selectFile();
  await click('Validate and preview');
  expect(container.textContent).toContain('Column validation failed');
  expect(container.textContent).toContain('Admission Number column is required.');
  expect(container.textContent).not.toContain('Confirm import');
});

test('loads stored history and details without allowing a viewed record to be imported again', async () => {
  importAPI.history.mockResolvedValue({ data: { imports: [{
    ...plan, uploaderName: 'Admin Example', createdAt: '2026-11-17T06:00:00Z', status: 'completed',
    counts: { ...plan.counts, studentsCreated: 5, studentsUpdated: 2 },
  }], total: 1 } });
  importAPI.getRecord.mockResolvedValue({ data: { ...plan, status: 'completed' } });
  await render();
  expect(container.textContent).toContain('Admin Example');
  expect(container.textContent).toContain('Original file');
  await click('View');
  expect(importAPI.getRecord).toHaveBeenCalledWith('preview-1');
  expect(container.textContent).not.toContain('Confirm import');
});

test('ignores a preview response after closing and reopening the modal', async () => {
  let resolve;
  importAPI.preview.mockReturnValue(new Promise(done => { resolve = done; }));
  await render();
  await selectFile();
  await click('Validate and preview');
  await render(false);
  await render();
  await act(async () => resolve({ data: plan }));
  expect(container.textContent).not.toContain('Confirm import');
});
