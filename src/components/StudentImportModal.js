import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Badge, Box, Button, FileInput, Group, Pagination, Paper, ScrollArea,
  SegmentedControl, Stack, Table, Text, Title,
} from '@mantine/core';
import { importAPI } from '../services/api';
import Modal from './Modal';

const PAGE_SIZE = 50;
const labels = {
  create: 'New students', created: 'Created students', update: 'Student updates',
  updated: 'Updated students', error: 'Rows with errors', unchanged: 'Unchanged students',
};
const fieldLabels = { firstName: 'First name', lastName: 'Last name', grade: 'Grade', parentId: 'Parent', admissionNumber: 'Admission number' };
const displayValue = (value, field, row, proposed = false) => {
  if (field === 'parentId') {
    if (proposed && row.data.parentPhone) return `${row.data.parentName} (${row.data.parentPhone})`;
    return value ? `Parent #${value}` : 'No parent';
  }
  return value === null || value === undefined || value === '' ? '(blank)' : String(value);
};

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function StudentImportModal({ isOpen, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [record, setRecord] = useState(null);
  const [freshPreview, setFreshPreview] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('');
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState('create');
  const [rowPage, setRowPage] = useState(1);
  const [history, setHistory] = useState({ imports: [], total: 0 });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [historyError, setHistoryError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setFile(null); setRecord(null); setFreshPreview(false);
      setError(''); setStage(''); setBusy(''); setHistoryPage(1);
    }
    return () => { requestId.current++; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setHistoryError('');
    importAPI.history(historyPage, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setHistory(data);
    }).catch(() => {
      if (!controller.signal.aborted) setHistoryError('Upload history could not be loaded.');
    });
    return () => controller.abort();
  }, [isOpen, historyPage, historyVersion]);

  const showRecord = (data, fresh = false) => {
    setRecord(data); setFreshPreview(fresh); setRowPage(1);
    const actions = data.status === 'completed' ? ['created', 'updated', 'error', 'unchanged'] : ['create', 'update', 'error', 'unchanged'];
    setTab(actions.find(action => data.rows.some(row => row.action === action)) || actions[0]);
  };
  const changeFile = selected => {
    requestId.current++;
    setFile(selected); setRecord(null); setFreshPreview(false); setError(''); setStage(''); setBusy('');
  };
  const preview = async () => {
    setError(''); setStage('');
    if (!file || !/\.(csv|xlsx|xls)$/i.test(file.name)) {
      setStage('file'); setError('Select a .csv, .xls or .xlsx file.'); return;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setStage('file'); setError('The file must be non-empty and no larger than 5 MB.'); return;
    }
    const current = ++requestId.current;
    setBusy('preview'); setRecord(null);
    try {
      const { data } = await importAPI.preview(file);
      if (current !== requestId.current) return;
      showRecord(data, true); setHistoryVersion(value => value + 1);
    } catch (e) {
      if (current !== requestId.current) return;
      setStage(e.response?.data?.stage || 'file');
      setError(e.response?.data?.error || 'File validation failed.');
    } finally { if (current === requestId.current) setBusy(''); }
  };
  const confirm = async () => {
    if (!record || !freshPreview || busy) return;
    const current = ++requestId.current;
    setBusy('import'); setError('');
    try {
      const { data } = await importAPI.importParentsStudents(record.id);
      if (current !== requestId.current) return;
      showRecord(data); setHistoryVersion(value => value + 1);
      onImported();
    } catch (e) {
      if (current !== requestId.current) return;
      setError(e.response?.data?.error || 'Import failed. You can retry safely.');
    } finally { if (current === requestId.current) setBusy(''); }
  };
  const viewHistory = async id => {
    const current = ++requestId.current;
    setBusy('history'); setError(''); setStage('');
    try {
      const { data } = await importAPI.getRecord(id);
      if (current === requestId.current) showRecord(data);
    } catch (e) {
      if (current === requestId.current) setError('The upload details could not be loaded.');
    } finally { if (current === requestId.current) setBusy(''); }
  };
  const download = async item => {
    try {
      const { data } = await importAPI.download(item.id);
      downloadBlob(data, item.filename);
    } catch (e) { setError('The original file could not be downloaded.'); }
  };
  const completed = record?.status === 'completed';
  const counts = record?.counts;
  const visibleRows = record?.rows.filter(row => row.action === tab) || [];
  const close = () => {
    if (busy === 'import') return;
    requestId.current++;
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} wide title="Import students and upload history" footer={<>
      <Button variant="default" onClick={close} disabled={busy === 'import'}>Close</Button>
      {freshPreview && !completed && <Button onClick={confirm} loading={busy === 'import'} disabled={!!busy || !(counts.studentsToCreate + counts.studentsToUpdate + counts.unchangedRows)}>
        Confirm import ({counts.studentsToCreate} new, {counts.studentsToUpdate} updates)
      </Button>}
    </>}>
      <Stack>
        <Text size="sm">Validate file type, then columns, then rows. Review the results before confirming. Error rows are skipped; existing students are matched by admission number within this school.</Text>
        <Group align="end">
          <FileInput label="CSV or Excel file" placeholder="Choose file" accept=".csv,.xls,.xlsx" value={file} onChange={changeFile} disabled={!!busy} style={{ flex: 1 }} />
          <Button onClick={preview} loading={busy === 'preview'} disabled={!file || !!busy}>Validate and preview</Button>
          <Button variant="subtle" disabled={!!busy} onClick={() => downloadBlob(new Blob([
            'Admission Number,First Name,Last Name,Grade,Parent Name,Parent Phone\r\n',
          ], { type: 'text/csv' }), 'student-import-template.csv')}>Download template</Button>
        </Group>
        <Text size="xs" c="dimmed">Maximum 5 MB / 5,000 students (XLSX: 25 MB expanded). Excel: one non-empty sheet. Required: Admission Number, First Name, Last Name (or Student Name). Optional: Grade, Parent Name and Parent Phone. One student per row; no formulas. Omitted Grade or blank parent details preserve existing values. A blank Grade cell clears the grade. Parents are matched by phone; existing parent profiles are not overwritten. New parents set their password in the app.</Text>
        <Text size="xs" c="dimmed">Validated previews and original files are retained in this school's upload history, even if you do not confirm them.</Text>
        {error && <Alert color="red" title={stage ? `${stage === 'columns' ? 'Column' : stage === 'file' ? 'File' : 'Import'} validation failed` : 'Import error'}>{error}</Alert>}
        {record && <Box>
          <Group mb="sm">
            <Text fw={700}>{record.filename}</Text>
            <Badge color={completed ? 'green' : 'blue'}>{completed ? 'Import complete' : 'Preview only - not imported'}</Badge>
            <Badge color="green">File type validated</Badge><Badge color="green">Columns validated</Badge>
          </Group>
          <Group mb="sm">
            {[
              ['Total rows', counts.totalRows], [completed ? 'Created' : 'New students', completed ? counts.studentsCreated : counts.studentsToCreate],
              [completed ? 'Updated' : 'Updates', completed ? counts.studentsUpdated : counts.studentsToUpdate],
              ['Error rows', counts.errorRows], ['Unchanged', counts.unchangedRows],
            ].map(([label, count]) => <Paper key={label} withBorder p="sm"><Text fw={700}>{count}</Text><Text size="xs">{label}</Text></Paper>)}
          </Group>
          {!!counts.errorRows && <Alert color="yellow" mb="sm">{counts.errorRows} rows have errors and {completed ? 'were' : 'will be'} skipped. Correct them in the source file and upload again.</Alert>}
          <SegmentedControl fullWidth value={tab} onChange={value => { setTab(value); setRowPage(1); }} data={
            (completed ? ['created', 'updated', 'error', 'unchanged'] : ['create', 'update', 'error', 'unchanged']).map(value => ({
              value, label: `${labels[value]} (${record.rows.filter(row => row.action === value).length})`,
            }))
          } />
          <ScrollArea mt="sm">
            <Table withTableBorder>
              <Table.Thead><Table.Tr>
                <Table.Th>Row</Table.Th><Table.Th>Admission no.</Table.Th><Table.Th>Student</Table.Th>
                <Table.Th>Grade</Table.Th><Table.Th>Parent / phone</Table.Th><Table.Th>Changes / errors</Table.Th>
              </Table.Tr></Table.Thead>
              <Table.Tbody>
                {visibleRows.slice((rowPage - 1) * PAGE_SIZE, rowPage * PAGE_SIZE).map(row => <Table.Tr key={row.rowNumber}>
                  <Table.Td>{row.rowNumber}</Table.Td><Table.Td>{row.data.admissionNumber || '-'}</Table.Td>
                  <Table.Td>{row.data.firstName} {row.data.lastName}</Table.Td>
                  <Table.Td>{Object.prototype.hasOwnProperty.call(row.data, 'grade') ? row.data.grade || '(blank)' : row.existing?.grade || '-'}</Table.Td>
                  <Table.Td>{row.data.parentName || (row.existing?.parentId ? 'Existing parent retained' : '-')}<br />{row.data.parentPhone}
                    {row.parentAction && <Text size="xs" c="dimmed">{row.parentAction}</Text>}
                  </Table.Td>
                  <Table.Td>{row.errors.length ? row.errors.map(message => <Text key={message} size="sm" c="red">{message}</Text>) :
                    Object.entries(row.changes).map(([field, change]) => <Text key={field} size="xs">{fieldLabels[field]}: {displayValue(change.from, field, row)} {'->'} {displayValue(change.to, field, row, true)}</Text>)}
                    {!row.errors.length && !Object.keys(row.changes).length && (row.action === 'unchanged' ? 'No student changes' : 'New student')}
                  </Table.Td>
                </Table.Tr>)}
                {!visibleRows.length && <Table.Tr><Table.Td colSpan={6}>No rows in this category.</Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          {visibleRows.length > PAGE_SIZE && <Pagination mt="sm" total={Math.ceil(visibleRows.length / PAGE_SIZE)} value={rowPage} onChange={setRowPage} />}
          {completed && <Alert color="green" mt="sm">Saved: {counts.studentsCreated} students created, {counts.studentsUpdated} updated, {counts.errorRows} error rows, {counts.unchangedRows} unchanged.</Alert>}
        </Box>}
        <Title order={4}>Upload history</Title>
        {historyError && <Alert color="red">{historyError}<Button variant="subtle" onClick={() => setHistoryVersion(value => value + 1)}>Retry</Button></Alert>}
        <ScrollArea>
          <Table withTableBorder>
            <Table.Thead><Table.Tr>
              <Table.Th>File / uploaded by</Table.Th><Table.Th>Date / status</Table.Th><Table.Th>Rows</Table.Th>
              <Table.Th>Created</Table.Th><Table.Th>Updated</Table.Th><Table.Th>Errors</Table.Th><Table.Th>Actions</Table.Th>
            </Table.Tr></Table.Thead>
            <Table.Tbody>
              {history.imports.map(item => <Table.Tr key={item.id}>
                <Table.Td>{item.filename}<Text size="xs" c="dimmed">{item.uploaderName}</Text></Table.Td>
                <Table.Td>{new Date(item.createdAt).toLocaleString()}<br /><Badge color={item.status === 'completed' ? 'green' : 'gray'}>{item.status === 'completed' ? 'Completed' : 'Preview only'}</Badge></Table.Td>
                <Table.Td>{item.counts.totalRows}</Table.Td><Table.Td>{item.counts.studentsCreated}</Table.Td>
                <Table.Td>{item.counts.studentsUpdated}</Table.Td><Table.Td>{item.counts.errorRows}</Table.Td>
                <Table.Td><Group gap="xs">
                  <Button size="xs" variant="light" onClick={() => viewHistory(item.id)} disabled={!!busy}>View</Button>
                  <Button size="xs" variant="subtle" onClick={() => download(item)} disabled={!!busy}>Original file</Button>
                </Group></Table.Td>
              </Table.Tr>)}
              {!history.imports.length && <Table.Tr><Table.Td colSpan={7}>No uploads recorded yet.</Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        {history.total > 20 && <Pagination total={Math.ceil(history.total / 20)} value={historyPage} onChange={setHistoryPage} />}
      </Stack>
    </Modal>
  );
}
