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
import { routeAPI } from '../services/api';
import { EmptyState, LoadingState, StatusBadge } from '../components/ui';

const formatMinutes = minutes => {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const RouteDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [days, setDays] = useState('30');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await routeAPI.getTripHistory(id, days);
      setData(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Route statistics could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [days, id]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <LoadingState label="Loading route statistics..." />;
  if (!data) {
    return (
      <Stack>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/routes')} style={{ alignSelf: 'flex-start' }}>Back to routes</Button>
        <Alert color="red" icon={<IconAlertCircle size={16} />}>{error || 'Route not found.'}</Alert>
      </Stack>
    );
  }

  const { route, stats, trips, driverUsage, vehicleUsage } = data;
  const attendance = stats.attendance || {};

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Group align="flex-start">
          <Button variant="subtle" px="xs" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/routes')}>Routes</Button>
          <ThemeIcon size={48} radius="xl" color="violet" variant="light"><IconRoute size={24} /></ThemeIcon>
          <Box>
            <Group gap="sm">
              <Title order={2}>{route.name}</Title>
              <StatusBadge status={route.type}>{route.type}</StatusBadge>
              <StatusBadge status={route.isActive ? 'active' : 'retired'}>{route.isActive ? 'Active' : 'Inactive'}</StatusBadge>
            </Group>
            <Text size="sm" c="dimmed">{route.description || 'No description'} • Departs {route.departureTime || 'at an unset time'}</Text>
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
          ['Total trips', stats.totalTrips, IconRoute, 'violet'],
          ['Completion rate', `${stats.completionRate}%`, IconCheck, 'green'],
          ['Average trip', formatMinutes(stats.averageDurationMinutes), IconClock, 'orange'],
          ['Operating time', formatMinutes(stats.totalOperatingMinutes), IconBus, 'blue'],
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
              <Box><Title order={4}>Trip performance</Title><Text size="xs" c="dimmed">{data.period}</Text></Box>
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
              <Box><Title order={4}>Route attendance</Title><Text size="xs" c="dimmed">Combined attendance across trips in this period</Text></Box>
              <ThemeIcon color="violet" variant="light"><IconUsers size={17} /></ThemeIcon>
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
            <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xl">
              <Box>
                <Group gap="xs" mb="sm"><IconSteeringWheel size={17} /><Text fw={700}>Drivers used ({stats.uniqueDrivers})</Text></Group>
                <Stack gap={5}>{driverUsage.length ? driverUsage.map(driver => <Group key={driver.id} justify="space-between"><Text size="sm">{driver.name}</Text><Badge size="xs" variant="light" color="green">{driver.trips} trips</Badge></Group>) : <Text size="sm" c="dimmed">No drivers recorded</Text>}</Stack>
              </Box>
              <Box>
                <Group gap="xs" mb="sm"><IconBus size={17} /><Text fw={700}>Vehicles used ({stats.uniqueVehicles})</Text></Group>
                <Stack gap={5}>{vehicleUsage.length ? vehicleUsage.map(vehicle => <Group key={vehicle.id} justify="space-between"><Text size="sm">{vehicle.plateNumber}</Text><Badge size="xs" variant="light" color="blue">{vehicle.trips} trips</Badge></Group>) : <Text size="sm" c="dimmed">No vehicles recorded</Text>}</Stack>
              </Box>
            </SimpleGrid>
          </Paper>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Paper withBorder shadow="sm" p="md" h="100%">
            <Title order={4} mb="md">Current assignment</Title>
            <Stack gap="md">
              <Group wrap="nowrap"><ThemeIcon color="blue" variant="light"><IconBus size={17} /></ThemeIcon><Box><Text size="xs" c="dimmed">Vehicle</Text><Text size="sm" fw={700}>{route.vehicle ? `${route.vehicle.plateNumber} • ${route.vehicle.make || ''} ${route.vehicle.model || ''}` : 'Not assigned'}</Text></Box></Group>
              <Group wrap="nowrap"><ThemeIcon color="green" variant="light"><IconSteeringWheel size={17} /></ThemeIcon><Box><Text size="xs" c="dimmed">Driver</Text><Text size="sm" fw={700}>{route.driver ? `${route.driver.firstName} ${route.driver.lastName}` : 'Not assigned'}</Text></Box></Group>
            </Stack>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper withBorder shadow="sm" p="md" h="100%">
            <Group justify="space-between" mb="md"><Title order={4}>Assigned students</Title><Badge variant="light" color="violet">{route.students?.length || 0}</Badge></Group>
            {route.students?.length ? (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                {[...route.students].sort((a, b) => (a.RouteStudent?.stopOrder || 0) - (b.RouteStudent?.stopOrder || 0)).map((student, index) => (
                  <Paper key={student.id} bg="gray.0" p="sm">
                    <Group wrap="nowrap"><Badge circle color="violet">{index + 1}</Badge><Box style={{ minWidth: 0 }}><Text size="sm" fw={700} truncate>{student.firstName} {student.lastName}</Text><Text size="xs" c="dimmed">{student.grade || 'Grade not set'}</Text></Box></Group>
                  </Paper>
                ))}
              </SimpleGrid>
            ) : <Text size="sm" c="dimmed">No students are assigned to this route.</Text>}
          </Paper>
        </Grid.Col>
      </Grid>

      <Paper withBorder shadow="sm" p="md">
        <Group justify="space-between" mb="md">
          <Box><Title order={4}>Route trip history</Title><Text size="xs" c="dimmed">Open a trip for its live map, roster, events, and detailed statistics</Text></Box>
          <Badge variant="light">{trips.length} records</Badge>
        </Group>
        {trips.length ? (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
            {trips.map(trip => {
              const expected = trip.attendance.expected || 0;
              const progress = expected ? Math.round(((trip.attendance.boarded + trip.attendance.absent) / expected) * 100) : 0;
              return (
                <Paper key={trip.id} withBorder shadow="xs" p="md">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Box><Text fw={750}>{trip.scheduledDate}</Text><Text size="xs" c="dimmed">{trip.scheduledTime || 'Time not set'}</Text></Box>
                    <StatusBadge status={trip.status}>{trip.status.replace('_', ' ')}</StatusBadge>
                  </Group>
                  <Group gap="xs" mt="md">
                    <Badge variant="light" color={trip.type === 'morning_pickup' ? 'yellow' : 'blue'}>{trip.type === 'morning_pickup' ? 'Morning pickup' : 'Afternoon drop-off'}</Badge>
                    <Badge variant="light" color="gray">{formatMinutes(trip.durationMinutes)}</Badge>
                  </Group>
                  <Stack gap={6} mt="md">
                    <Group justify="space-between"><Text size="xs" c="dimmed">Driver</Text><Text size="xs" fw={700}>{trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : 'Not assigned'}</Text></Group>
                    <Group justify="space-between"><Text size="xs" c="dimmed">Vehicle</Text><Text size="xs" fw={700}>{trip.vehicle?.plateNumber || 'Not assigned'}</Text></Group>
                  </Stack>
                  <Box mt="md">
                    <Group justify="space-between" mb={5}><Text size="xs" fw={650}>Attendance progress</Text><Text size="xs" fw={700}>{progress}%</Text></Group>
                    <Progress value={progress} color="green" size="sm" />
                    <SimpleGrid cols={3} spacing={4} mt="sm">
                      {[
                        ['Boarded', trip.attendance.boarded, 'green'],
                        ['Pending', trip.attendance.notBoarded, 'orange'],
                        ['Absent', trip.attendance.absent, 'red'],
                      ].map(([label, value, color]) => <Box key={label} ta="center" bg={`${color}.0`} p={6} style={{ borderRadius: 6 }}><Text size="sm" fw={800} c={`${color}.7`}>{value}</Text><Text fz={10} c="dimmed">{label}</Text></Box>)}
                    </SimpleGrid>
                  </Box>
                  <Button fullWidth variant="light" mt="md" onClick={() => navigate(`/trips/${trip.id}`)}>View trip details</Button>
                </Paper>
              );
            })}
          </SimpleGrid>
        ) : <EmptyState message="This route has no trips in the selected period." />}
      </Paper>
    </Stack>
  );
};

export default RouteDetailsPage;
