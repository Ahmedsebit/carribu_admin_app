import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Group, Button, TextInput, NumberInput, Table, Paper, Alert, Badge, ActionIcon, Tooltip, Text, Select,
  FileInput, ScrollArea, Title, Stack, Box, SimpleGrid, ThemeIcon,
} from '@mantine/core';
import {
  IconPlus, IconSearch, IconEdit, IconTrash, IconEye, IconAlertCircle, IconCircleCheck, IconUpload,
  IconUsers, IconPhone, IconMail, IconMapPin,
} from '@tabler/icons-react';
import { parentAPI, studentAPI, importAPI } from '../services/api';
import Modal from '../components/Modal';
import { PageHeader, StatsGrid, StatCard, EmptyState, LoadingState } from '../components/ui';

const LocationPicker = ({ lat, lng, onLocationChange }) => {
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markerRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(!!window.google?.maps);

  useEffect(() => {
    if (googleReady) return;
    const interval = setInterval(() => {
      if (window.google?.maps) { setGoogleReady(true); clearInterval(interval); }
    }, 500);
    return () => clearInterval(interval);
  }, [googleReady]);

  useEffect(() => {
    if (!googleReady || !mapRef.current) return;
    const center = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : { lat: -1.2921, lng: 36.8219 };

    if (!mapObjRef.current) {
      mapObjRef.current = new window.google.maps.Map(mapRef.current, { center, zoom: 14, mapTypeControl: false });
      mapObjRef.current.addListener('click', (e) => {
        onLocationChange(e.latLng.lat(), e.latLng.lng());
      });
    }

    if (markerRef.current) markerRef.current.setMap(null);
    if (lat && lng) {
      const pos = { lat: parseFloat(lat), lng: parseFloat(lng) };
      markerRef.current = new window.google.maps.Marker({ position: pos, map: mapObjRef.current, draggable: true });
      markerRef.current.addListener('dragend', () => {
        const p = markerRef.current.getPosition();
        onLocationChange(p.lat(), p.lng());
      });
      mapObjRef.current.panTo(pos);
    }
  }, [googleReady, lat, lng]);

  if (!googleReady) return <Text size="sm" c="dimmed">📍 Google Maps not loaded — enter coordinates manually above.</Text>;
  return <Box ref={mapRef} style={{ width: '100%', height: 220, borderRadius: 8, marginTop: 8, marginBottom: 8 }} />;
};

const emptyForm = { firstName: '', lastName: '', email: '', phone: '', pickupAddress: '', pickupLat: '', pickupLng: '' };

