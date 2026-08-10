import React, { useState, useEffect, useCallback } from 'react';
import {
  Group, Button, TextInput, Select, Table, Paper, Alert, Badge, ActionIcon, Tooltip, NumberInput, Stack,
} from '@mantine/core';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { vehicleAPI } from '../services/api';
import Modal from '../components/Modal';
import { PageHeader, StatsGrid, StatCard, StatusBadge, EmptyState, LoadingState } from '../components/ui';

const empty = { plateNumber: '', make: '', model: '', year: '', capacity: 30, color: '', status: 'active', insuranceExpiry: '', lastServiceDate: '' };

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
      if (statusFilter) p.status = statusFilter;
      const [v, s] = await Promise.all([vehicleAPI.getAll(p), vehicleAPI.getStats()]);
      setVehicles(v.data.vehicles);
      setStats(s.data.stats);
    } catch (e) { /* keep previous state on failure */ } finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const openAdd = () => { setEditing(null); setForm(empty); setError(''); setModalOpen(true); };
  const openEdit = v => { setEditing(v); setForm({ plateNumber: v.plateNumber, make: v.make || '', model: v.model || '', year: v.year || '', capacity: v.capacity, color: v.color || '', status: v.status, insuranceExpiry: v.insuranceExpiry || '', lastServiceDate: v.lastServiceDate || '' }); setError(''); setModalOpen(true); };

  const save = async () => {
    setError(''); setSaving(true);
    try {
      if (editing) { await vehicleAPI.update(editing.id, form); setSuccess('Updated!'); }
      else { await vehicleAPI.create(form); setSuccess('Added!'); }
      setModalOpen(false); fetch(); setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Failed'); } finally { setSaving(false); }
  };

  const del = async id => {
    if (!window.confirm('Retire this vehicle?')) return;
    try { await vehicleAPI.delete(id); setSuccess('Retired.'); fetch(); setTimeout(() => setSuccess(''), 3000); } catch (e) { /* surfaced via reload */ }
  };

  const ch = (f, v) => setForm(p => ({ ...p, [f]: v }));

  return (
    <div>
      <PageHeader
        title="🚐 Vehicle Fleet Management"
        subtitle="Manage transport vehicles per school"
        actions={<Button leftSection={<IconPlus size={16} />} onClick={openAdd}>Add Vehicle</Button>}
      />

      {success && <Alert color="green" icon={<IconCircleCheck size={16} />} mb="md" withCloseButton onClose={() => setSuccess('')}>{success}</Alert>}

      {stats && (
        <StatsGrid>
          <StatCard icon="🚐" value={stats.total} label="Total" color="blue" />
          <StatCard icon="✅" value={stats.active} label="Active" color="green" />
          <StatCard icon="🔧" value={stats.maintenance} label="Maintenance" color="yellow" />
          <StatCard icon="🚫" value={stats.retired} label="Retired" color="red" />
        </StatsGrid>
      )}

      <Group mb="md">
        <TextInput placeholder="Search plate, make, model..." leftSection={<IconSearch size={16} />} value={search} onChange={e => setSearch(e.target.value)} w={280} />
        <Select
          placeholder="All Status"
          data={[{ value: '', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'retired', label: 'Retired' }]}
          value={statusFilter}
          onChange={v => setStatusFilter(v || '')}
          w={180}
          clearable={false}
        />
      </Group>

      <Paper withBorder radius="md" shadow="sm">
        {loading ? <LoadingState /> : vehicles.length === 0 ? <EmptyState message="No vehicles found." /> : (
          <Table.ScrollContainer minWidth={900}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Plate</Table.Th><Table.Th>Make/Model</Table.Th><Table.Th>Year</Table.Th><Table.Th>Capacity</Table.Th>
                  <Table.Th>Color</Table.Th><Table.Th>Status</Table.Th><Table.Th>Routes</Table.Th><Table.Th>Insurance</Table.Th><Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {vehicles.map(v => (
                  <Table.Tr key={v.id}>
                    <Table.Td fw={600}>{v.plateNumber}</Table.Td>
                    <Table.Td>{v.make} {v.model}</Table.Td>
                    <Table.Td>{v.year || '-'}</Table.Td>
                    <Table.Td>{v.capacity} seats</Table.Td>
                    <Table.Td>{v.color || '-'}</Table.Td>
                    <Table.Td><StatusBadge status={v.status}>{v.status}</StatusBadge></Table.Td>
                    <Table.Td>{v.routes?.length > 0 ? v.routes.map(r => r.name).join(', ') : <span style={{ color: 'var(--mantine-color-gray-5)' }}>Unassigned</span>}</Table.Td>
                    <Table.Td>{v.insuranceExpiry || '-'}</Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <Tooltip label="Edit"><ActionIcon variant="light" onClick={() => openEdit(v)}><IconEdit size={16} /></ActionIcon></Tooltip>
                        <Tooltip label="Retire"><ActionIcon variant="light" color="red" onClick={() => del(v.id)}><IconTrash size={16} /></ActionIcon></Tooltip>
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
        title={editing ? 'Edit Vehicle' : 'Add Vehicle'}
        footer={<><Button variant="default" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Update' : 'Add Vehicle'}</Button></>}
      >
        {error && <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>}
        <Group grow>
          <TextInput label="Plate Number *" placeholder="KDA 001A" value={form.plateNumber} onChange={e => ch('plateNumber', e.target.value)} />
          <NumberInput label="Capacity *" value={form.capacity} onChange={v => ch('capacity', v)} min={1} />
        </Group>
        <Group grow>
          <TextInput label="Make" placeholder="Toyota" value={form.make} onChange={e => ch('make', e.target.value)} />
          <TextInput label="Model" placeholder="HiAce" value={form.model} onChange={e => ch('model', e.target.value)} />
          <TextInput label="Year" placeholder="2023" value={form.year} onChange={e => ch('year', e.target.value)} />
        </Group>
        <Group grow>
          <TextInput label="Color" value={form.color} onChange={e => ch('color', e.target.value)} />
          <Select label="Status" data={[{ value: 'active', label: 'Active' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'retired', label: 'Retired' }]} value={form.status} onChange={v => ch('status', v)} />
        </Group>
        <Group grow>
          <TextInput type="date" label="Insurance Expiry" value={form.insuranceExpiry} onChange={e => ch('insuranceExpiry', e.target.value)} />
          <TextInput type="date" label="Last Service" value={form.lastServiceDate} onChange={e => ch('lastServiceDate', e.target.value)} />
        </Group>
      </Modal>
    </div>
  );
};

export default VehiclesPage;
