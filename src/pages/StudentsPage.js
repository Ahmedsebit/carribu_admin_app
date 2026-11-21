import React, { useState, useEffect, useCallback } from 'react';
import { Group, Button, TextInput, Select, Paper, Alert, Badge, ActionIcon, Tooltip, SimpleGrid, Box, Text, ThemeIcon, Stack } from '@mantine/core';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconAlertCircle, IconCircleCheck, IconSchool, IconUsers, IconMapPin, IconRoute } from '@tabler/icons-react';
import { parentAPI, studentAPI } from '../services/api';
import Modal from '../components/Modal';
import StudentImportModal from '../components/StudentImportModal';
import { PageHeader, StatsGrid, StatCard, EmptyState, LoadingState } from '../components/ui';

const empty = { admissionNumber: '', firstName: '', lastName: '', grade: '', parentId: '' };

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (search) p.search = search;
      if (gradeFilter) p.grade = gradeFilter;
      if (statusFilter) p.status = statusFilter;
      const { data } = await studentAPI.getAll(p);
      setStudents(data.students);
    } catch (e) { setError(e.response?.data?.error || 'Students could not be loaded.'); } finally { setLoading(false); }
  }, [search, gradeFilter, statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);
  const fetchParents = useCallback(() => {
    return parentAPI.getAll()
      .then(({ data }) => setParents(
        (data.parents || []).filter(parent => parent.schoolAccessActive)
      ))
      .catch(() => setParents([]));
  }, []);
  useEffect(() => { fetchParents(); }, [fetchParents]);

  const openAdd = () => { setEditing(null); setForm(empty); setError(''); setModalOpen(true); };
  const openEdit = s => {
    setEditing(s);
    setForm({
      admissionNumber: s.admissionNumber || '',
      firstName: s.firstName,
      lastName: s.lastName,
      grade: s.grade || '',
      parentId: s.parentId ? String(s.parentId) : '',
    });
    setError('');
    setModalOpen(true);
  };

  const save = async () => {
    setError(''); setSaving(true);
    try {
      const payload = { ...form, parentId: form.parentId ? Number(form.parentId) : null };
      if (editing) { await studentAPI.update(editing.id, payload); setSuccess('Updated!'); }
      else { await studentAPI.create(payload); setSuccess('Added!'); }
      setModalOpen(false); fetch(); setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Failed'); } finally { setSaving(false); }
  };

  const del = async id => {
    if (!window.confirm('Deactivate this student? Route assignments will be kept, but future trips will exclude them. Active trips must first be completed or safely cancelled.')) return;
    setError('');
    try { await studentAPI.delete(id); setSuccess('Deactivated. Route assignments retained.'); fetch(); setTimeout(() => setSuccess(''), 3000); }
    catch (e) { setError(e.response?.data?.error || 'Student could not be deactivated.'); }
  };

  const reactivate = async id => {
    if (!window.confirm('Reactivate this student for future trips using their retained route assignments?')) return;
    setError('');
    try {
      await studentAPI.update(id, { isActive: true });
      setSuccess('Reactivated for future trips. Current trip rosters are unchanged.');
      fetch();
    } catch (e) { setError(e.response?.data?.error || 'Student could not be reactivated.'); }
  };

  const ch = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const grades = [...new Set(students.map(s => s.grade).filter(Boolean))].sort();
  const sortedStudents = [...students].sort((a, b) =>
    a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' }) ||
    a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' })
  );

  return (
    <div>
      <PageHeader
        title="🎒 Student Management"
        subtitle="Manage students and transport details"
        actions={<><Button variant="default" onClick={() => setImportOpen(true)}>Import / Upload history</Button><Button leftSection={<IconPlus size={16} />} onClick={openAdd}>Add Student</Button></>}
      />

      {success && <Alert color="green" icon={<IconCircleCheck size={16} />} mb="md" withCloseButton onClose={() => setSuccess('')}>{success}</Alert>}
      {error && !modalOpen && <Alert color="red" mb="md" withCloseButton onClose={() => setError('')}>{error}</Alert>}

      <StatsGrid cols={3}>
        <StatCard icon="🎒" value={students.length} label="Matching students" color="blue" />
        <StatCard icon="🗺️" value={students.filter(s => s.routes?.length > 0).length} label="Assigned" color="green" />
        <StatCard icon="⚠️" value={students.filter(s => !s.routes || s.routes.length === 0).length} label="Unassigned" color="yellow" />
      </StatsGrid>

      <Group mb="md">
        <Select label="Student status" data={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: '', label: 'All statuses' }]} value={statusFilter} onChange={value => setStatusFilter(value || '')} w={180} />
        <TextInput placeholder="Search students..." leftSection={<IconSearch size={16} />} value={search} onChange={e => setSearch(e.target.value)} w={280} />
        <Select
          placeholder="All Grades"
          data={[{ value: '', label: 'All Grades' }, ...grades.map(g => ({ value: g, label: g }))]}
          value={gradeFilter}
          onChange={v => setGradeFilter(v || '')}
          w={180}
        />
      </Group>

      {loading ? <Paper withBorder radius="md"><LoadingState /></Paper> : students.length === 0 ? <Paper withBorder radius="md"><EmptyState message="No students found." /></Paper> : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {sortedStudents.map(s => {
            const routes = s.routes || [];
            return (
              <Paper withBorder radius="md" shadow="sm" p="md" key={s.id}>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group align="flex-start" wrap="nowrap">
                    <ThemeIcon size={46} radius="xl" color="blue" variant="light"><IconSchool size={23} /></ThemeIcon>
                    <Box style={{ minWidth: 0 }}>
                      <Text fw={800} truncate>{s.firstName} {s.lastName}</Text>
                      <Badge color={s.isActive === false ? 'gray' : 'blue'} variant="light">{s.isActive === false ? 'Inactive' : 'Active'}</Badge>
                      <Badge mt={4} size="sm" variant="light" color="gray">{s.admissionNumber || 'No admission number'}</Badge>
                    </Box>
                  </Group>
                  {s.isActive === false && <Text size="xs" c="dimmed" mt="xs">Excluded from future trips. Route assignments retained for reactivation.</Text>}
                  <Badge color={routes.length ? 'green' : 'orange'} variant="light">{routes.length ? 'Assigned' : 'Unassigned'}</Badge>
                </Group>

                <SimpleGrid cols={2} spacing="xs" mt="lg">
                  <Paper bg="blue.0" p="sm">
                    <Text fz={10} c="dimmed">Grade</Text>
                    <Text size="sm" fw={750}>{s.grade || 'Not set'}</Text>
                  </Paper>
                  <Paper bg={s.parent ? 'green.0' : 'orange.0'} p="sm">
                    <Group gap={5} wrap="nowrap"><IconUsers size={14} /><Box style={{ minWidth: 0 }}><Text fz={10} c="dimmed">Parent</Text><Text size="xs" fw={750} truncate>{s.parent ? `${s.parent.firstName} ${s.parent.lastName}` : 'Not linked'}</Text></Box></Group>
                  </Paper>
                </SimpleGrid>

                <Stack gap="md" mt="md" mih={112}>
                  <Box>
                    <Group gap={5}><IconMapPin size={14} /><Text size="xs" c="dimmed">Pickup address</Text></Group>
                    <Text size="sm" lineClamp={2}>{s.parent?.pickupAddress || 'No pickup address recorded'}</Text>
                  </Box>
                  <Box>
                    <Group gap={5}><IconRoute size={14} /><Text size="xs" c="dimmed">Routes</Text></Group>
                    {routes.length ? <Group gap={5} mt={4}>{routes.map(route => <Badge key={route.id} color="green" variant="light">{route.name}</Badge>)}</Group> : <Text size="sm" c="dimmed">No route assigned</Text>}
                  </Box>
                </Stack>

                <Group justify="space-between" mt="lg" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                  <Button variant="light" size="xs" leftSection={<IconEdit size={15} />} onClick={() => openEdit(s)}>Edit student</Button>
                  {s.isActive === false
                    ? <Button variant="light" color="green" size="xs" onClick={() => reactivate(s.id)}>Reactivate</Button>
                    : <Tooltip label="Deactivate student"><ActionIcon aria-label={`Deactivate ${s.firstName} ${s.lastName}`} variant="light" color="red" onClick={() => del(s.id)}><IconTrash size={16} /></ActionIcon></Tooltip>}
                </Group>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}

      <StudentImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImported={() => { fetch(); fetchParents(); }} />
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
        <Select
          label="Parent"
          placeholder="Select a parent to link"
          data={parents.map(parent => ({
            value: String(parent.id),
            label: `${parent.firstName} ${parent.lastName} (${parent.phone || parent.email})`,
          }))}
          value={form.parentId || null}
          onChange={value => ch('parentId', value || '')}
          searchable
          clearable
          nothingFoundMessage="No active parents found"
        />
      </Modal>
    </div>
  );
};

export default StudentsPage;
