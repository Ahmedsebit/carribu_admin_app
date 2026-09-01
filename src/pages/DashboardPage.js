import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon, Badge, Box, Button, Grid, Group, Paper, Progress, SegmentedControl, SimpleGrid, Stack, Text, ThemeIcon, Title, Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle, IconBackpack, IconBus, IconCheck, IconClock, IconMapPin,
  IconRefresh, IconRoute, IconSteeringWheel,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { driverAPI, locationAPI, schoolAPI, tripAPI, vehicleAPI } from '../services/api';
import { EmptyState, LoadingState, statusColor } from '../components/ui';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (!user?.schoolId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const today = new Date().toISOString().split('T')[0];
      const [dashboardResponse, vehicleResponse, tripResponse, driverResponse] = await Promise.all([
        schoolAPI.getDashboard(user.schoolId),
        vehicleAPI.getStats(),
        tripAPI.getAll({ date: today }),
        driverAPI.getAll(),
      ]);
      const todayTrips = tripResponse.data.trips || [];
      setDash(dashboardResponse.data.dashboard);
      setVehicleStats(vehicleResponse.data.stats);
      setTrips(todayTrips);
      setDrivers(driverResponse.data.drivers || []);

      const activeTrips = todayTrips.filter(trip => trip.status === 'in_progress');
      const locationResults = await Promise.allSettled(
        activeTrips.map(trip => locationAPI.getBusLocation(trip.id)),
      );
      setLocations(locationResults
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value.data.location));
    } catch (err) {
      setError(err.response?.data?.error || 'Dashboard data could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.schoolId]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    if (!user?.schoolId) return;
    const end = new Date();
    const start = new Date(end);
    if (averagePeriod === 'weekly') start.setDate(end.getDate() - 6);
    else if (averagePeriod === 'monthly') start.setDate(1);
    const params = averagePeriod === 'daily'
      ? { date: end.toISOString().split('T')[0] }
      : {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        };
    tripAPI.getAll(params)
      .then(response => setPeriodTrips(response.data.trips || []))
      .catch(() => setPeriodTrips([]));
  }, [averagePeriod, user?.schoolId]);

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
      .filter(trip => ['delayed', 'missed'].includes(trip.status))
      .map(trip => ({
        key: `trip-${trip.id}`,
        color: trip.status === 'missed' ? 'red' : 'orange',
        title: trip.status === 'missed' ? 'Trip not started' : 'Trip delayed',
        detail: `${trip.route?.name || 'Route'} • ${trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : 'No driver assigned'}`,
      }));
    if ((vehicleStats?.maintenance || 0) > 0) {
      rows.push({
        key: 'maintenance',
        color: 'yellow',
        title: `${vehicleStats.maintenance} ${vehicleStats.maintenance === 1 ? 'bus requires' : 'buses require'} attention`,
        detail: 'Review vehicles currently marked for maintenance.',
      });
    }
    return rows.slice(0, 5);
  }, [trips, vehicleStats]);

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
    const completionRate = trips.length ? Math.round((completed / trips.length) * 100) : 0;

    return {
      averageDuration,
      completedWithDuration: durations.length,
      completed,
      attention,
      pending,
      inProgress,
      completionRate,
    };
  }, [periodTrips, trips]);

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
    .filter(trip => trip.type === 'morning_pickup')
    .reduce((totals, trip) => {
      const stats = trip.studentStats || {};
      totals.expected += Number(stats.total || 0);
      totals.absent += Number(stats.absent || 0);
      totals.boarded += Number(stats.onBus || 0) + Number(stats.droppedOff || 0);
      totals.notBoarded += Number(stats.pending || 0) + Number(stats.arrived || 0);
      return totals;
    }, { expected: 0, absent: 0, boarded: 0, notBoarded: 0 }), [trips]);

  const mapPoints = useMemo(() => {
    if (!locations.length) return [];
    const lats = locations.map(location => Number(location.lat));
    const lngs = locations.map(location => Number(location.lng));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return locations.map((location, index) => ({
      ...location,
      x: minLng === maxLng ? 50 : 12 + ((Number(location.lng) - minLng) / (maxLng - minLng)) * 76,
      y: minLat === maxLat ? 50 : 88 - ((Number(location.lat) - minLat) / (maxLat - minLat)) * 76,
      color: ['#14a673', '#2f80ed', '#e54867', '#e79a25'][index % 4],
    }));
  }, [locations]);

  if (loading) return <LoadingState label="Loading dashboard..." />;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={2}>Dashboard</Title>
          <Text c="dimmed" size="sm">Welcome back, {user?.firstName}. Here is today&apos;s transport overview.</Text>
        </Box>
        <Group gap="sm">
          <Paper withBorder px="md" py="xs" radius="md">
            <Text size="xs" c="dimmed">Today</Text>
            <Text size="sm" fw={600}>{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
          </Paper>
          <Tooltip label="Refresh dashboard">
            <ActionIcon size={42} variant="filled" color="maroon" onClick={() => loadDashboard(true)} loading={refreshing}>
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
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Paper withBorder shadow="sm" p="md" h="100%">
            <Group justify="space-between" mb="md">
              <Box>
                <Title order={4}>Live Fleet Activity</Title>
                <Text size="xs" c="dimmed">Latest GPS positions from active trips</Text>
              </Box>
              <Badge color="green" variant="light">{locations.length} live</Badge>
            </Group>
            {mapPoints.length ? (
              <>
                <Box
                  h={260}
                  pos="relative"
                  style={{
                    overflow: 'hidden',
                    borderRadius: 12,
                    backgroundColor: '#f5f7fa',
                    backgroundImage: 'linear-gradient(#e7ebf0 1px, transparent 1px), linear-gradient(90deg, #e7ebf0 1px, transparent 1px)',
                    backgroundSize: '52px 52px',
                  }}
                >
                  <Box pos="absolute" inset="50% 0 auto 0" h={3} bg="gray.3" />
                  <Box pos="absolute" inset="0 auto 0 45%" w={3} bg="gray.3" />
                  {mapPoints.map(point => (
                    <Tooltip
                      key={point.trip?.id || point.vehicle?.id}
                      label={`${point.vehicle?.plateNumber || 'Bus'} • ${point.trip?.route?.name || 'Active route'}`}
                    >
                      <ThemeIcon
                        pos="absolute"
                        left={`${point.x}%`}
                        top={`${point.y}%`}
                        size={34}
                        radius="xl"
                        c="white"
                        style={{ transform: 'translate(-50%, -50%)', background: point.color, boxShadow: '0 5px 14px rgba(15, 23, 42, 0.22)' }}
                      >
                        <IconBus size={17} />
                      </ThemeIcon>
                    </Tooltip>
                  ))}
                </Box>
                <SimpleGrid cols={{ base: 1, sm: 2 }} mt="md">
                  {mapPoints.map(point => (
                    <Group key={`legend-${point.trip?.id || point.vehicle?.id}`} gap="xs" wrap="nowrap">
                      <Box w={8} h={8} style={{ borderRadius: 8, background: point.color, flexShrink: 0 }} />
                      <Box style={{ minWidth: 0 }}>
                        <Text size="xs" fw={650} truncate>{point.vehicle?.plateNumber || 'Bus'} • {point.trip?.route?.name}</Text>
                        <Text size="xs" c="dimmed">{point.speed == null ? 'Speed unavailable' : `${Math.round(point.speed)} km/h`} • updated {formatTime(point.recordedAt)}</Text>
                      </Box>
                    </Group>
                  ))}
                </SimpleGrid>
              </>
            ) : <EmptyState message="No buses are currently reporting a live location." />}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Paper withBorder shadow="sm" p="md" h="100%">
            <Group justify="space-between" mb="md">
              <Box>
                <Title order={4}>Alerts &amp; Attention</Title>
                <Text size="xs" c="dimmed">Items that may need action</Text>
              </Box>
              <Badge color={alerts.length ? 'orange' : 'green'} variant="light">{alerts.length}</Badge>
            </Group>
            {alerts.length ? (
              <Stack gap="sm">
                {alerts.map(alert => (
                  <Paper key={alert.key} p="md" bg={`${alert.color}.0`} style={{ borderLeft: `3px solid var(--mantine-color-${alert.color}-6)` }}>
                    <Group align="flex-start" wrap="nowrap">
                      <ThemeIcon color={alert.color} variant="light" size="sm"><IconAlertTriangle size={13} /></ThemeIcon>
                      <Box>
                        <Text size="sm" fw={700}>{alert.title}</Text>
                        <Text size="xs" c="dimmed" mt={2}>{alert.detail}</Text>
                      </Box>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Stack align="center" justify="center" h={240} gap="xs">
                <ThemeIcon size={46} radius="xl" color="green" variant="light"><IconCheck size={22} /></ThemeIcon>
                <Text fw={700}>Everything looks good</Text>
                <Text size="xs" c="dimmed">There are no operational alerts right now.</Text>
              </Stack>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
};

export default DashboardPage;
