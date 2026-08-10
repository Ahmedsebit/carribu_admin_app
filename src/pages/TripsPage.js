import React, { useState, useEffect } from 'react';
import {
  Group, Button, TextInput, Select, Table, Paper, Alert, Badge, Text, Title, Stack, Box, Grid, Anchor,
} from '@mantine/core';
import {
  IconPlus, IconAlertCircle, IconCircleCheck, IconPlayerPlay, IconPlayerStop, IconBroadcast, IconClipboardList,
} from '@tabler/icons-react';
import { tripAPI, routeAPI, locationAPI } from '../services/api';
import Modal from '../components/Modal';
import { classifyTimeliness } from '../utils/tripTimeliness';
import { PageHeader, StatsGrid, StatCard, StatusBadge, EmptyState, LoadingState } from '../components/ui';

const TripsPage = () => {
  const [trips, setTrips] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tripLogs, setTripLogs] = useState([]);
  const [liveModalOpen, setLiveModalOpen] = useState(false);
  const [liveTrip, setLiveTrip] = useState(null);
  const [liveLogs, setLiveLogs] = useState([]);
  const [busLoc, setBusLoc] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [form, setForm] = useState({ routeId: '', type: 'morning_pickup', scheduledDate: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [timelinessFilter, setTimelinessFilter] = useState('');

  const fetch = async () => {
    try {
      const p = {};
      if (dateFilter) p.date = dateFilter;
      if (statusFilter) p.status = statusFilter;
      const [t, r] = await Promise.all([tripAPI.getAll(p), routeAPI.getAll()]);
      setTrips(t.data.trips);
      setRoutes(r.data.routes.filter(r => r.isActive));
    } catch (e) { /* keep previous state on failure */ } finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [dateFilter, statusFilter]);
  // Auto-refresh every 15 seconds to pick up driver actions
  useEffect(() => { const interval = setInterval(fetch, 15000); return () => clearInterval(interval); }, [dateFilter, statusFilter]);

  const schedule = async () => {
    setError(''); setSaving(true);
    try { await tripAPI.create(form); setSuccess('Scheduled!'); setModalOpen(false); fetch(); setTimeout(() => setSuccess(''), 3000); }
    catch (e) { setError(e.response?.data?.error || 'Failed'); } finally { setSaving(false); }
  };
  const start = async id => {
    setError('');
    try {
      await tripAPI.start(id);
      setSuccess('Started!');
      fetch();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to start trip.');
    }
  };
  const end = async id => { try { await tripAPI.end(id); setSuccess('Completed!'); fetch(); setTimeout(() => setSuccess(''), 3000); } catch (e) { /* surfaced via reload */ } };
  const viewLogs = async trip => { setSelectedTrip(trip); try { const { data } = await tripAPI.getLogs(trip.id); setTripLogs(data.logs); setLogModalOpen(true); } catch (e) { /* surfaced via reload */ } };
  const fetchLive = async trip => {
    const id = trip.id;
    const results = await Promise.allSettled([tripAPI.getLogs(id), locationAPI.getBusLocation(id)]);
    if (results[0].status === 'fulfilled') setLiveLogs(results[0].value.data.logs || []);
    setBusLoc(results[1].status === 'fulfilled' ? results[1].value.data.location : null);
  };
  const openLive = async trip => {
    setLiveTrip(trip); setLiveLogs([]); setBusLoc(null); setLiveError(''); setLiveLoading(true); setLiveModalOpen(true);
    try { await fetchLive(trip); } catch (e) { setLiveError('Failed to load live data.'); } finally { setLiveLoading(false); }
  };
  const closeLive = () => { setLiveModalOpen(false); setLiveTrip(null); setBusLoc(null); setLiveLogs([]); };
  // Poll live trip data every 10 seconds while the live view is open
  useEffect(() => {
    if (!liveModalOpen || !liveTrip) return;
    const i = setInterval(() => fetchLive(liveTrip), 10000);
    return () => clearInterval(i);
  }, [liveModalOpen, liveTrip]);

  const studentStatus = (studentId) => {
    const sl = liveLogs.filter(l => l.studentId === studentId);
    if (sl.find(l => l.action === 'absent')) return { key: 'absent', label: 'Absent', icon: '❌' };
    if (sl.find(l => l.action === 'check_out')) return { key: 'dropped', label: 'Dropped off', icon: '📤' };
    if (sl.find(l => l.action === 'check_in')) return { key: 'onbus', label: 'Picked up', icon: '✅' };
    if (sl.find(l => l.action === 'arrived')) return { key: 'arrived', label: 'Bus arrived', icon: '📍' };
    return { key: 'waiting', label: 'Waiting', icon: '⏳' };
  };
  const fmtTime = t => t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  const fmtDur = ms => { if (ms == null || ms < 0) return '—'; const s = Math.round(ms / 1000); if (s < 60) return `${s}s`; const m = Math.floor(s / 60); return `${m}m ${s % 60}s`; };
  // Build a per-student pickup report from raw trip logs (for the selected trip's roster)
  const buildReport = () => {
    const roster = [...(selectedTrip?.route?.students || [])].sort((a, b) => (a.RouteStudent?.stopOrder || 0) - (b.RouteStudent?.stopOrder || 0));
    const first = (sid, act) => { const l = tripLogs.filter(x => x.studentId === sid && x.action === act).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0]; return l ? l.timestamp : null; };
    return roster.map(s => {
      const arrived = first(s.id, 'arrived');
      const picked = first(s.id, 'check_in');
      const dropped = first(s.id, 'check_out');
      const absent = !!first(s.id, 'absent');
      const wait = (arrived && picked) ? (new Date(picked) - new Date(arrived)) : null;
      let status;
      if (absent) status = { key: 'absent', label: 'Absent', icon: '❌' };
      else if (dropped) status = { key: 'dropped', label: 'Dropped off', icon: '📤' };
      else if (picked) status = { key: 'onbus', label: 'Picked up', icon: '✅' };
      else if (arrived) status = { key: 'arrived', label: 'Bus arrived', icon: '📍' };
      else status = { key: 'waiting', label: 'No record', icon: '—' };
      return { student: s, arrived, picked, dropped, absent, wait, status };
    });
  };
  const st = { total: trips.length, completed: trips.filter(t => t.status === 'completed').length, inProgress: trips.filter(t => t.status === 'in_progress').length, scheduled: trips.filter(t => t.status === 'scheduled').length };
  const activeTrips = trips.filter(t => t.status === 'in_progress');
  const studentSt = activeTrips.reduce((acc, t) => { const s = t.studentStats || {}; acc.total += s.total || 0; acc.onBus += s.onBus || 0; acc.droppedOff += s.droppedOff || 0; acc.absent += s.absent || 0; acc.arrived += s.arrived || 0; acc.pending += s.pending || 0; return acc; }, { total: 0, onBus: 0, droppedOff: 0, absent: 0, arrived: 0, pending: 0 });
  const fmtClock = t => { if (!t) return '—'; const [h, m] = String(t).split(':'); const hr = parseInt(h, 10); const ampm = hr >= 12 ? 'PM' : 'AM'; const h12 = hr % 12 || 12; return `${h12}:${m} ${ampm}`; };
  const timeliness = t => classifyTimeliness(t);
  const notStartedCount = trips.filter(t => timeliness(t)?.key === 'not_started').length;
  const delayedCount = trips.filter(t => timeliness(t)?.key === 'delayed').length;
  const visibleTrips = timelinessFilter ? trips.filter(t => timeliness(t)?.key === timelinessFilter) : trips;

  return (
    <div>
      <PageHeader
        title="🚌 Trip Management"
        subtitle="Schedule and track daily trips"
        actions={<Button leftSection={<IconPlus size={16} />} onClick={() => { setForm({ routeId: '', type: 'morning_pickup', scheduledDate: new Date().toISOString().split('T')[0], scheduledTime: '' }); setError(''); setModalOpen(true); }}>Schedule Trip</Button>}
      />
      {success && <Alert color="green" icon={<IconCircleCheck size={16} />} mb="md" withCloseButton onClose={() => setSuccess('')}>{success}</Alert>}
      {error && !modalOpen && <Alert color="red" icon={<IconAlertCircle size={16} />} mb="md" withCloseButton onClose={() => setError('')}>{error}</Alert>}

      <StatsGrid cols={6}>
        <StatCard icon="🚌" value={st.total} label="Total Trips" color="blue" />
        <StatCard icon="✅" value={st.completed} label="Completed" color="green" />
        <StatCard icon="🔄" value={st.inProgress} label="In Progress" color="yellow" />
        <StatCard icon="📅" value={st.scheduled} label="Scheduled" color="red" />
        <StatCard icon="⚠️" value={notStartedCount} label="Not Started" color="red" />
        <StatCard icon="⏱️" value={delayedCount} label="Delayed" color="yellow" />
      </StatsGrid>

      {activeTrips.length > 0 && (
        <StatsGrid cols={5}>
          <StatCard icon="🎒" value={studentSt.total} label="Total Students" color="blue" />
          <StatCard icon="📍" value={studentSt.arrived} label="Arrived" color="yellow" />
          <StatCard icon="🚌" value={studentSt.onBus} label="On Bus" color="blue" />
          <StatCard icon="✅" value={studentSt.droppedOff} label="Dropped Off" color="green" />
          <StatCard icon="❌" value={studentSt.absent} label="Absent" color="red" />
        </StatsGrid>
      )}

      <Group mb="md">
        <TextInput type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} w={170} />
        <Select
          placeholder="All"
          data={[{ value: '', label: 'All' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'delayed', label: 'Delayed' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }, { value: 'missed', label: 'Not Started' }]}
          value={statusFilter}
          onChange={v => setStatusFilter(v || '')}
          w={170}
        />
        <Select
          placeholder="All timeliness"
          data={[{ value: '', label: 'All timeliness' }, { value: 'not_started', label: '⚠️ Not started' }, { value: 'delayed', label: '⏱️ Delayed' }, { value: 'on_time', label: '✅ On time' }, { value: 'upcoming', label: '🕒 Upcoming' }]}
          value={timelinessFilter}
          onChange={v => setTimelinessFilter(v || '')}
          w={190}
        />
        <Button variant="default" size="sm" onClick={() => { setDateFilter(''); setStatusFilter(''); setTimelinessFilter(''); }}>Clear</Button>
      </Group>

      <Paper withBorder radius="md" shadow="sm">
        {loading ? <LoadingState /> : visibleTrips.length === 0 ? <EmptyState message="No trips found." /> : (
          <Table.ScrollContainer minWidth={1100}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Route</Table.Th><Table.Th>Vehicle</Table.Th><Table.Th>Driver</Table.Th><Table.Th>Type</Table.Th><Table.Th>Date</Table.Th>
                  <Table.Th>Time</Table.Th><Table.Th>Timeliness</Table.Th><Table.Th>Students</Table.Th><Table.Th>Status</Table.Th><Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleTrips.map(t => {
                  const tl = timeliness(t);
                  return (
                    <Table.Tr key={t.id}>
                      <Table.Td fw={600}>{t.route?.name || '-'}</Table.Td>
                      <Table.Td>{t.vehicle?.plateNumber || '-'}</Table.Td>
                      <Table.Td>{t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '-'}</Table.Td>
                      <Table.Td><Badge color={t.type === 'morning_pickup' ? 'yellow' : 'blue'} variant="light">{t.type === 'morning_pickup' ? '🌅 Morning' : '🌇 Afternoon'}</Badge></Table.Td>
                      <Table.Td>{t.scheduledDate}</Table.Td>
                      <Table.Td>{t.scheduledTime ? `🕒 ${fmtClock(t.scheduledTime)}` : '—'}</Table.Td>
                      <Table.Td>{tl ? <StatusBadge status={tl.key}>{tl.icon} {tl.label}</StatusBadge> : '—'}</Table.Td>
                      <Table.Td>{t.studentStats ? <Text size="xs">{t.studentStats.total} total{t.status === 'in_progress' ? ` · ${t.studentStats.onBus} on bus · ${t.studentStats.droppedOff} done · ${t.studentStats.absent} absent` : ''}</Text> : '-'}</Table.Td>
                      <Table.Td><StatusBadge status={t.status}>{t.status.replace('_', ' ')}</StatusBadge></Table.Td>
                      <Table.Td>
                        <Group gap={6}>
                          {(t.status === 'scheduled' || t.status === 'delayed') && <Button size="xs" color="green" leftSection={<IconPlayerPlay size={14} />} onClick={() => start(t.id)}>Start</Button>}
                          {t.status === 'in_progress' && <Button size="xs" leftSection={<IconBroadcast size={14} />} onClick={() => openLive(t)}>Live</Button>}
                          {t.status === 'in_progress' && <Button size="xs" variant="default" leftSection={<IconPlayerStop size={14} />} onClick={() => end(t.id)}>End</Button>}
                          <Button size="xs" variant="default" leftSection={<IconClipboardList size={14} />} onClick={() => viewLogs(t)}>Report</Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Schedule Trip"
        footer={<><Button variant="default" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={schedule} loading={saving}>Schedule</Button></>}
      >
        {error && <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>}
        <Select label="Route *" placeholder="-- Select --" data={routes.map(r => ({ value: String(r.id), label: `${r.name} (${r.students?.length || 0} students)` }))} value={form.routeId} onChange={v => setForm(p => ({ ...p, routeId: v || '' }))} searchable />
        <Group grow>
          <Select label="Type *" data={[{ value: 'morning_pickup', label: '🌅 Morning' }, { value: 'afternoon_dropoff', label: '🌇 Afternoon' }]} value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))} />
          <TextInput type="date" label="Date *" value={form.scheduledDate} onChange={e => setForm(p => ({ ...p, scheduledDate: e.target.value }))} />
          <TextInput type="time" label="Time" value={form.scheduledTime} onChange={e => setForm(p => ({ ...p, scheduledTime: e.target.value }))} />
        </Group>
      </Modal>

      <Modal isOpen={logModalOpen} onClose={() => setLogModalOpen(false)} wide title={`📋 Trip Report — ${selectedTrip?.route?.name || ''}`}>
        {(() => {
          const rep = buildReport();
          const picked = rep.filter(r => r.picked || r.dropped).length;
          const absent = rep.filter(r => r.absent).length;
          const waits = rep.filter(r => r.wait != null).map(r => r.wait);
          const avgWait = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null;
          return (
            <Stack gap="md">
              <Group gap="lg" c="dimmed" style={{ fontSize: 14 }}>
                <Text size="sm"><strong>{selectedTrip?.scheduledDate || ''}</strong> · <Badge color={selectedTrip?.type === 'morning_pickup' ? 'yellow' : 'blue'} variant="light">{selectedTrip?.type === 'morning_pickup' ? '🌅 Morning' : '🌇 Afternoon'}</Badge></Text>
                <Text size="sm">👤 {selectedTrip?.driver ? `${selectedTrip.driver.firstName} ${selectedTrip.driver.lastName}` : '—'}</Text>
                <Text size="sm">✅ {picked} {selectedTrip?.type === 'afternoon_dropoff' ? 'dropped off' : 'picked up'}</Text>
                <Text size="sm">❌ {absent} absent</Text>
                {avgWait != null && <Text size="sm">⏱️ Avg wait {fmtDur(avgWait)}</Text>}
              </Group>
              {rep.length === 0 ? <EmptyState message="No students on this route." /> : (
                <Table.ScrollContainer minWidth={700}>
                  <Table verticalSpacing="sm">
                    <Table.Thead><Table.Tr><Table.Th>Stop</Table.Th><Table.Th>Student</Table.Th><Table.Th>Bus arrived</Table.Th><Table.Th>Picked up</Table.Th><Table.Th>Wait</Table.Th><Table.Th>Dropped off</Table.Th><Table.Th>Status</Table.Th></Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {rep.map(r => (
                        <Table.Tr key={r.student.id}>
                          <Table.Td><Badge circle variant="light" color="gray">{r.student.RouteStudent?.stopOrder ?? '-'}</Badge></Table.Td>
                          <Table.Td fw={600}>{r.student.firstName} {r.student.lastName}{r.student.grade ? <Text span c="dimmed" size="xs"> · {r.student.grade}</Text> : ''}</Table.Td>
                          <Table.Td>{fmtTime(r.arrived)}</Table.Td>
                          <Table.Td>{fmtTime(r.picked)}</Table.Td>
                          <Table.Td>{r.wait != null ? <Text fw={600} span>{fmtDur(r.wait)}</Text> : '—'}</Table.Td>
                          <Table.Td>{fmtTime(r.dropped)}</Table.Td>
                          <Table.Td><StatusBadge status={r.status.key}>{r.status.icon} {r.status.label}</StatusBadge></Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
              <Title order={5}>Full timeline</Title>
              {tripLogs.length === 0 ? <EmptyState message="No logs recorded." /> : (
                <Table.ScrollContainer minWidth={600}>
                  <Table verticalSpacing="sm">
                    <Table.Thead><Table.Tr><Table.Th>Time</Table.Th><Table.Th>Student</Table.Th><Table.Th>Action</Table.Th><Table.Th>Notes</Table.Th></Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {[...tripLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map(l => (
                        <Table.Tr key={l.id}>
                          <Table.Td>{fmtTime(l.timestamp)}</Table.Td>
                          <Table.Td>{l.student?.firstName} {l.student?.lastName}</Table.Td>
                          <Table.Td><StatusBadge status={l.action === 'check_in' ? 'onbus' : l.action === 'check_out' ? 'dropped' : l.action === 'arrived' ? 'arrived' : 'absent'}>{l.action === 'check_in' ? '📥 Picked up' : l.action === 'check_out' ? '📤 Dropped off' : l.action === 'arrived' ? '📍 Arrived' : '❌ Absent'}</StatusBadge></Table.Td>
                          <Table.Td>{l.notes || '-'}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Stack>
          );
        })()}
      </Modal>

      <Modal isOpen={liveModalOpen} onClose={closeLive} wide title={`📡 Live — ${liveTrip?.route?.name || ''}`}>
        {liveError && <Alert color="red" icon={<IconAlertCircle size={16} />}>{liveError}</Alert>}
        {(() => {
          const roster = [...(liveTrip?.route?.students || [])].sort((a, b) => (a.RouteStudent?.stopOrder || 0) - (b.RouteStudent?.stopOrder || 0));
          const statuses = roster.map(s => studentStatus(s.id));
          const done = statuses.filter(x => x.key === 'onbus' || x.key === 'dropped').length;
          const absent = statuses.filter(x => x.key === 'absent').length;
          const waiting = roster.length - done - absent;
          const isMorning = liveTrip?.type === 'morning_pickup';
          return (
            <Stack gap="md">
              <Group gap="lg">
                <Text size="sm"><strong>{liveTrip?.driver ? `${liveTrip.driver.firstName} ${liveTrip.driver.lastName}` : 'No driver'}</strong> · 🚌 {liveTrip?.vehicle?.plateNumber || '-'}</Text>
                <Text size="sm">✅ {done} {isMorning ? 'picked up' : 'dropped off'}</Text>
                <Text size="sm">⏳ {waiting} waiting</Text>
                <Text size="sm">❌ {absent} absent</Text>
              </Group>
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  {busLoc ? (
                    <>
                      <Box
                        component="iframe"
                        title="Bus location"
                        w="100%"
                        h={340}
                        style={{ border: 0, borderRadius: 10 }}
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${busLoc.lng - 0.01}%2C${busLoc.lat - 0.008}%2C${busLoc.lng + 0.01}%2C${busLoc.lat + 0.008}&layer=mapnik&marker=${busLoc.lat}%2C${busLoc.lng}`}
                      />
                      <Group gap="md" mt={8}>
                        <Text size="sm">📍 {busLoc.lat.toFixed(5)}, {busLoc.lng.toFixed(5)}</Text>
                        {busLoc.speed != null && <Text size="sm">🚀 {Math.round(busLoc.speed)} km/h</Text>}
                        <Text size="sm">🕒 {new Date(busLoc.recordedAt).toLocaleTimeString()}</Text>
                        <Anchor size="sm" href={`https://www.openstreetmap.org/?mlat=${busLoc.lat}&mlon=${busLoc.lng}#map=16/${busLoc.lat}/${busLoc.lng}`} target="_blank" rel="noreferrer">Open map ↗</Anchor>
                      </Group>
                    </>
                  ) : <EmptyState message={liveLoading ? 'Loading location...' : 'No bus location yet. Waiting for the driver to share GPS.'} />}
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Title order={5} mb={8}>Students ({roster.length})</Title>
                  {roster.length === 0 ? <EmptyState message="No students on this route." /> : (
                    <Box mah={340} style={{ overflowY: 'auto' }}>
                      <Stack gap={0}>
                        {roster.map((s, i) => {
                          const rs = statuses[i];
                          return (
                            <Group key={s.id} justify="space-between" py={8} style={{ borderBottom: i < roster.length - 1 ? '1px solid var(--mantine-color-gray-2)' : 'none' }}>
                              <Group gap={8}>
                                <Badge circle variant="light" color="gray">{s.RouteStudent?.stopOrder ?? '-'}</Badge>
                                <Text size="sm">{s.firstName} {s.lastName}{s.grade ? <Text span c="dimmed" size="xs"> · {s.grade}</Text> : ''}</Text>
                              </Group>
                              <StatusBadge status={rs.key}>{rs.icon} {rs.label}</StatusBadge>
                            </Group>
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
                </Grid.Col>
              </Grid>
            </Stack>
          );
        })()}
      </Modal>
    </div>
  );
};

export default TripsPage;
