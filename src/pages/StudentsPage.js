import React, { useState, useEffect, useCallback } from 'react';
import { Group, Button, TextInput, Select, Table, Paper, Alert, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { studentAPI } from '../services/api';
import Modal from '../components/Modal';
import { PageHeader, StatsGrid, StatCard, EmptyState, LoadingState } from '../components/ui';

const empty = { admissionNumber: '', firstName: '', lastName: '', grade: '' };

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (search) p.search = search;
      if (gradeFilter) p.grade = gradeFilter;
      const { data } = await studentAPI.getAll(p);
      setStudents(data.students);
    } catch (e) { /* keep previous state on failure */ } finally { setLoading(false); }
  }, [search, gradeFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const openAdd = () => { setEditing(null); setForm(empty); setError(''); setModalOpen(true); };
  const openEdit = s => { setEditing(s); setForm({ admissionNumber: s.admissionNumber || '', firstName: s.firstName, lastName: s.lastName, grade: s.grade || '' }); setError(''); setModalOpen(true); };

  const save = async () => {
    setError(''); setSaving(true);
    try {
      if (editing) { await studentAPI.update(editing.id, form); setSuccess('Updated!'); }
      else { await studentAPI.create(form); setSuccess('Added!'); }
      setModalOpen(false); fetch(); setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Failed'); } finally { setSaving(false); }
  };

  const del = async id => {
    if (!window.confirm('Deactivate?')) return;
    try { await studentAPI.delete(id); setSuccess('Deactivated.'); fetch(); setTimeout(() => setSuccess(''), 3000); } catch (e) { /* surfaced via reload */ }
  };

  const ch = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const grades = [...new Set(students.map(s => s.grade).filter(Boolean))].sort();

  return (
    <div>
      <PageHeader
        title="🎒 Student Management"
        subtitle="Manage students and transport details"
        actions={<Button leftSection={<IconPlus size={16} />} onClick={openAdd}>Add Student</Button>}
      />

      {success && <Alert color="green" icon={<IconCircleCheck size={16} />} mb="md" withCloseButton onClose={() => setSuccess('')}>{success}</Alert>}

      <StatsGrid cols={3}>
        <StatCard icon="🎒" value={students.length} label="Total" color="blue" />
        <StatCard icon="🗺️" value={students.filter(s => s.routes?.length > 0).length} label="Assigned" color="green" />
        <StatCard icon="⚠️" value={students.filter(s => !s.routes || s.routes.length === 0).length} label="Unassigned" color="yellow" />
      </StatsGrid>

      <Group mb="md">
        <TextInput placeholder="Search students..." leftSection={<IconSearch size={16} />} value={search} onChange={e => setSearch(e.target.value)} w={280} />
        <Select
          placeholder="All Grades"
          data={[{ value: '', label: 'All Grades' }, ...grades.map(g => ({ value: g, label: g }))]}
          value={gradeFilter}
          onChange={v => setGradeFilter(v || '')}
          w={180}
        />
      </Group>

      <Paper withBorder radius="md" shadow="sm">
        {loading ? <LoadingState /> : students.length === 0 ? <EmptyState message="No students found." /> : (
          <Table.ScrollContainer minWidth={800}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr><Table.Th>Admission No.</Table.Th><Table.Th>Name</Table.Th><Table.Th>Grade</Table.Th><Table.Th>Parent</Table.Th><Table.Th>Pickup</Table.Th><Table.Th>Route(s)</Table.Th><Table.Th>Actions</Table.Th></Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {students.map(s => (
                  <Table.Tr key={s.id}>
                    <Table.Td fw={600}>{s.admissionNumber || '-'}</Table.Td>
                    <Table.Td fw={600}>{s.firstName} {s.lastName}</Table.Td>
                    <Table.Td>{s.grade || '-'}</Table.Td>
                    <Table.Td>{s.parent ? `${s.parent.firstName} ${s.parent.lastName}` : <span style={{ color: 'var(--mantine-color-gray-5)' }}>Not linked</span>}</Table.Td>
                    <Table.Td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.parent?.pickupAddress || '-'}</Table.Td>
                    <Table.Td>{s.routes?.length > 0 ? <Group gap={4}>{s.routes.map(r => <Badge key={r.id} color="green" variant="light">{r.name}</Badge>)}</Group> : <span style={{ color: 'var(--mantine-color-gray-5)' }}>None</span>}</Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <Tooltip label="Edit"><ActionIcon variant="light" onClick={() => openEdit(s)}><IconEdit size={16} /></ActionIcon></Tooltip>
                        <Tooltip label="Remove"><ActionIcon variant="light" color="red" onClick={() => del(s.id)}><IconTrash size={16} /></ActionIcon></Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Student' : 'Add Student'}
        footer={<><Button variant="default" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Update' : 'Add'}</Button></>}
      >
        {error && <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>}
        <TextInput label="Admission Number *" value={form.admissionNumber} onChange={e => ch('admissionNumber', e.target.value.toUpperCase())} required />
        <Group grow>
          <TextInput label="First Name *" value={form.firstName} onChange={e => ch('firstName', e.target.value)} />
          <TextInput label="Last Name *" value={form.lastName} onChange={e => ch('lastName', e.target.value)} />
        </Group>
        <TextInput label="Grade" placeholder="Grade 3" value={form.grade} onChange={e => ch('grade', e.target.value)} />
      </Modal>
    </div>
  );
};

export default StudentsPage;
