import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon, Badge, Box, Button, Grid, Group, MultiSelect, Paper, Progress, SegmentedControl, SimpleGrid, Stack, Text, Textarea, ThemeIcon, Title, Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle, IconBackpack, IconBus, IconCheck, IconClock, IconMapPin,
  IconBell, IconRefresh, IconRoute, IconSend, IconSteeringWheel,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { driverAPI, messageAPI, schoolAPI, tripAPI, vehicleAPI } from '../services/api';
import { EmptyState, LoadingState, statusColor } from '../components/ui';
import Modal from '../components/Modal';
import FleetActivity, { fleetStatus } from '../components/FleetActivity';

const SUMMARY_CARDS = [
  { key: 'studentCount', label: 'Total Students', icon: IconBackpack, color: '#e54867', background: '#fff0f3' },
  { key: 'vehicleCount', label: 'Active Buses', icon: IconBus, color: '#2f80ed', background: '#edf6ff' },
  { key: 'activeTrips', label: 'Active Trips', icon: IconMapPin, color: '#14a673', background: '#ecfbf5' },
  { key: 'driverCount', label: 'Drivers', icon: IconSteeringWheel, color: '#7656c9', background: '#f4f0ff' },
  { key: 'routeCount', label: 'Routes', icon: IconRoute, color: '#e79a25', background: '#fff8e9' },
];

const TRIP_GROUPS = [
  { key: 'active', title: 'Active Trips', statuses: ['in_progress'], color: 'green', background: '#effbf5', icon: IconMapPin },
  { key: 'attention', title: 'Needs Attention', statuses: ['delayed', 'missed'], color: 'orange', background: '#fff8eb', icon: IconAlertTriangle },
  { key: 'completed', title: 'Completed', statuses: ['completed'], color: 'blue', background: '#eef7ff', icon: IconCheck },
];

