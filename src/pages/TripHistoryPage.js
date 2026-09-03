import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Box, Button, Grid, Group, Paper, Progress, Select, SimpleGrid,
  Stack, Text, ThemeIcon, Title,
} from '@mantine/core';
import {
  IconAlertCircle, IconBus, IconCalendarStats, IconCheck, IconClock,
  IconHistory, IconRoute, IconSteeringWheel, IconUsers,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { tripAPI } from '../services/api';
import { EmptyState, LoadingState, StatusBadge } from '../components/ui';

const HISTORICAL_STATUSES = ['completed', 'missed', 'cancelled'];

const formatMinutes = minutes => {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const formatClock = value => {
  if (!value) return 'Time not set';
  const [hours, minutes] = value.split(':');
  const hour = Number(hours);
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const TripHistoryPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('30');
  const [status, setStatus] = useState('all');
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const end = new Date();
      const params = { endDate: end.toISOString().split('T')[0] };
      if (period !== 'all') {
        const start = new Date(end);
        start.setDate(start.getDate() - (Number(period) - 1));
        params.startDate = start.toISOString().split('T')[0];
      }
      const { data } = await tripAPI.getAll(params);
      setTrips((data.trips || []).filter(trip => HISTORICAL_STATUSES.includes(trip.status)));
    } catch (err) {
      setError(err.response?.data?.error || 'Trip history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const visibleTrips = useMemo(
    () => status === 'all' ? trips : trips.filter(trip => trip.status === status),
    [status, trips],
  );

  const analytics = useMemo(() => {
    const completed = trips.filter(trip => trip.status === 'completed');
    const durations = completed
      .filter(trip => trip.startedAt && trip.endedAt)
      .map(trip => Math.max(0, Math.round((new Date(trip.endedAt) - new Date(trip.startedAt)) / 60000)));
    const attendance = trips.reduce((totals, trip) => {
      const stats = trip.studentStats || {};
      totals.expected += Number(stats.total || 0);
      totals.transported += Number(stats.onBus || 0) + Number(stats.droppedOff || 0);
      totals.absent += Number(stats.absent || 0);
      totals.unaccounted += Number(stats.pending || 0) + Number(stats.arrived || 0);
      return totals;
    }, { expected: 0, transported: 0, absent: 0, unaccounted: 0 });

    const routeMap = new Map();
    const driverMap = new Map();
    const vehicleMap = new Map();
    trips.forEach(trip => {
      if (trip.route) {
        const route = routeMap.get(trip.route.id) || { id: trip.route.id, name: trip.route.name, total: 0, completed: 0, durations: [] };
        route.total += 1;
        if (trip.status === 'completed') route.completed += 1;
        if (trip.status === 'completed' && trip.startedAt && trip.endedAt) {
          route.durations.push(Math.max(0, Math.round((new Date(trip.endedAt) - new Date(trip.startedAt)) / 60000)));
        }
        routeMap.set(trip.route.id, route);
      }
      if (trip.driver) {
        const driver = driverMap.get(trip.driver.id) || { id: trip.driver.id, name: `${trip.driver.firstName} ${trip.driver.lastName}`, trips: 0 };
        driver.trips += 1;
        driverMap.set(trip.driver.id, driver);
      }
      if (trip.vehicle) {
        const vehicle = vehicleMap.get(trip.vehicle.id) || { id: trip.vehicle.id, name: trip.vehicle.plateNumber, trips: 0 };
        vehicle.trips += 1;
        vehicleMap.set(trip.vehicle.id, vehicle);
      }
    });

    return {
      completed: completed.length,
      missed: trips.filter(trip => trip.status === 'missed').length,
      cancelled: trips.filter(trip => trip.status === 'cancelled').length,
      completionRate: trips.length ? Math.round((completed.length / trips.length) * 100) : 0,
      averageDuration: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
      operatingMinutes: durations.reduce((sum, value) => sum + value, 0),
      attendance,
      routes: [...routeMap.values()]
        .map(route => ({
          ...route,
          completionRate: route.total ? Math.round((route.completed / route.total) * 100) : 0,
          averageDuration: route.durations.length
            ? Math.round(route.durations.reduce((sum, value) => sum + value, 0) / route.durations.length)
            : null,
        }))
        .sort((a, b) => b.total - a.total),
      drivers: [...driverMap.values()].sort((a, b) => b.trips - a.trips),
      vehicles: [...vehicleMap.values()].sort((a, b) => b.trips - a.trips),
    };
  }, [trips]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Group gap="xs"><IconHistory size={28} /><Title order={2}>Trip History</Title></Group>
          <Text size="sm" c="dimmed">Review completed, missed, and cancelled trips with operational analysis.</Text>
        </Box>
        <Group>
          <Select
            w={170}
            value={period}
            onChange={value => setPeriod(value || '30')}
            data={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
              { value: '365', label: 'Last year' },
              { value: 'all', label: 'All time' },
            ]}
          />
          <Select
            w={160}
            value={status}
            onChange={value => setStatus(value || 'all')}
            data={[
              { value: 'all', label: 'All outcomes' },
              { value: 'completed', label: 'Completed' },
              { value: 'missed', label: 'Missed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </Group>
      </Group>

      {error && <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        {[
          ['Historical trips', trips.length, IconCalendarStats, 'blue'],
          ['Completion rate', `${analytics.completionRate}%`, IconCheck, 'green'],
          ['Average duration', formatMinutes(analytics.averageDuration), IconClock, 'orange'],
          ['Operating time', formatMinutes(analytics.operatingMinutes), IconBus, 'violet'],
        ].map(([label, value, Icon, color]) => (
          <Paper key={label} withBorder shadow="sm" p="md">
            <Group wrap="nowrap">
              <ThemeIcon size={42} variant="light" color={color}><Icon size={20} /></ThemeIcon>
              <Box><Text size="xs" c="dimmed">{label}</Text><Text size="xl" fw={800}>{value}</Text></Box>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Paper withBorder shadow="sm" p="md" h="100%">
            <Group justify="space-between" mb="md"><Title order={4}>Trip outcomes</Title><Badge variant="light">{trips.length} trips</Badge></Group>
            <Stack gap="md">
              {[
                ['Completed', analytics.completed, 'green'],
                ['Missed', analytics.missed, 'red'],
                ['Cancelled', analytics.cancelled, 'orange'],
              ].map(([label, value, color]) => (
                <Box key={label}>
                  <Group justify="space-between" mb={5}><Text size="sm">{label}</Text><Text size="sm" fw={700}>{value}</Text></Group>
                  <Progress color={color} value={trips.length ? (value / trips.length) * 100 : 0} />
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Paper withBorder shadow="sm" p="md" h="100%">
            <Group justify="space-between" mb="md"><Title order={4}>Student attendance</Title><ThemeIcon variant="light"><IconUsers size={17} /></ThemeIcon></Group>
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              {[
                ['Expected', analytics.attendance.expected, 'blue'],
                ['Transported', analytics.attendance.transported, 'green'],
                ['Absent', analytics.attendance.absent, 'red'],
                ['Unaccounted', analytics.attendance.unaccounted, 'orange'],
              ].map(([label, value, color]) => (
                <Paper key={label} bg={`${color}.0`} p="md" ta="center">
                  <Text size="xl" fw={800} c={`${color}.7`}>{value}</Text>
                  <Text size="xs" c="dimmed">{label}</Text>
                </Paper>
              ))}
            </SimpleGrid>
          </Paper>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Paper withBorder shadow="sm" p="md" h="100%">
            <Group justify="space-between" mb="md"><Title order={4}>Route performance</Title><IconRoute size={19} /></Group>
            {analytics.routes.length ? (
              <Stack gap="md">
                {analytics.routes.map(route => (
                  <Box key={route.id}>
                    <Group justify="space-between" wrap="nowrap">
                      <Box style={{ minWidth: 0 }}>
                        <Text size="sm" fw={700} truncate>{route.name}</Text>
                        <Text size="xs" c="dimmed">{route.completed}/{route.total} completed • Average {formatMinutes(route.averageDuration)}</Text>
                      </Box>
                      <Text size="sm" fw={800}>{route.completionRate}%</Text>
                    </Group>
                    <Progress value={route.completionRate} color="green" size="sm" mt={5} />
                  </Box>
                ))}
              </Stack>
            ) : <EmptyState message="No route history in this period." />}
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Paper withBorder shadow="sm" p="md" h="100%">
            <SimpleGrid cols={2}>
              <Box>
                <Group gap="xs" mb="sm"><IconSteeringWheel size={17} /><Text fw={700}>Drivers</Text></Group>
                <Stack gap={6}>{analytics.drivers.slice(0, 6).map(driver => <Group key={driver.id} justify="space-between" wrap="nowrap"><Text size="sm" truncate>{driver.name}</Text><Badge size="xs" variant="light">{driver.trips}</Badge></Group>)}</Stack>
              </Box>
              <Box>
                <Group gap="xs" mb="sm"><IconBus size={17} /><Text fw={700}>Vehicles</Text></Group>
                <Stack gap={6}>{analytics.vehicles.slice(0, 6).map(vehicle => <Group key={vehicle.id} justify="space-between" wrap="nowrap"><Text size="sm" truncate>{vehicle.name}</Text><Badge size="xs" color="blue" variant="light">{vehicle.trips}</Badge></Group>)}</Stack>
              </Box>
            </SimpleGrid>
          </Paper>
        </Grid.Col>
      </Grid>

      <Paper withBorder shadow="sm" p="md">
        <Group justify="space-between" mb="md">
          <Box><Title order={4}>Past trips</Title><Text size="xs" c="dimmed">Open a trip for its map, roster, attendance, wait times, and event timeline.</Text></Box>
          <Badge variant="light">{visibleTrips.length} shown</Badge>
        </Group>
        {loading ? <LoadingState label="Loading trip history..." /> : visibleTrips.length ? (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
            {visibleTrips.map(trip => {
              const stats = trip.studentStats || {};
              const duration = trip.startedAt && trip.endedAt
                ? Math.max(0, Math.round((new Date(trip.endedAt) - new Date(trip.startedAt)) / 60000))
                : null;
              const accounted = Number(stats.onBus || 0) + Number(stats.droppedOff || 0) + Number(stats.absent || 0);
              const attendanceProgress = stats.total ? Math.min(100, Math.round((accounted / stats.total) * 100)) : 0;
              return (
                <Paper key={trip.id} withBorder shadow="xs" p="md">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Box style={{ minWidth: 0 }}><Text fw={750} truncate>{trip.route?.name || 'Unnamed route'}</Text><Text size="xs" c="dimmed">{trip.scheduledDate} • {formatClock(trip.scheduledTime)}</Text></Box>
                    <StatusBadge status={trip.status}>{trip.status}</StatusBadge>
                  </Group>
                  <Group gap={6} mt="md">
                    <Badge variant="light" color={trip.type === 'morning_pickup' ? 'yellow' : 'blue'}>{trip.type === 'morning_pickup' ? 'Morning pickup' : 'Afternoon drop-off'}</Badge>
                    <Badge variant="light" color="gray">{formatMinutes(duration)}</Badge>
                  </Group>
                  <Stack gap={6} mt="md">
                    <Group justify="space-between"><Text size="xs" c="dimmed">Driver</Text><Text size="xs" fw={700}>{trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : 'Not assigned'}</Text></Group>
                    <Group justify="space-between"><Text size="xs" c="dimmed">Vehicle</Text><Text size="xs" fw={700}>{trip.vehicle?.plateNumber || 'Not assigned'}</Text></Group>
                  </Stack>
                  <Box mt="md">
                    <Group justify="space-between" mb={5}><Text size="xs" fw={650}>Attendance accounted for</Text><Text size="xs" fw={700}>{attendanceProgress}%</Text></Group>
                    <Progress value={attendanceProgress} color="green" size="sm" />
                  </Box>
                  <Button fullWidth variant="light" mt="md" onClick={() => navigate(`/trips/${trip.id}`)}>View full analysis</Button>
                </Paper>
              );
            })}
          </SimpleGrid>
        ) : <EmptyState message="No historical trips match these filters." />}
      </Paper>
    </Stack>
  );
};

export default TripHistoryPage;