const ParentsPage = () => {
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detailModal, setDetailModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [newChildFirst, setNewChildFirst] = useState('');
  const [newChildLast, setNewChildLast] = useState('');
  const [newChildGrade, setNewChildGrade] = useState('');
  const [newChildAdmission, setNewChildAdmission] = useState('');
  const [addingChild, setAddingChild] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);

  const fetchParents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await parentAPI.getAll();
      setParents(data.parents);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchParents(); }, [fetchParents]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModalOpen(true); };
  const openEdit = p => { setEditing(p); setForm({ firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone || '', pickupAddress: p.pickupAddress || '', pickupLat: p.pickupLat || '', pickupLng: p.pickupLng || '' }); setError(''); setModalOpen(true); };

  const openDetail = async (p) => {
    try {
      const { data } = await parentAPI.getById(p.id);
      setSelectedParent(data.parent);
      const { data: studData } = await studentAPI.getAll();
      setAllStudents(studData.students.filter(s => !s.parentId));
      setDetailModal(true);
    } catch (e) { console.error(e); }
  };

  const save = async () => {
    setError('');
    if (!editing && !form.phone?.trim()) { setError('Phone number is required.'); return; }
    setSaving(true);
    try {
      if (editing) {
        await parentAPI.update(editing.id, form);
        setSuccess('Parent updated!');
      } else {
        await parentAPI.create(form);
        setSuccess('Parent added! They can set their password in the app using their phone number.');
      }
      setModalOpen(false); fetchParents();
      setTimeout(() => setSuccess(''), 5000);
    } catch (e) { setError(e.response?.data?.error || 'Failed to save'); } finally { setSaving(false); }
  };

  const deactivate = async id => {
    if (!window.confirm('Deactivate this parent?')) return;
    try { await parentAPI.delete(id); setSuccess('Parent deactivated.'); fetchParents(); setTimeout(() => setSuccess(''), 3000); } catch (e) { console.error(e); }
  };

  const assignStudent = async () => {
    if (!assignStudentId || !selectedParent) return;
    try {
      await studentAPI.update(assignStudentId, { parentId: selectedParent.id });
      setSuccess('Student assigned to parent!');
      const { data } = await parentAPI.getById(selectedParent.id);
      setSelectedParent(data.parent);
      const { data: studData } = await studentAPI.getAll();
      setAllStudents(studData.students.filter(s => !s.parentId));
      setAssignStudentId('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Failed to assign'); }
  };

  const removeStudent = async (studentId) => {
    if (!window.confirm('Remove student from this parent?')) return;
    try {
      await studentAPI.update(studentId, { parentId: null });
      const { data } = await parentAPI.getById(selectedParent.id);
      setSelectedParent(data.parent);
      setSuccess('Student removed from parent.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { console.error(e); }
  };

  const createChild = async () => {
    if (!newChildAdmission || !newChildFirst || !newChildLast) return;
    setAddingChild(true);
    try {
      await studentAPI.create({ admissionNumber: newChildAdmission, firstName: newChildFirst, lastName: newChildLast, grade: newChildGrade, parentId: selectedParent.id });
      setSuccess(`Student ${newChildFirst} ${newChildLast} created and linked!`);
      setNewChildAdmission(''); setNewChildFirst(''); setNewChildLast(''); setNewChildGrade('');
      const { data: parentData } = await parentAPI.getById(selectedParent.id);
      setSelectedParent(parentData.parent);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Failed to create student'); }
    finally { setAddingChild(false); }
  };

  const handleImportFileChange = async (file) => {
    if (!file) { setImportFile(null); setImportPreview(null); setImportResults(null); return; }
    setImportFile(file);
    setImportPreview(null);
    setImportResults(null);
    try {
      const { data } = await importAPI.preview(file);
      setImportPreview(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to preview CSV');
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setError('');
    try {
      const { data } = await importAPI.importParentsStudents(importFile);
      setImportResults(data);
      setSuccess(data.message);
      fetchParents();
      setTimeout(() => setSuccess(''), 8000);
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    setImportFile(null);
    setImportPreview(null);
    setImportResults(null);
  };

  const ch = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const filtered = parents
    .filter(p => {
      if (!search) return true;
      const s = search.toLowerCase();
      return `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) || p.email.toLowerCase().includes(s);
    })
    .sort((a, b) =>
      a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' }) ||
      a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' })
    );

  return (
    <div>
      <PageHeader
        title="👪 Parent Management"
        subtitle="Manage parents and assign children"
        actions={<>
          <Button variant="default" leftSection={<IconUpload size={16} />} onClick={() => setImportModalOpen(true)}>Import CSV</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>Add Parent</Button>
        </>}
      />

      {success && <Alert color="green" icon={<IconCircleCheck size={16} />} mb="md" withCloseButton onClose={() => setSuccess('')}>{success}</Alert>}

      <StatsGrid cols={3}>
        <StatCard icon="👪" value={parents.length} label="Total Parents" color="blue" />
        <StatCard icon="✅" value={parents.filter(p => p.children && p.children.length > 0).length} label="With Children" color="green" />
        <StatCard icon="⚠️" value={parents.filter(p => !p.children || p.children.length === 0).length} label="No Children Linked" color="yellow" />
      </StatsGrid>

      <Group mb="md">
        <TextInput placeholder="Search parents by name or email..." leftSection={<IconSearch size={16} />} value={search} onChange={e => setSearch(e.target.value)} w={320} />
      </Group>

      {loading ? <Paper withBorder radius="md"><LoadingState /></Paper> : filtered.length === 0 ? <Paper withBorder radius="md"><EmptyState message="No parents found." /></Paper> : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {filtered.map(p => {
            const children = [...(p.children || [])].sort((a, b) =>
              a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' }) ||
              a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' })
            );
            return (
              <Paper withBorder radius="md" shadow="sm" p="md" key={p.id}>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group align="flex-start" wrap="nowrap">
                    <ThemeIcon size={46} radius="xl" color="violet" variant="light"><IconUsers size={23} /></ThemeIcon>
                    <Box style={{ minWidth: 0 }}>
                      <Button variant="subtle" size="compact-md" px={0} fw={800} onClick={() => openDetail(p)}>{p.firstName} {p.lastName}</Button>
                      <Text size="xs" c="dimmed">{children.length} {children.length === 1 ? 'child' : 'children'} linked</Text>
                    </Box>
                  </Group>
                  <Badge color={children.length ? 'green' : 'orange'} variant="light">{children.length ? 'Linked' : 'No children'}</Badge>
                </Group>

                <Stack gap="sm" mt="lg">
                  <Group gap={8} wrap="nowrap"><ThemeIcon size="sm" color="gray" variant="light"><IconMail size={13} /></ThemeIcon><Text size="sm" truncate>{p.email}</Text></Group>
                  <Group gap={8} wrap="nowrap"><ThemeIcon size="sm" color="green" variant="light"><IconPhone size={13} /></ThemeIcon><Text size="sm">{p.phone || 'No phone number'}</Text></Group>
                  <Group gap={8} wrap="nowrap" align="flex-start"><ThemeIcon size="sm" color="red" variant="light"><IconMapPin size={13} /></ThemeIcon><Text size="sm" lineClamp={2}>{p.pickupAddress || 'No pickup address recorded'}</Text></Group>
                </Stack>

                <Box mt="md" mih={66}>
                  <Text size="xs" c="dimmed">Children</Text>
                  {children.length ? (
                    <Group gap={5} mt={5}>
                      {children.slice(0, 4).map(child => <Badge key={child.id} color="violet" variant="light">{child.firstName} {child.lastName}</Badge>)}
                      {children.length > 4 && <Badge color="violet" variant="light">+{children.length - 4}</Badge>}
                    </Group>
                  ) : <Text size="sm" c="dimmed">No children linked yet</Text>}
                </Box>

                <Group justify="space-between" mt="lg" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                  <Group gap={6}>
                    <Button size="xs" variant="light" leftSection={<IconEye size={14} />} onClick={() => openDetail(p)}>Manage</Button>
                    <Tooltip label="Edit parent"><ActionIcon variant="light" onClick={() => openEdit(p)}><IconEdit size={16} /></ActionIcon></Tooltip>
                  </Group>
                  <Tooltip label="Remove from school"><ActionIcon variant="light" color="red" onClick={() => deactivate(p.id)}><IconTrash size={16} /></ActionIcon></Tooltip>
                </Group>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Parent' : 'Add Parent'}
        footer={<><Button variant="default" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Update' : 'Add Parent'}</Button></>}
      >
        {error && <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>}
        <Group grow>
          <TextInput label="First Name *" value={form.firstName} onChange={e => ch('firstName', e.target.value)} />
          <TextInput label="Last Name *" value={form.lastName} onChange={e => ch('lastName', e.target.value)} />
        </Group>
        <Group grow>
          <TextInput label="Email *" type="email" value={form.email} onChange={e => ch('email', e.target.value)} disabled={!!editing} />
          <TextInput label="Phone *" placeholder="e.g. 0712345678" value={form.phone} onChange={e => ch('phone', e.target.value)} />
        </Group>
        <TextInput label="Pickup Address" placeholder="e.g. 123 Westlands Rd, Nairobi" value={form.pickupAddress} onChange={e => ch('pickupAddress', e.target.value)} />
        <Group grow>
          <NumberInput label="Pickup Latitude" decimalScale={6} value={form.pickupLat} onChange={v => ch('pickupLat', v)} placeholder="-1.2921" />
          <NumberInput label="Pickup Longitude" decimalScale={6} value={form.pickupLng} onChange={v => ch('pickupLng', v)} placeholder="36.8219" />
        </Group>
        <LocationPicker lat={form.pickupLat} lng={form.pickupLng} onLocationChange={(lat, lng) => setForm(p => ({ ...p, pickupLat: lat, pickupLng: lng }))} />
        {!editing && <Text size="xs" c="dimmed">A temporary password will be auto-generated and emailed to the parent.</Text>}
      </Modal>

      {/* Detail/Children Modal */}
      <Modal
        isOpen={detailModal}
        onClose={() => setDetailModal(false)}
        title={selectedParent ? `${selectedParent.firstName} ${selectedParent.lastName} — Children` : 'Parent Details'}
        footer={<Button variant="default" onClick={() => setDetailModal(false)}>Close</Button>}
      >
        {selectedParent && (
          <Stack gap="md">
            <Box>
              <Text size="sm" c="dimmed"><strong>Email:</strong> {selectedParent.email} | <strong>Phone:</strong> {selectedParent.phone || '-'}</Text>
              <Text size="sm" c="dimmed"><strong>Pickup:</strong> {selectedParent.pickupAddress || 'Not set'}</Text>
            </Box>

            <Box>
              <Title order={5} mb={8}>Children ({selectedParent.children?.length || 0})</Title>
              {selectedParent.children && selectedParent.children.length > 0 ? (
                <Table>
                  <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Grade</Table.Th><Table.Th>Action</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {[...selectedParent.children].sort((a, b) =>
                      a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' }) ||
                      a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' })
                    ).map(c => (
                      <Table.Tr key={c.id}>
                        <Table.Td>{c.firstName} {c.lastName}</Table.Td>
                        <Table.Td>{c.grade || '-'}</Table.Td>
                        <Table.Td><Button size="xs" color="red" variant="light" onClick={() => removeStudent(c.id)}>Remove</Button></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : <Text c="dimmed" size="sm">No children assigned yet.</Text>}
            </Box>

            <Box>
              <Title order={5} mb={8}>Assign Existing Student</Title>
              <Group>
                <Select
                  placeholder="Select unassigned student..."
                  data={allStudents.map(s => ({ value: String(s.id), label: `${s.firstName} ${s.lastName} (${s.grade || 'No grade'})` }))}
                  value={assignStudentId}
                  onChange={v => setAssignStudentId(v || '')}
                  style={{ flex: 1 }}
                  searchable
                />
                <Button onClick={assignStudent} disabled={!assignStudentId}>Assign</Button>
              </Group>
            </Box>

            <Box>
              <Title order={5} mb={8}>Add New Child</Title>
              <Group>
                <TextInput placeholder="Admission No. *" value={newChildAdmission} onChange={e => setNewChildAdmission(e.target.value.toUpperCase())} style={{ flex: 1, minWidth: 120 }} />
                <TextInput placeholder="First Name *" value={newChildFirst} onChange={e => setNewChildFirst(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
                <TextInput placeholder="Last Name *" value={newChildLast} onChange={e => setNewChildLast(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
                <TextInput placeholder="Grade" value={newChildGrade} onChange={e => setNewChildGrade(e.target.value)} w={90} />
                <Button onClick={createChild} loading={addingChild} disabled={!newChildAdmission || !newChildFirst || !newChildLast}>Add</Button>
              </Group>
            </Box>
          </Stack>
        )}
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={closeImportModal}
        wide
        title="📤 Import Parents & Students from CSV"
        footer={<>
          <Button variant="default" onClick={closeImportModal}>Close</Button>
          {importPreview && !importResults && (
            <Button onClick={handleImport} loading={importing}>
              Import {importPreview.totalParents} Parents & {importPreview.totalStudents} Students
            </Button>
          )}
        </>}
      >
        {error && <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>}

        {!importResults ? (
          <Stack gap="md">
            <Box>
              <FileInput label="Select CSV File" placeholder="Choose file..." accept=".csv" leftSection={<IconUpload size={16} />} value={importFile} onChange={handleImportFileChange} />
              <Text size="xs" c="dimmed" mt={4}>Upload a CSV with columns: Parent Name, Phone Number, Child(ren), Grade/Class</Text>
            </Box>

            <Alert color="blue" variant="light">
              Imported parents set their own password in the app using their phone number — no credentials are sent.
            </Alert>

            {importPreview && (
              <Box>
                <Group grow mb="md">
                  <Paper bg="blue.0" p="md" radius="md">
                    <Text size="xl" fw={700}>{importPreview.totalParents}</Text>
                    <Text size="xs" c="dimmed">Parents</Text>
                  </Paper>
                  <Paper bg="green.0" p="md" radius="md">
                    <Text size="xl" fw={700}>{importPreview.totalStudents}</Text>
                    <Text size="xs" c="dimmed">Students</Text>
                  </Paper>
                </Group>
                <ScrollArea.Autosize mah={300}>
                  <Table withTableBorder>
                    <Table.Thead><Table.Tr><Table.Th>Parent</Table.Th><Table.Th>Phone</Table.Th><Table.Th>Children</Table.Th></Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {importPreview.parents.map((p, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>{p.name}</Table.Td>
                          <Table.Td>{p.phone || <Text c="red" span size="sm">Missing</Text>}</Table.Td>
                          <Table.Td>{p.children.map(c => `${c.name} (${c.grade || '?'})`).join(', ')}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea.Autosize>
              </Box>
            )}
          </Stack>
        ) : (
          <Stack gap="md">
            <Alert color="green" icon={<IconCircleCheck size={16} />}>{importResults.message}</Alert>

            <Group>
              <Paper bg="blue.0" p="sm" radius="md"><Text size="sm"><strong>{importResults.parentsCreated}</strong> parents created</Text></Paper>
              <Paper bg="green.0" p="sm" radius="md"><Text size="sm"><strong>{importResults.studentsCreated}</strong> students created</Text></Paper>
            </Group>

            {importResults.created && importResults.created.length > 0 && (
              <Box>
                <Title order={5} mb={4}>Parents Added</Title>
                <Text size="xs" c="dimmed" mb={8}>They set their own password in the app using their phone number</Text>
                <ScrollArea.Autosize mah={250}>
                  <Table withTableBorder>
                    <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Phone</Table.Th></Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {importResults.created.map((c, i) => (
                        <Table.Tr key={i}><Table.Td>{c.name}</Table.Td><Table.Td><code>{c.phone || '-'}</code></Table.Td></Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea.Autosize>
              </Box>
            )}

            {importResults.skipped?.length > 0 && (
              <Box>
                <Title order={5} c="yellow.7" mb={4}>Skipped ({importResults.skipped.length})</Title>
                <ScrollArea.Autosize mah={100}>
                  <Stack gap={2}>{importResults.skipped.map((s, i) => <Text key={i} size="sm" c="dimmed">{s}</Text>)}</Stack>
                </ScrollArea.Autosize>
              </Box>
            )}

            {importResults.errors?.length > 0 && (
              <Box>
                <Title order={5} c="red" mb={4}>Errors ({importResults.errors.length})</Title>
                <ScrollArea.Autosize mah={100}>
                  <Stack gap={2}>{importResults.errors.map((e, i) => <Text key={i} size="sm" c="red">{e}</Text>)}</Stack>
                </ScrollArea.Autosize>
              </Box>
            )}
          </Stack>
        )}
      </Modal>
    </div>
  );
};

export default ParentsPage;
