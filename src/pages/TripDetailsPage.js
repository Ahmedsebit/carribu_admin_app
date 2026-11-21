import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Anchor, Badge, Box, Button, Grid, Group, Paper, Progress, SimpleGrid,
  Select, Stack, Table, Text, Textarea, ThemeIcon, Title,
} from '@mantine/core';
import {
  IconAlertCircle, IconArrowLeft, IconBus, IconClock, IconMapPin,
  IconPhone, IconRefresh, IconRoute, IconUsers,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { tripAPI } from '../services/api';
import { EmptyState, LoadingState, StatusBadge } from '../components/ui';
import VehicleLocationCard from '../components/VehicleLocationCard';
import TripNotificationDiagnostics from '../components/TripNotificationDiagnostics';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';

const formatTime = value => value
  ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  : '—';

const formatDuration = seconds => {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const studentStatus = {
  pending: { label: 'Waiting', color: 'gray' },
  arrived: { label: 'Bus arrived', color: 'yellow' },
  arrived_pickup: { label: 'At pickup', color: 'yellow' },
  arrived_dropoff: { label: 'At drop-off', color: 'yellow' },
  on_bus: { label: 'On bus', color: 'blue' },
  dropped_off: { label: 'Dropped off', color: 'green' },
  absent: { label: 'Absent', color: 'red' },
};

const actionLabel = {
  arrived: 'Bus arrived',
  check_in: 'Student picked up',
  check_out: 'Student dropped off',
  absent: 'Marked absent',
};

const TripDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reconciliation, setReconciliation] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const { data } = await tripAPI.getDetails(id);
      setTrip(data.trip);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Trip details could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (trip?.status !== 'in_progress') return undefined;
    const timer = setInterval(() => load(true), 10000);
    return () => clearInterval(timer);
  }, [load, trip?.status]);

  const openReconciliation = student => {
    setReconciliation({
      student, action: ['pending', 'arrived_pickup'].includes(student.status) ? 'check_in' : 'check_out',
      key: `staff:${id}:${student.studentId}:${Date.now()}`,
    });
    setNotes('');
    setActionError('');
  };
  const saveReconciliation = async () => {
    if (!notes.trim()) { setActionError('Explain how the outcome was verified.'); return; }
    setSaving(true);
    try {
      await tripAPI.logAction(id, {
        studentId: reconciliation.student.studentId, action: reconciliation.action,
        phase: reconciliation.action === 'check_out' ? 'dropoff' : 'pickup',
        notes: notes.trim(), idempotencyKey: reconciliation.key,
      });
      setReconciliation(null);
      await load(true);
    } catch (err) { setActionError(err.response?.data?.error || 'Attendance could not be recorded.'); }
    finally { setSaving(false); }
  };
  const complete = async () => {
    if (!window.confirm('Complete this trip? Every student must have a recorded dropped-off or absent outcome.')) return;
    setSaving(true);
    try { await tripAPI.end(id); await load(true); }
    catch (err) { setError(err.response?.data?.error || 'The trip could not be completed.'); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingState label="Loading trip details..." />;

  if (!trip) {
    return (
      <Stack>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/trips')} style={{ alignSelf: 'flex-start' }}>Back to trips</Button>
        <Alert color="red" icon={<IconAlertCircle size={16} />}>{error || 'Trip not found.'}</Alert>
      </Stack>
    );
  }

  const isActive = trip.status === 'in_progress';
  const canReconcile = isActive && ['school_admin', 'coordinator'].includes(user?.role);
  const pickupsOutstanding = trip.pickupList.some(student => ['pending', 'arrived_pickup'].includes(student.status));
  const stats = trip.stats || {};
  const currentStop = trip.currentStop;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Group align="flex-start">
          <Button variant="subtle" px="xs" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/trips')}>Trips</Button>
          <Box>
            <Group gap="sm">
              <Title order={2}>{trip.route?.name || 'Trip details'}</Title>
              <StatusBadge status={trip.status}>{trip.status.replace('_', ' ')}</StatusBadge>
            </Group>
            <Text size="sm" c="dimmed">
              {trip.scheduledDate} • {trip.type === 'morning_pickup' ? 'Morning pickup' : 'Afternoon drop-off'}
            </Text>
          </Box>
        </Group>
        <Button variant="default" leftSection={<IconRefresh size={16} />} loading={refreshing} onClick={() => load(true)}>Refresh</Button>
      </Group>

      {error && <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        <Paper withBorder shadow="sm" p="md">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color="blue" size={42}><IconClock size={20} /></ThemeIcon>
            <Box><Text size="xs" c="dimmed">Duration</Text><Text fw={800} size="xl">{stats.durationMinutes == null ? (isActive ? 'In progress' : '—') : `${stats.durationMinutes} min`}</Text></Box>
          </Group>
        </Paper>
        <Paper withBorder shadow="sm" p="md">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color="green" size={42}><IconUsers size={20} /></ThemeIcon>
            <Box><Text size="xs" c="dimmed">Stops completed</Text><Text fw={800} size="xl">{stats.completedStops || 0}/{stats.totalStudents || 0}</Text></Box>
          </Group>
        </Paper>
        <Paper withBorder shadow="sm" p="md">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color="orange" size={42}><IconClock size={20} /></ThemeIcon>
            <Box><Text size="xs" c="dimmed">Average wait</Text><Text fw={800} size="xl">{formatDuration(stats.averageWaitSeconds)}</Text></Box>
          </Group>
        </Paper>
        <Paper withBorder shadow="sm" p="md">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color="violet" size={42}><IconRoute size={20} /></ThemeIcon>
            <Box><Text size="xs" c="dimmed">Completion</Text><Text fw={800} size="xl">{stats.completionRate || 0}%</Text></Box>
          </Group>
        </Paper>
      </SimpleGrid>

      {isActive && (
        <Alert color={trip.canEnd ? 'green' : 'blue'}>
          Phase: {trip.phase?.replace(/_/g, ' ') || 'active'}.
          {trip.canEnd ? ' All students accounted for; this trip can end.' : ' Every student must be dropped off or absent before this trip can end.'}
        </Alert>
      )}
      {canReconcile && <Group>
        <Text size="sm">Staff can record verified attendance below. Outcomes require an explanatory note.</Text>
        <Button variant="light" onClick={() => navigate('/absences')}>Review parent absence requests</Button>
        <Button color="green" disabled={!trip.canEnd} loading={saving} onClick={complete}>Complete resolved trip</Button>
      </Group>}
      {trip.rosterSource === 'recorded_logs' && <Alert color="yellow">This older trip has no frozen roster. Totals include only students with recorded logs; the original expected roster cannot be reconstructed.</Alert>}
      {isActive && currentStop && (
        <Paper withBorder shadow="sm" p="md" bg="green.0" style={{ borderColor: 'var(--mantine-color-green-3)' }}>
          <Group justify="space-between" align="flex-start">
            <Group align="flex-start">
              <ThemeIcon color="green" size={46} radius="xl"><IconMapPin size={23} /></ThemeIcon>
              <Box>
                <Text size="xs" fw={700} c="green.8" tt="uppercase">Current {currentStop.phase === 'pickup' ? 'pickup' : 'drop-off'}</Text>
                <Title order={4}>{currentStop.studentName}</Title>
                <Text size="sm" c="dimmed">Stop {currentStop.stopNumber} • {currentStop.address || 'Address not provided'}</Text>
                {trip.nextStop && <Text size="xs">Then: {trip.nextStop.studentName}</Text>}
              </Box>
            </Group>
            <Box ta="right">
              <Text size="sm" fw={650}>{currentStop.parentName || 'Parent not listed'}</Text>
              {currentStop.parentPhone && <Anchor href={`tel:${currentStop.parentPhone}`} size="sm"><IconPhone size={13} /> {currentStop.parentPhone}</Anchor>}
            </Box>
          </Group>
        </Paper>
      )}

      <Grid>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          {isActive ? (
            trip.vehicle?.id ? (
              <VehicleLocationCard vehicleId={trip.vehicle.id} tripId={trip.id} />
            ) : (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>This trip has no vehicle assigned. Its location cannot be loaded.</Alert>
            )
          ) : (
          <Paper withBorder shadow="sm" p="md" h="100%">
            <Group justify="space-between" mb="md">
              <Box>
                <Title order={4}>Last recorded location</Title>
                <Text size="xs" c="dimmed">Final GPS point recorded for this trip</Text>
              </Box>
              {trip.location && <Badge color="gray" variant="light">Recorded • {formatTime(trip.location.recordedAt)}</Badge>}
            </Group>
            {trip.location ? (
              <>
                <Box
                  component="iframe"
                  title="Bus location"
                  w="100%"
                  h={380}
                  style={{ border: 0, borderRadius: 10 }}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${trip.location.lng - 0.01}%2C${trip.location.lat - 0.008}%2C${trip.location.lng + 0.01}%2C${trip.location.lat + 0.008}&layer=mapnik&marker=${trip.location.lat}%2C${trip.location.lng}`}
                />
                <Group mt="sm">
                  <Text size="sm"><IconMapPin size={14} /> {trip.location.lat.toFixed(5)}, {trip.location.lng.toFixed(5)}</Text>
                  <Text size="sm"><IconBus size={14} /> {trip.location.speed == null ? 'Speed unavailable' : `${Math.round(trip.location.speed)} km/h`}</Text>
                  <Anchor size="sm" href={`https://www.openstreetmap.org/?mlat=${trip.location.lat}&mlon=${trip.location.lng}#map=16/${trip.location.lat}/${trip.location.lng}`} target="_blank" rel="noreferrer">Open full map ↗</Anchor>
                </Group>
              </>
            ) : <EmptyState message="No GPS location was recorded for this trip." />}
          </Paper>
          )}
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Paper withBorder shadow="sm" p="md" h="100%">
            <Title order={4}>Trip information</Title>
            <Stack gap="sm" mt="md">
              <Group justify="space-between"><Text size="sm" c="dimmed">Driver</Text><Text size="sm" fw={650}>{trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : 'Not assigned'}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">Driver phone</Text><Text size="sm">{trip.driver?.phone || '—'}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">Vehicle</Text><Text size="sm" fw={650}>{trip.vehicle?.plateNumber || 'Not assigned'}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">Vehicle model</Text><Text size="sm">{trip.vehicle ? `${trip.vehicle.make || ''} ${trip.vehicle.model || ''}`.trim() : '—'}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">Started</Text><Text size="sm">{formatTime(trip.startedAt)}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">Ended</Text><Text size="sm">{formatTime(trip.endedAt)}</Text></Group>
            </Stack>
            <Box mt="xl">
              <Group justify="space-between" mb={6}><Text size="sm" fw={650}>Route progress</Text><Text size="sm" fw={700}>{stats.completionRate || 0}%</Text></Group>
              <Progress value={stats.completionRate || 0} color="green" size="lg" />
              <SimpleGrid cols={3} mt="md">
                <Box ta="center"><Text fw={800}>{stats.onBus || 0}</Text><Text size="xs" c="dimmed">On bus</Text></Box>
                <Box ta="center"><Text fw={800}>{stats.droppedOff || 0}</Text><Text size="xs" c="dimmed">Dropped</Text></Box>
                <Box ta="center"><Text fw={800}>{stats.absent || 0}</Text><Text size="xs" c="dimmed">Absent</Text></Box>
              </SimpleGrid>
            </Box>
          </Paper>
        </Grid.Col>
      </Grid>

      <TripNotificationDiagnostics tripId={trip.id} />
      <Paper withBorder shadow="sm" p="md">
        <Group justify="space-between" mb="md">
          <Box><Title order={4}>Student stops</Title><Text size="xs" c="dimmed">Full pickup and drop-off details for this trip</Text></Box>
          <Badge variant="light">{trip.pickupList.length} students</Badge>
        </Group>
        {trip.pickupList.length ? (
          <Table.ScrollContainer minWidth={950}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Stop</Table.Th><Table.Th>Student</Table.Th><Table.Th>Parent</Table.Th><Table.Th>Address</Table.Th><Table.Th>Arrived</Table.Th><Table.Th>Picked up</Table.Th><Table.Th>Dropped off</Table.Th><Table.Th>Wait</Table.Th><Table.Th>Status</Table.Th>{canReconcile && <Table.Th>Reconcile</Table.Th>}</Table.Tr></Table.Thead>
              <Table.Tbody>
                {trip.pickupList.map(student => {
                  const meta = studentStatus[student.status] || studentStatus.pending;
                  return (
                    <Table.Tr key={student.studentId} bg={trip.nextStop?.studentId === student.studentId && isActive ? 'green.0' : undefined}>
                      <Table.Td><Badge circle variant="light">{student.stopNumber}</Badge></Table.Td>
                      <Table.Td fw={650}>{student.studentName}<Text size="xs" c="dimmed">{student.grade || 'No grade'}</Text></Table.Td>
                      <Table.Td>{student.parentName || '—'}<Text size="xs" c="dimmed">{student.parentPhone || ''}</Text></Table.Td>
                      <Table.Td maw={220}><Text size="sm" lineClamp={2}>{student.address || '—'}</Text></Table.Td>
                      <Table.Td>{formatTime(student.arrivedAt)}</Table.Td>
                      <Table.Td>{formatTime(student.pickedAt)}</Table.Td>
                      <Table.Td>{formatTime(student.droppedAt)}</Table.Td>
                      <Table.Td>{formatDuration(student.waitSeconds)}</Table.Td>
                      <Table.Td><Badge color={meta.color} variant="light">{meta.label}</Badge></Table.Td>
                      {canReconcile && <Table.Td>{!['dropped_off', 'absent'].includes(student.status) && <Button size="xs" variant="light" disabled={pickupsOutstanding && ['on_bus', 'arrived_dropoff'].includes(student.status)} title={pickupsOutstanding && ['on_bus', 'arrived_dropoff'].includes(student.status) ? 'Resolve all pickups or school boarding before recording drop-offs.' : undefined} onClick={() => openReconciliation(student)}>Record outcome</Button>}</Table.Td>}
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : <EmptyState message={trip.rosterSource === 'recorded_logs' ? 'No roster snapshot or student logs are available for this older trip.' : 'No eligible students are in this trip roster.'} />}
      </Paper>

      <Paper withBorder shadow="sm" p="md">
        <Title order={4}>Trip timeline</Title>
        <Text size="xs" c="dimmed" mb="md">Events recorded by the driver or authorised school staff</Text>
        {trip.logs.length ? (
          <Stack gap={0}>
            {trip.logs.map((log, index) => (
              <Group key={log.id} align="flex-start" wrap="nowrap" py="sm" style={{ borderBottom: index < trip.logs.length - 1 ? '1px solid var(--mantine-color-gray-2)' : 0 }}>
                <ThemeIcon radius="xl" variant="light" color={log.action === 'absent' ? 'red' : log.action === 'check_out' ? 'green' : 'blue'}><IconMapPin size={15} /></ThemeIcon>
                <Box style={{ flex: 1 }}>
                  <Group justify="space-between">
                    <Text size="sm" fw={650}>{actionLabel[log.action] || log.action}</Text>
                    <Text size="xs" c="dimmed">{formatTime(log.timestamp)}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">{log.student ? `${log.student.firstName} ${log.student.lastName}` : 'Student'}{log.notes ? ` • ${log.notes}` : ''}</Text>
                  {log.recordedBy && <Text size="xs" c="dimmed">Recorded by {log.recordedBy.firstName} {log.recordedBy.lastName} ({log.recordedBy.role.replace(/_/g, ' ')})</Text>}
                </Box>
              </Group>
            ))}
          </Stack>
        ) : <EmptyState message="No timeline events were recorded." />}
      </Paper>
      <Modal isOpen={Boolean(reconciliation)} onClose={() => { if (!saving) setReconciliation(null); }} title="Record verified attendance" footer={<><Button variant="default" disabled={saving} onClick={() => setReconciliation(null)}>Cancel</Button><Button disabled={!notes.trim()} loading={saving} onClick={saveReconciliation}>Confirm outcome</Button></>}>
        {actionError && <Alert color="red">{actionError}</Alert>}
        <Text fw={700}>{reconciliation?.student.studentName}</Text>
        <Text size="sm">Verify the actual outcome with the driver or parent. This records attendance under your account and sends the normal trip notifications.</Text>
        <Select label="Verified outcome" value={reconciliation?.action || null} data={['pending', 'arrived_pickup'].includes(reconciliation?.student.status) ? [{ value: 'check_in', label: 'Student actually boarded' }, { value: 'absent', label: 'Student will not board this trip' }] : [{ value: 'check_out', label: 'Student was safely dropped off' }]} onChange={action => { if (action) setReconciliation(previous => ({ ...previous, action })); }} />
        <Textarea label="How was this verified?" required maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} />
      </Modal>
    </Stack>
  );
};

export default TripDetailsPage;