const formatTime = value => {
  if (!value) return 'Not started';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dash, setDash] = useState(null);
  const [vehicleStats, setVehicleStats] = useState(null);
  const [trips, setTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [periodTrips, setPeriodTrips] = useState([]);
  const [averagePeriod, setAveragePeriod] = useState('daily');
  const [locations, setLocations] = useState([]);
  const [dashboardDate, setDashboardDate] = useState('');
  const [freshnessNow, setFreshnessNow] = useState(Date.now());
  const requestContext = useRef(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationAudience, setNotificationAudience] = useState('all');
  const [selectedTripIds, setSelectedTripIds] = useState([]);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationSending, setNotificationSending] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [notificationResult, setNotificationResult] = useState('');

  const loadDashboard = useCallback(async (isRefresh = false) => {
    const context = requestContext.current;
    if (!user?.schoolId || !context?.active || context.busy) return;
    context.busy = true;
    const config = { signal: context.controller.signal, timeout: 10000 };
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [dashboardResponse, vehicleResponse, tripResponse, driverResponse] = await Promise.all([
        schoolAPI.getDashboard(user.schoolId, config),
        vehicleAPI.getStats(config),
        tripAPI.getAll({ date: 'today', includeActive: 'true' }, config),
        driverAPI.getAll(config),
      ]);
      if (!context.active) return;
      const todayTrips = tripResponse.data.trips || [];
      const today = tripResponse.data.schoolDate || new Date().toISOString().slice(0, 10);
      const activeTrips = todayTrips.filter(trip => trip.status === 'in_progress');
      const start = new Date(`${today}T12:00:00Z`);
      if (averagePeriod === 'weekly') start.setUTCDate(start.getUTCDate() - 6);
      else if (averagePeriod === 'monthly') start.setUTCDate(1);
      const results = await Promise.allSettled([
        ...activeTrips.map(trip => trip.vehicle?.id
          ? vehicleAPI.getLocation(trip.vehicle.id, config)
          : Promise.reject(new Error('No vehicle assigned to this trip.'))),
        averagePeriod === 'daily' ? Promise.resolve({ data: { trips: todayTrips.filter(trip => trip.scheduledDate === today) } })
          : tripAPI.getAll({ startDate: start.toISOString().slice(0, 10), endDate: today }, config),
      ]);
      if (!context.active) return;
      setDash(dashboardResponse.data.dashboard);
      setVehicleStats(vehicleResponse.data.stats);
      setTrips(todayTrips);
      setDashboardDate(today);
      setDrivers(driverResponse.data.drivers || []);
      setFreshnessNow(Date.now());
      setLocations(previous => activeTrips.map((trip, index) => {
        const result = results[index];
        if (result.status === 'rejected') return {
          trip, location: previous.find(entry => entry.trip.id === trip.id)?.location || null,
          error: result.reason.response?.data?.error || result.reason.message || 'GPS could not be loaded.',
        };
        const data = result.value.data;
        return { trip, location: String(data.trip?.id) === String(trip.id) ? data.location : null, error: '' };
      }));
      const analytics = results[results.length - 1];
      if (analytics.status === 'fulfilled') setPeriodTrips(analytics.value.data.trips || []);
      else setError('Trip analytics could not be refreshed. Previously loaded analytics are shown.');
    } catch (err) {
      if (context.active) {
        setError(err.response?.data?.error || 'Dashboard data could not be loaded.');
        setLocations(previous => previous.map(entry => ({ ...entry, error: 'Dashboard refresh failed. This is a reference position only.' })));
      }
    } finally {
      context.busy = false;
      if (context.active) { setLoading(false); setRefreshing(false); }
    }
  }, [user?.schoolId, averagePeriod]);

  useEffect(() => {
    setDash(null);
    setTrips([]);
    setLocations([]);
    setPeriodTrips([]);
    setLoading(true);
  }, [user?.schoolId]);

  useEffect(() => {
    const context = { active: true, busy: false, controller: new AbortController() };
    requestContext.current = context;
    loadDashboard(true);
    const timer = setInterval(() => loadDashboard(true), 15000);
    const clock = setInterval(() => setFreshnessNow(Date.now()), 10000);
    return () => { context.active = false; context.controller.abort(); clearInterval(timer); clearInterval(clock); };
  }, [loadDashboard]);

  const summary = useMemo(() => ({
    ...dash,
    activeTrips: trips.filter(trip => trip.status === 'in_progress').length,
  }), [dash, trips]);

  const groupedTrips = useMemo(() => Object.fromEntries(
    TRIP_GROUPS.map(group => [
      group.key,
      trips.filter(trip => group.statuses.includes(trip.status)),
    ]),
  ), [trips]);

  const alerts = useMemo(() => {
    const rows = trips
      .filter(trip => ['delayed', 'missed', 'cancelled'].includes(trip.status))
      .map(trip => ({
        key: `trip-${trip.id}`,
        color: trip.status === 'delayed' ? 'orange' : 'red',
        title: trip.status === 'missed' ? 'Trip not started' : trip.status === 'cancelled' ? 'Trip cancelled' : 'Trip delayed',
        detail: `${trip.route?.name || 'Route'} • ${trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : 'No driver assigned'}`,
        target: `/trips/${trip.id}`, action: 'Review trip', tripId: trip.id,
      }));
    locations.filter(entry => fleetStatus(entry, freshnessNow) !== 'fresh').forEach(entry => rows.push({
      key: `gps-${entry.trip.id}`, color: fleetStatus(entry, freshnessNow) === 'failed' ? 'red' : 'yellow',
      title: 'GPS needs attention', detail: `${entry.trip.vehicle?.plateNumber || 'Bus'} - ${entry.error || (entry.location ? 'Position is not fresh.' : 'No valid GPS fix available.')}`,
      target: `/trips/${entry.trip.id}`, action: 'Review tracking',
    }));
    if (error) rows.unshift({ key: 'refresh-error', color: 'red', title: 'Dashboard update unavailable', detail: error, action: 'Retry dashboard update' });
    if ((vehicleStats?.maintenance || 0) > 0) {
      rows.push({
        key: 'maintenance',
        color: 'yellow',
        title: `${vehicleStats.maintenance} ${vehicleStats.maintenance === 1 ? 'bus requires' : 'buses require'} attention`,
        detail: 'Review vehicles currently marked for maintenance.',
        target: '/vehicles', action: 'Review vehicles',
      });
    }
    return rows;
  }, [trips, vehicleStats, locations, freshnessNow, error]);

  const operationalMetrics = useMemo(() => {
    const completedTrips = periodTrips.filter(trip => trip.status === 'completed');
    const durations = completedTrips
      .filter(trip => trip.startedAt && trip.endedAt)
      .map(trip => Math.max(0, Math.round((new Date(trip.endedAt) - new Date(trip.startedAt)) / 60000)));
    const averageDuration = durations.length
      ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
      : 0;
    const completed = completedTrips.length;
    const attention = trips.filter(trip => ['delayed', 'missed', 'cancelled'].includes(trip.status)).length;
    const pending = trips.filter(trip => trip.status === 'scheduled').length;
    const inProgress = trips.filter(trip => trip.status === 'in_progress').length;
    const dailyTrips = trips.filter(trip => trip.scheduledDate === dashboardDate);
    const completionRate = dailyTrips.length ? Math.round((dailyTrips.filter(trip => trip.status === 'completed').length / dailyTrips.length) * 100) : 0;

    return {
      averageDuration,
      completedWithDuration: durations.length,
      completed,
      attention,
      pending,
      inProgress,
      completionRate,
    };
  }, [periodTrips, trips, dashboardDate]);

  const driverStatuses = useMemo(() => drivers.map(driver => {
    const driverTrips = trips.filter(trip => trip.driver?.id === driver.id);
    const currentTrip = driverTrips.find(trip => trip.status === 'in_progress');
    const attentionTrip = driverTrips.find(trip => ['delayed', 'missed'].includes(trip.status));
    const scheduledTrip = driverTrips.find(trip => trip.status === 'scheduled');
    if (currentTrip) return { ...driver, status: 'On route', color: 'green', detail: currentTrip.route?.name || 'Active trip' };
    if (attentionTrip) return { ...driver, status: attentionTrip.status === 'missed' ? 'Missed trip' : 'Delayed', color: 'orange', detail: attentionTrip.route?.name || 'Trip needs attention' };
    if (scheduledTrip) return { ...driver, status: 'Scheduled', color: 'blue', detail: scheduledTrip.route?.name || 'Trip scheduled' };
    return { ...driver, status: 'Available', color: 'gray', detail: 'No active trip' };
  }).sort((a, b) => {
    const rank = { 'On route': 0, Delayed: 1, 'Missed trip': 1, Scheduled: 2, Available: 3 };
    return rank[a.status] - rank[b.status] || a.firstName.localeCompare(b.firstName);
  }), [drivers, trips]);

  const busProgress = useMemo(() => {
    const byVehicle = new Map();
    trips.filter(trip => trip.vehicle).forEach(trip => {
      const existing = byVehicle.get(trip.vehicle.id) || [];
      existing.push(trip);
      byVehicle.set(trip.vehicle.id, existing);
    });
    const statusRank = { in_progress: 0, delayed: 1, scheduled: 2, missed: 3, completed: 4, cancelled: 5 };
    return [...byVehicle.values()].map(vehicleTrips => {
      const sorted = [...vehicleTrips].sort((a, b) => statusRank[a.status] - statusRank[b.status]);
      const current = sorted[0];
      const stats = current.studentStats || {};
      const progressed = Number(stats.onBus || 0) + Number(stats.droppedOff || 0) + Number(stats.absent || 0);
      const rosterProgress = stats.total ? Math.round((progressed / stats.total) * 100) : 0;
      const progress = current.status === 'completed' ? 100 : current.status === 'in_progress' ? rosterProgress : 0;
      return {
        id: current.vehicle.id,
        plateNumber: current.vehicle.plateNumber,
        route: current.route?.name || 'No route',
        status: current.status,
        progress,
        progressed,
        total: stats.total || 0,
      };
    }).sort((a, b) => b.progress - a.progress);
  }, [trips]);

  const dailyAttendance = useMemo(() => trips
    .filter(trip => trip.type === 'morning_pickup' && trip.scheduledDate === dashboardDate)
    .reduce((totals, trip) => {
      const stats = trip.studentStats || {};
      totals.expected += Number(stats.total || 0);
      totals.absent += Number(stats.absent || 0);
      totals.boarded += Number(stats.onBus || 0) + Number(stats.droppedOff || 0);
      totals.notBoarded += Number(stats.pending || 0);
      return totals;
    }, { expected: 0, absent: 0, boarded: 0, notBoarded: 0 }), [trips, dashboardDate]);

  const tripOptions = useMemo(() => trips.map(trip => ({
    value: String(trip.id),
    label: `${trip.route?.name || 'Unnamed route'} • ${trip.type === 'morning_pickup' ? 'Morning' : 'Afternoon'} • ${trip.scheduledTime ? trip.scheduledTime.slice(0, 5) : 'Time not set'}`,
  })), [trips]);

  const openNotification = (tripId = null) => {
    setNotificationAudience(tripId == null ? 'all' : 'selected');
    setSelectedTripIds(tripId == null ? [] : [String(tripId)]);
    setNotificationMessage('');
    setNotificationError('');
    setNotificationOpen(true);
  };

  const sendNotification = async () => {
    const content = notificationMessage.trim();
    if (!content) {
      setNotificationError('Enter a message for parents.');
      return;
    }
    if (notificationAudience === 'selected' && selectedTripIds.length === 0) {
      setNotificationError('Select at least one trip.');
      return;
    }

    setNotificationSending(true);
    setNotificationError('');
    try {
      const { data } = await messageAPI.sendTripNotification({
        content,
        allTrips: notificationAudience === 'all',
        tripIds: notificationAudience === 'selected' ? selectedTripIds.map(Number) : [],
        date: dashboardDate,
      });
      setNotificationResult(`${data.message} (${data.tripCount} ${data.tripCount === 1 ? 'trip' : 'trips'})`);
      setNotificationOpen(false);
      setTimeout(() => setNotificationResult(''), 6000);
    } catch (err) {
      setNotificationError(err.response?.data?.error || 'Notification could not be sent.');
    } finally {
      setNotificationSending(false);
    }
  };

  if (loading) return <LoadingState label="Loading dashboard..." />;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={2}>Dashboard</Title>
          <Text c="dimmed" size="sm">Welcome back, {user?.firstName}. Here is today&apos;s transport overview.</Text>
        </Box>
        <Group gap="sm">
          <Button leftSection={<IconBell size={17} />} onClick={() => openNotification()}>Notify parents</Button>
          <Paper withBorder px="md" py="xs" radius="md">
            <Text size="xs" c="dimmed">Today</Text>
            <Text size="sm" fw={600}>{dashboardDate || 'School date unavailable'}</Text>
          </Paper>
          <Tooltip label="Refresh dashboard">
            <ActionIcon aria-label="Refresh dashboard" size={48} variant="filled" color="carribu" onClick={() => loadDashboard(true)} loading={refreshing}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {error && (
        <Paper withBorder p="sm" bg="red.0" style={{ borderColor: 'var(--mantine-color-red-2)' }}>
          <Text c="red.7" size="sm">{error}</Text>
        </Paper>
      )}
      {notificationResult && (
        <Paper withBorder p="sm" bg="green.0" style={{ borderColor: 'var(--mantine-color-green-2)' }}>
          <Text c="green.8" size="sm" fw={650}>{notificationResult}</Text>
        </Paper>
      )}

      <Paper component="section" aria-labelledby="attention-heading" withBorder shadow="sm" p="md">
        <Group justify="space-between" mb="md">
          <Box>
            <Title id="attention-heading" order={3}>Needs attention</Title>
            <Text size="sm" c="dimmed">Review disruptions first. Attendance changes still require verification.</Text>
          </Box>
          <Group>
            <Badge color={alerts.length ? 'orange' : 'green'} variant="light">{alerts.length} alerts</Badge>
            <Button variant="light" onClick={() => navigate('/absences')}>Review parent absences</Button>
          </Group>
        </Group>
        {alerts.length ? <Stack gap="sm" mah={360} style={{ overflowY: 'auto' }}>
          {alerts.map(alert => <Paper key={alert.key} p="md" bg={`${alert.color}.0`} style={{ borderLeft: `3px solid var(--mantine-color-${alert.color}-6)` }}>
            <Group justify="space-between" align="flex-start">
              <Group align="flex-start" wrap="nowrap">
                <ThemeIcon color={alert.color} variant="light" size="sm"><IconAlertTriangle size={16} /></ThemeIcon>
                <Box>
                  <Text size="sm" fw={700}>{alert.title}</Text>
                  <Text size="sm" c="dimmed" mt={2}>{alert.detail}</Text>
                </Box>
              </Group>
              <Group>
                <Button variant="light" color={alert.color} aria-label={`${alert.action}: ${alert.detail}`}
                  onClick={() => alert.target ? navigate(alert.target) : loadDashboard(true)}
                  disabled={!alert.target && refreshing}>{alert.action}</Button>
                {alert.tripId != null && <Button variant="default" aria-label={`Notify parents: ${alert.detail}`}
                  onClick={() => openNotification(alert.tripId)}>Notify affected parents</Button>}
              </Group>
            </Group>
          </Paper>)}
        </Stack> : <Text size="sm">No operational alerts in the loaded data. Parent absence requests need separate review.</Text>}
      </Paper>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }} spacing="md">
        {SUMMARY_CARDS.map(card => {
          const Icon = card.icon;
          return (
            <Paper key={card.key} withBorder p="md" shadow="sm">
              <Group justify="space-between" wrap="nowrap">
                <Box>
                  <Text size="xs" c="dimmed" fw={600}>{card.label}</Text>
                  <Text size="xl" fw={800} mt={4}>{summary?.[card.key] ?? 0}</Text>
                </Box>
                <ThemeIcon size={42} radius="md" color={card.color} style={{ background: card.background }}>
                  <Icon size={21} stroke={1.8} />
                </ThemeIcon>
              </Group>
            </Paper>
          );
        })}
      </SimpleGrid>

      <Paper withBorder shadow="sm" p="md">
        <Group justify="space-between" mb="md">
          <Box>
            <Title order={4}>Today&apos;s Trip Overview</Title>
            <Text size="xs" c="dimmed">{trips.length} scheduled {trips.length === 1 ? 'trip' : 'trips'} today</Text>
          </Box>
          <Badge variant="light" color="gray">{new Date().toLocaleDateString(undefined, { weekday: 'long' })}</Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {TRIP_GROUPS.map(group => {
            const Icon = group.icon;
            const groupTrips = groupedTrips[group.key] || [];
            return (
              <Paper key={group.key} p="md" radius="md" style={{ background: group.background, minHeight: 210 }}>
                <Group justify="space-between" mb="sm">
                  <Group gap="xs">
                    <ThemeIcon variant="light" color={group.color} size="sm"><Icon size={14} /></ThemeIcon>
                    <Text fw={700} size="sm">{group.title}</Text>
                  </Group>
                  <Badge color={group.color} variant="white">{groupTrips.length}</Badge>
                </Group>
                {groupTrips.length ? (
                  <Stack gap="xs">
                    {groupTrips.slice(0, 3).map(trip => {
                      const progress = trip.studentStats?.total
                        ? Math.round(((trip.studentStats.onBus + trip.studentStats.droppedOff) / trip.studentStats.total) * 100)
                        : 0;
                      return (
                        <Paper key={trip.id} bg="white" p="sm" radius="sm">
                          <Group justify="space-between" gap="xs" wrap="nowrap">
                            <Box style={{ minWidth: 0 }}>
                              <Text size="sm" fw={650} truncate>{trip.route?.name || 'Unnamed route'}</Text>
                              <Text size="xs" c="dimmed" truncate>
                                {trip.vehicle?.plateNumber || 'No bus'} • {trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : 'No driver'}
                              </Text>
                            </Box>
                            <Badge size="xs" color={statusColor(trip.status)} variant="light">{trip.status.replace('_', ' ')}</Badge>
                          </Group>
                          {trip.status === 'in_progress' ? (
                            <Progress value={progress} color="green" size="xs" mt="xs" />
                          ) : (
                            <Text size="xs" c="dimmed" mt="xs"><IconClock size={11} /> {formatTime(trip.startedAt)}</Text>
                          )}
                          <Button variant="subtle" size="compact-xs" mt={5} px={0} onClick={() => navigate(`/trips/${trip.id}`)}>View trip details →</Button>
                        </Paper>
                      );
                    })}
                  </Stack>
                ) : <EmptyState message={`No ${group.title.toLowerCase()}.`} />}
              </Paper>
            );
          })}
        </SimpleGrid>
      </Paper>

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
        <Paper withBorder shadow="sm" p="md">
          <Group justify="space-between" mb="md">
            <Box>
              <Title order={5}>Average Trip</Title>
              <Text size="xs" c="dimmed">Completed-trip duration</Text>
            </Box>
            <ThemeIcon color="blue" variant="light"><IconClock size={17} /></ThemeIcon>
          </Group>
          <SegmentedControl
            fullWidth
            size="xs"
            mb="lg"
            value={averagePeriod}
            onChange={setAveragePeriod}
            data={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
          />
          <Group align="flex-end" gap={6}>
            <Text fz={34} fw={800} lh={1}>{operationalMetrics.averageDuration}</Text>
            <Text size="sm" c="dimmed" pb={3}>minutes</Text>
          </Group>
          <Text size="xs" c="dimmed" mt="md">
            Based on {operationalMetrics.completedWithDuration} completed {operationalMetrics.completedWithDuration === 1 ? 'trip' : 'trips'} with recorded times
          </Text>
        </Paper>

        <Paper withBorder shadow="sm" p="md">
          <Group justify="space-between" mb="md">
            <Box>
              <Title order={5}>Driver Status</Title>
              <Text size="xs" c="dimmed">Individual driver activity</Text>
            </Box>
            <ThemeIcon color="violet" variant="light"><IconSteeringWheel size={17} /></ThemeIcon>
          </Group>
          <Stack gap={0} mah={190} style={{ overflowY: 'auto' }}>
            {driverStatuses.map((driver, index) => (
              <Group key={driver.id} justify="space-between" py="xs" wrap="nowrap" style={{ borderBottom: index < driverStatuses.length - 1 ? '1px solid var(--mantine-color-gray-2)' : 0 }}>
                <Box style={{ minWidth: 0 }}>
                  <Text size="sm" fw={650} truncate>{driver.firstName} {driver.lastName}</Text>
                  <Text size="xs" c="dimmed" truncate>{driver.detail}</Text>
                </Box>
                <Badge size="xs" color={driver.color} variant="light">{driver.status}</Badge>
              </Group>
            ))}
          </Stack>
        </Paper>

        <Paper withBorder shadow="sm" p="md">
          <Group justify="space-between" mb="md">
            <Box>
              <Title order={5}>Daily Bus Status</Title>
              <Text size="xs" c="dimmed">Progress by vehicle</Text>
            </Box>
            <ThemeIcon color="green" variant="light"><IconBus size={17} /></ThemeIcon>
          </Group>
          <Stack gap="md" mah={190} style={{ overflowY: 'auto' }}>
            {busProgress.map(bus => (
              <Box key={bus.id}>
                <Group justify="space-between" wrap="nowrap" mb={5}>
                  <Box style={{ minWidth: 0 }}><Text size="sm" fw={700}>{bus.plateNumber}</Text><Text size="xs" c="dimmed" truncate>{bus.route}</Text></Box>
                  <Box ta="right"><Badge size="xs" color={statusColor(bus.status)} variant="light">{bus.status.replace('_', ' ')}</Badge><Text size="xs" fw={700} mt={2}>{bus.progress}%</Text></Box>
                </Group>
                <Progress value={bus.progress} color={bus.status === 'completed' ? 'green' : 'blue'} size="sm" animated={bus.status === 'in_progress'} />
                <Text size="xs" c="dimmed" mt={3}>{bus.progressed}/{bus.total} student stops completed</Text>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper withBorder shadow="sm" p="md">
          <Group justify="space-between" mb="md">
            <Box>
              <Title order={5}>Daily Attendance</Title>
              <Text size="xs" c="dimmed">Morning pickup attendance</Text>
            </Box>
            <ThemeIcon color="orange" variant="light"><IconBackpack size={17} /></ThemeIcon>
          </Group>
          <SimpleGrid cols={2} spacing="sm">
            {[
              ['Expected', dailyAttendance.expected, 'blue'],
              ['Boarded', dailyAttendance.boarded, 'green'],
              ['Not boarded', dailyAttendance.notBoarded, 'orange'],
              ['Absent', dailyAttendance.absent, 'red'],
            ].map(([label, value, color]) => (
              <Paper key={label} bg={`${color}.0`} p="sm" ta="center">
                <Text size="xl" fw={800} c={`${color}.7`}>{value}</Text>
                <Text size="xs" c="dimmed">{label}</Text>
              </Paper>
            ))}
          </SimpleGrid>
          <Progress
            mt="md"
            value={dailyAttendance.expected ? ((dailyAttendance.boarded + dailyAttendance.absent) / dailyAttendance.expected) * 100 : 0}
            color="green"
            size="sm"
          />
          <Text size="xs" c="dimmed" mt={4}>Attendance accounted for</Text>
        </Paper>
      </SimpleGrid>

      <Grid>
        <Grid.Col span={12}>
          <FleetActivity entries={locations} now={freshnessNow} />
        </Grid.Col>
      </Grid>

      <Modal
        isOpen={notificationOpen}
        onClose={() => setNotificationOpen(false)}
        title="Notify parents"
        footer={(
          <>
            <Button variant="default" onClick={() => setNotificationOpen(false)}>Cancel</Button>
            <Button
              leftSection={<IconSend size={16} />}
              loading={notificationSending}
              disabled={trips.length === 0 || !notificationMessage.trim() || (notificationAudience === 'selected' && selectedTripIds.length === 0)}
              onClick={sendNotification}
            >
              Send notification
            </Button>
          </>
        )}
      >
        <Text size="sm" c="dimmed">
          Each parent receives one notification, even when their children appear on multiple selected trips.
        </Text>
        <SegmentedControl
          fullWidth
          value={notificationAudience}
          onChange={setNotificationAudience}
          data={[
            { value: 'all', label: `All today's trips (${trips.length})` },
            { value: 'selected', label: 'Selected trips' },
          ]}
        />
        {notificationAudience === 'selected' && (
          <MultiSelect
            label="Trips"
            placeholder="Select one or more trips"
            data={tripOptions}
            value={selectedTripIds}
            onChange={setSelectedTripIds}
            searchable
            clearable
          />
        )}
        <Textarea
          label="Message"
          description="This appears in the parent app's Notifications screen and as a phone notification when enabled."
          placeholder="Enter the transport update for parents..."
          minRows={5}
          maxLength={2000}
          value={notificationMessage}
          onChange={event => setNotificationMessage(event.currentTarget.value)}
          required
        />
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            {notificationAudience === 'all' ? `Targets parents across all ${trips.length} trips today` : `${selectedTripIds.length} trips selected`}
          </Text>
          <Text size="xs" c="dimmed">{notificationMessage.length}/2000</Text>
        </Group>
        {trips.length === 0 && <Text size="sm" c="orange.7">There are no trips scheduled today.</Text>}
        {notificationError && <Text size="sm" c="red.7">{notificationError}</Text>}
      </Modal>
    </Stack>
  );
};

export default DashboardPage;
