import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Badge, Box, Button, Grid, Group, Paper, Progress, Select, SimpleGrid,
  Stack, Text, ThemeIcon, Title,
} from '@mantine/core';
import {
  IconAlertCircle, IconArrowLeft, IconBus, IconCheck, IconClock,
  IconRoute, IconSteeringWheel, IconUsers,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { vehicleAPI } from '../services/api';
import { EmptyState, LoadingState, StatusBadge } from '../components/ui';

const formatMinutes = minutes => {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const VehicleDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [days, setDays] = useState('30');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await vehicleAPI.getTripHistory(id, days);
      setData(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Vehicle history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [days, id]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <LoadingState label="Loading vehicle history..." />;
  if (!data) {
    return (
      <Stack>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/vehicles')} style={{ alignSelf: 'flex-start' }}>Back to vehicles</Button>
        <Alert color="red" icon={<IconAlertCircle size={16} />}>{error || 'Vehicle not found.'}</Alert>
      </Stack>
    );
  }

  const { vehicle, stats, trips, routeUsage, driverUsage } = data;
  const attendance = stats.attendance || {};

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Group align="flex-start">
          <Button variant="subtle" px="xs" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/vehicles')}>Vehicles</Button>
          <Box>
            <Group gap="sm">
              <Title order={2}>{vehicle.plateNumber}</Title>
              <StatusBadge status={vehicle.status}>{vehicle.status}</StatusBadge>
            </Group>
            <Text size="sm" c="dimmed">{vehicle.make || 'Unknown make'} {vehicle.model || ''} • {vehicle.capacity} seats • {vehicle.year || 'Year not recorded'}</Text>
          </Box>
        </Group>
        <Select
          w={170}
          value={days}
          onChange={value => setDays(value || '30')}
          data={[
            { value: '30', label: 'Last 30 days' },
            { value: '90', label: 'Last 90 days' },
            { value: '365', label: 'Last year' },
            { value: 'all', label: 'All time' },
          ]}
        />
      </Group>

      {error && <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        {[
          ['Total trips', stats.totalTrips, IconBus, 'blue'],
          ['Completion rate', `${stats.completionRate}%`, IconCheck, 'green'],
          ['Average trip', formatMinutes(stats.averageDurationMinutes), IconClock, 'orange'],
          ['Operating time', formatMinutes(stats.totalOperatingMinutes), IconRoute, 'violet'],
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
            <Group justify="space-between" mb="md">
              <Box><Title order={4}>Trip status</Title><Text size="xs" c="dimmed">{data.period}</Text></Box>
              <Badge variant="light">{stats.totalTrips} trips</Badge>
            </Group>
            <Stack gap="sm">
              {[
                ['Completed', stats.completed, 'green'],
                ['In progress', stats.inProgress, 'blue'],
                ['Scheduled', stats.scheduled, 'gray'],
                ['Delayed', stats.delayed, 'orange'],
                ['Missed', stats.missed, 'red'],
                ['Cancelled', stats.cancelled, 'red'],
              ].map(([label, value, color]) => (
                <Box key={label}>
                  <Group justify="space-between" mb={4}><Text size="sm">{label}</Text><Text size="sm" fw={700}>{value}</Text></Group>
                  <Progress value={stats.totalTrips ? (value / stats.totalTrips) * 100 : 0} color={color} size="sm" />
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Paper withBorder shadow="sm" p="md" h="100%">
            <Group justify="space-between" mb="md">
              <Box><Title order={4}>Student attendance carried</Title><Text size="xs" c="dimmed">Combined across the selected vehicle&apos;s trips</Text></Box>
              <ThemeIcon color="blue" variant="light"><IconUsers size={17} /></ThemeIcon>
            </Group>
            <SimpleGrid cols={{ base: 2, sm: 5 }}>
              {[
                ['Expected', attendance.expected || 0, 'blue'],
                ['Boarded', attendance.boarded || 0, 'green'],
                ['Dropped off', attendance.droppedOff || 0, 'violet'],
                ['Not boarded', attendance.notBoarded || 0, 'orange'],
                ['Absent', attendance.absent || 0, 'red'],
              ].map(([label, value, color]) => (
                <Paper key={label} bg={`${color}.0`} p="md" ta="center">
                  <Text size="xl" fw={800} c={`${color}.7`}>{value}</Text>
                  <Text size="xs" c="dimmed">{label}</Text>
                </Paper>
              ))}
            </SimpleGrid>
            <Group grow mt="xl" align="flex-start">
              <Box>
                <Group gap="xs" mb="sm"><IconRoute size={17} /><Text fw={700}>Routes used ({stats.uniqueRoutes})</Text></Group>
                <Stack gap={5}>{routeUsage.length ? routeUsage.map(route => <Group key={route.id} justify="space-between"><Text size="sm">{route.name}</Text><Badge size="xs" variant="light">{route.trips} trips</Badge></Group>) : <Text size="sm" c="dimmed">No routes recorded</Text>}</Stack>
              </Box>
              <Box>
                <Group gap="xs" mb="sm"><IconSteeringWheel size={17} /><Text fw={700}>Drivers ({stats.uniqueDrivers})</Text></Group>
                <Stack gap={5}>{driverUsage.length ? driverUsage.map(driver => <Group key={driver.id} justify="space-between"><Text size="sm">{driver.name}</Text><Badge size="xs" variant="light" color="violet">{driver.trips} trips</Badge></Group>) : <Text size="sm" c="dimmed">No drivers recorded</Text>}</Stack>
              </Box>
            </Group>
          </Paper>
        </Grid.Col>
      </Grid>

      <Paper withBorder shadow="sm" p="md">
        <Group justify="space-between" p="md">
          <Box><Title order={4}>Trip history</Title><Text size="xs" c="dimmed">Select any trip for its full roster, map, timeline, and statistics</Text></Box>
          <Badge variant="light">{trips.length} records</Badge>
        </Group>
        {trips.length ? (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
            {trips.map(trip => {
              const attendanceTotal = trip.attendance.expected || 0;
              const accountedFor = trip.attendance.boarded + trip.attendance.absent;
              const attendanceProgress = attendanceTotal ? Math.round((accountedFor / attendanceTotal) * 100) : 0;
              return (
                <Paper
                  key={trip.id}
                  withBorder
                  p="md"
                  radius="md"
                  shadow="xs"
                  style={{ cursor: 'pointer', transition: 'transform 120ms ease, box-shadow 120ms ease' }}
                  onClick={() => navigate(`/trips/${trip.id}`)}
                >
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Box style={{ minWidth: 0 }}>
                      <Text fw={750} truncate>{trip.route?.name || 'Unnamed route'}</Text>
                      <Text size="xs" c="dimmed" mt={2}>{trip.scheduledDate}</Text>
                    </Box>
                    <StatusBadge status={trip.status}>{trip.status.replace('_', ' ')}</StatusBadge>
                  </Group>

                  <Group gap="xs" mt="md">
                    <Badge variant="light" color={trip.type === 'morning_pickup' ? 'yellow' : 'blue'}>
                      {trip.type === 'morning_pickup' ? 'Morning pickup' : 'Afternoon drop-off'}
                    </Badge>
                    <Badge variant="light" color="gray">{formatMinutes(trip.durationMinutes)}</Badge>
                  </Group>

                  <Stack gap={7} mt="md">
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="xs" c="dimmed">Driver</Text>
                      <Text size="xs" fw={650} truncate>{trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : 'Not assigned'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Students expected</Text>
                      <Text size="xs" fw={700}>{trip.attendance.expected}</Text>
                    </Group>
                  </Stack>

                  <Box mt="md">
                    <Group justify="space-between" mb={5}>
                      <Text size="xs" fw={650}>Attendance progress</Text>
                      <Text size="xs" fw={700}>{attendanceProgress}%</Text>
                    </Group>
                    <Progress value={attendanceProgress} color="green" size="sm" />
                    <SimpleGrid cols={3} spacing={4} mt="sm">
                      <Box ta="center" bg="green.0" p={6} style={{ borderRadius: 6 }}>
                        <Text size="sm" fw={800} c="green.7">{trip.attendance.boarded}</Text>
                        <Text fz={10} c="dimmed">Boarded</Text>
                      </Box>
                      <Box ta="center" bg="orange.0" p={6} style={{ borderRadius: 6 }}>
                        <Text size="sm" fw={800} c="orange.7">{trip.attendance.notBoarded}</Text>
                        <Text fz={10} c="dimmed">Pending</Text>
                      </Box>
                      <Box ta="center" bg="red.0" p={6} style={{ borderRadius: 6 }}>
                        <Text size="sm" fw={800} c="red.7">{trip.attendance.absent}</Text>
                        <Text fz={10} c="dimmed">Absent</Text>
                      </Box>
                    </SimpleGrid>
                  </Box>

                  <Button fullWidth variant="light" mt="md" onClick={() => navigate(`/trips/${trip.id}`)}>
                    View trip details
                  </Button>
                </Paper>
              );
            })}
          </SimpleGrid>
        ) : <EmptyState message="This vehicle has no trips in the selected period." />}
      </Paper>
    </Stack>
  );
};

export default VehicleDetailsPage;
