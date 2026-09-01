import React, { useState, useEffect, useCallback } from 'react';
import { Group, Button, TextInput, Table, Paper, Alert, Badge, ActionIcon, Tooltip, Text } from '@mantine/core';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconAlertCircle, IconCircleCheck, IconKey } from '@tabler/icons-react';
import { driverAPI } from '../services/api';
import Modal from '../components/Modal';
import { PageHeader, StatsGrid, StatCard, EmptyState, LoadingState } from '../components/ui';

const emptyForm = { firstName: '', lastName: '', email: '', phone: '' };

const DriversPage = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await driverAPI.getAll();
      setDrivers(data.drivers);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setTempPassword(''); setModalOpen(true); };
  const openEdit = d => { setEditing(d); setForm({ firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone || '' }); setError(''); setTempPassword(''); setModalOpen(true); };

  const save = async () => {
    setError(''); setSaving(true);
    try {
      if (editing) {
        await driverAPI.update(editing.id, form);
        setSuccess('Driver updated!');
      } else {
        const { data } = await driverAPI.create(form);
        if (data.tempPassword) setTempPassword(data.tempPassword);
        if (data.previewUrl) {
          setSuccess('Driver created! Email sent.');
          window.open(data.previewUrl, '_blank');
        } else {
          setSuccess('Driver created! Welcome email sent.');
        }
      }
      setModalOpen(false); fetchDrivers();
      setTimeout(() => setSuccess(''), 5000);
    } catch (e) { setError(e.response?.data?.error || 'Failed to save'); } finally { setSaving(false); }
  };

  const resetPassword = async id => {
    if (!window.confirm('Reset this driver\'s password? A new password will be generated and emailed to them.')) return;
    try {
      const { data } = await driverAPI.resetPassword(id);
      if (data.tempPassword) setTempPassword(data.tempPassword);
      if (data.previewUrl) window.open(data.previewUrl, '_blank');
      setSuccess(data.emailSent ? 'Password reset! New password emailed to driver.' : 'Password reset! (Email delivery could not be confirmed)');
      setTimeout(() => setSuccess(''), 5000);
    } catch (e) { setError(e.response?.data?.error || 'Failed to reset password'); setTimeout(() => setError(''), 5000); }
  };

  const deleteDriver = async id => {
    if (!window.confirm('Permanently delete this driver? They will be removed from assigned routes and trips.')) return;
    setError('');
    try {
      await driverAPI.delete(id);
      setSuccess('Driver deleted.');
      fetchDrivers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete driver');
      setTimeout(() => setError(''), 5000);
    }
  };

  const ch = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const filtered = drivers.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return `${d.firstName} ${d.lastName}`.toLowerCase().includes(s) || d.email.toLowerCase().includes(s);
  });

  return (
    <div>
      <PageHeader
        title="🚗 Driver Management"
        subtitle="Manage drivers and their assignments"
        actions={<Button leftSection={<IconPlus size={16} />} onClick={openAdd}>Add Driver</Button>}
      />

      {success && <Alert color="green" icon={<IconCircleCheck size={16} />} mb="md" withCloseButton onClose={() => setSuccess('')}>{success}</Alert>}
      {error && !modalOpen && <Alert color="red" icon={<IconAlertCircle size={16} />} mb="md" withCloseButton onClose={() => setError('')}>{error}</Alert>}
      {tempPassword && (
        <Alert color="yellow" mb="md" withCloseButton onClose={() => setTempPassword('')}>
          <Text size="sm"><strong>Temporary Password:</strong> {tempPassword}</Text>
          <Text size="xs" c="dimmed">This was included in the welcome email sent to the driver.</Text>
        </Alert>
      )}

      <StatsGrid cols={3}>
        <StatCard icon="🚗" value={drivers.length} label="Total Drivers" color="blue" />
        <StatCard icon="🗺️" value={drivers.filter(d => d.assignedRoutes && d.assignedRoutes.length > 0).length} label="With Routes" color="green" />
        <StatCard icon="⚠️" value={drivers.filter(d => !d.assignedRoutes || d.assignedRoutes.length === 0).length} label="Unassigned" color="yellow" />
      </StatsGrid>

      <Group mb="md">
        <TextInput placeholder="Search drivers by name or email..." leftSection={<IconSearch size={16} />} value={search} onChange={e => setSearch(e.target.value)} w={320} />
      </Group>

      <Paper withBorder radius="md" shadow="sm">
        {loading ? <LoadingState /> : filtered.length === 0 ? <EmptyState message="No drivers found." /> : (
          <Table.ScrollContainer minWidth={900}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr><Table.Th>Name</Table.Th><Table.Th>Email</Table.Th><Table.Th>Phone</Table.Th><Table.Th>Routes</Table.Th><Table.Th>Vehicle</Table.Th><Table.Th>Actions</Table.Th></Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map(d => (
                  <Table.Tr key={d.id}>
                    <Table.Td fw={600}>{d.firstName} {d.lastName}</Table.Td>
                    <Table.Td>{d.email}</Table.Td>
                    <Table.Td>{d.phone || '-'}</Table.Td>
                    <Table.Td>{d.assignedRoutes?.length > 0 ? <Group gap={4}>{d.assignedRoutes.map(r => <Badge key={r.id} color="green" variant="light">{r.name}</Badge>)}</Group> : <span style={{ color: 'var(--mantine-color-gray-5)' }}>None</span>}</Table.Td>
                    <Table.Td>{d.assignedRoutes?.find(r => r.vehicle) ? <Group gap={4}>{d.assignedRoutes.filter(r => r.vehicle).map(r => <Badge key={r.id} color="blue" variant="light">{r.vehicle.plateNumber}</Badge>)}</Group> : <span style={{ color: 'var(--mantine-color-gray-5)' }}>-</span>}</Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <Tooltip label="Edit"><ActionIcon variant="light" onClick={() => openEdit(d)}><IconEdit size={16} /></ActionIcon></Tooltip>
                        <Tooltip label="Reset Password"><ActionIcon variant="light" color="yellow" onClick={() => resetPassword(d.id)}><IconKey size={16} /></ActionIcon></Tooltip>
                        <Tooltip label="Delete"><ActionIcon variant="light" color="red" onClick={() => deleteDriver(d.id)}><IconTrash size={16} /></ActionIcon></Tooltip>
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
        title={editing ? 'Edit Driver' : 'Add Driver'}
        footer={<><Button variant="default" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Update' : 'Add Driver'}</Button></>}
      >
        {error && <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>}
        <Group grow>
          <TextInput label="First Name *" value={form.firstName} onChange={e => ch('firstName', e.target.value)} />
          <TextInput label="Last Name *" value={form.lastName} onChange={e => ch('lastName', e.target.value)} />
        </Group>
        <Group grow>
          <TextInput label="Email *" type="email" value={form.email} onChange={e => ch('email', e.target.value)} disabled={!!editing} />
          <TextInput label="Phone" value={form.phone} onChange={e => ch('phone', e.target.value)} />
        </Group>
        {!editing && <Text size="xs" c="dimmed">A temporary password will be auto-generated and emailed to the driver.</Text>}
      </Modal>
    </div>
  );
};

export default DriversPage;
