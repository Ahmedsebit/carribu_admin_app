import React, { useState, useEffect, useCallback } from 'react';
import { Group, Button, TextInput, Paper, Alert, Badge, ActionIcon, Tooltip, Text, SimpleGrid, Box, ThemeIcon, Stack } from '@mantine/core';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconAlertCircle, IconCircleCheck, IconKey, IconSteeringWheel, IconBus, IconRoute } from '@tabler/icons-react';
import { driverAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { PageHeader, StatsGrid, StatCard, EmptyState, LoadingState } from '../components/ui';

const emptyForm = { firstName: '', lastName: '', email: '', phone: '' };

const DriversPage = () => {
  const navigate = useNavigate();
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

      {loading ? <Paper withBorder><LoadingState /></Paper> : filtered.length === 0 ? <Paper withBorder><EmptyState message="No drivers found." /></Paper> : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {filtered.map(d => {
            const routes = d.assignedRoutes || [];
            const vehicles = routes.filter(route => route.vehicle);
            return (
              <Paper key={d.id} withBorder radius="md" shadow="sm" p="md">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group align="flex-start" wrap="nowrap">
                    <ThemeIcon size={46} radius="xl" color="green" variant="light"><IconSteeringWheel size={23} /></ThemeIcon>
                    <Box style={{ minWidth: 0 }}>
                      <Button variant="subtle" size="compact-md" px={0} fw={800} onClick={() => navigate(`/drivers/${d.id}`)}>{d.firstName} {d.lastName}</Button>
                      <Text size="xs" c="dimmed" truncate>{d.email}</Text>
                      <Text size="xs" c="dimmed">{d.phone || 'No phone number'}</Text>
                    </Box>
                  </Group>
                  <Badge color={routes.length ? 'green' : 'gray'} variant="light">{routes.length ? 'Assigned' : 'Available'}</Badge>
                </Group>

                <SimpleGrid cols={2} spacing="xs" mt="lg">
                  <Paper bg="green.0" p="sm" ta="center">
                    <Group justify="center" gap={5}><IconRoute size={14} /><Text fw={800}>{routes.length}</Text></Group>
                    <Text fz={10} c="dimmed">Routes</Text>
                  </Paper>
                  <Paper bg="blue.0" p="sm" ta="center">
                    <Group justify="center" gap={5}><IconBus size={14} /><Text fw={800}>{vehicles.length}</Text></Group>
                    <Text fz={10} c="dimmed">Vehicles</Text>
                  </Paper>
                </SimpleGrid>

                <Stack gap="md" mt="md" mih={112}>
                  <Box>
                    <Text size="xs" c="dimmed">Assigned routes</Text>
                    {routes.length ? (
                      <Group gap={5} mt={4}>
                        {routes.map(route => <Badge key={route.id} color="green" variant="light">{route.name}</Badge>)}
                      </Group>
                    ) : <Text size="sm" c="dimmed">No route assigned</Text>}
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">Vehicles</Text>
                    {vehicles.length ? (
                      <Group gap={5} mt={4}>
                        {vehicles.map(route => <Badge key={route.id} color="blue" variant="light">{route.vehicle.plateNumber}</Badge>)}
                      </Group>
                    ) : <Text size="sm" c="dimmed">No vehicle assigned</Text>}
                  </Box>
                </Stack>

                <Group justify="space-between" mt="lg" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                  <Group gap={6}>
                    <Button variant="light" size="xs" onClick={() => navigate(`/drivers/${d.id}`)}>Statistics</Button>
                    <Tooltip label="Edit"><ActionIcon variant="light" onClick={() => openEdit(d)}><IconEdit size={16} /></ActionIcon></Tooltip>
                  </Group>
                  <Group gap={6}>
                    <Tooltip label="Reset Password"><ActionIcon variant="light" color="yellow" onClick={() => resetPassword(d.id)}><IconKey size={16} /></ActionIcon></Tooltip>
                    <Tooltip label="Delete"><ActionIcon variant="light" color="red" onClick={() => deleteDriver(d.id)}><IconTrash size={16} /></ActionIcon></Tooltip>
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}

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
