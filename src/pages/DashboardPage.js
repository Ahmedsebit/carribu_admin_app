import React, { useState, useEffect } from 'react';
import { Grid, Paper, Group, Title, Text, Table, ThemeIcon, Badge } from '@mantine/core';
import { IconBus, IconBackpack, IconRoute, IconSteeringWheel, IconChartBar, IconBusStop } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { schoolAPI, vehicleAPI, tripAPI } from '../services/api';
import { PageHeader, StatsGrid, StatCard, EmptyState, LoadingState, statusColor } from '../components/ui';

const FLEET_TILES = [
  { key: 'active', label: 'Active', shade: 6 },
  { key: 'maintenance', label: 'Maintenance', shade: 7 },
  { key: 'retired', label: 'Retired', shade: 8 },
  { key: 'total', label: 'Total', shade: 9 },
];

const DashboardPage = () => {
  const { user } = useAuth();
  const [dash, setDash] = useState(null);
  const [vStats, setVStats] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.schoolId) return;
    (async () => {
      try {
        const [d, v, t] = await Promise.all([
          schoolAPI.getDashboard(user.schoolId),
          vehicleAPI.getStats(),
          tripAPI.getAll({ date: new Date().toISOString().split('T')[0] }),
        ]);
        setDash(d.data.dashboard);
        setVStats(v.data.stats);
        setTrips(t.data.trips);
      } catch (e) { /* ignore, page renders with defaults */ }
      finally { setLoading(false); }
    })();
  }, [user]);

  if (loading) return <LoadingState label="Loading dashboard..." />;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Welcome back, ${user?.firstName}!`} />

      <StatsGrid>
        <StatCard icon={<IconBus size={24} />} value={dash?.vehicleCount || 0} label="Active Vehicles" color="blue" />
        <StatCard icon={<IconBackpack size={24} />} value={dash?.studentCount || 0} label="Students" color="green" />
        <StatCard icon={<IconRoute size={24} />} value={dash?.routeCount || 0} label="Routes" color="yellow" />
        <StatCard icon={<IconSteeringWheel size={24} />} value={dash?.driverCount || 0} label="Drivers" color="red" />
      </StatsGrid>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper withBorder radius="md" shadow="sm">
            <Group p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
              <ThemeIcon variant="light" color="blue"><IconBus size={16} /></ThemeIcon>
              <Title order={4}>Fleet Status</Title>
            </Group>
            <div style={{ padding: 16 }}>
              {vStats ? (
                <Grid>
                  {FLEET_TILES.map(tile => (
                    <Grid.Col span={6} key={tile.key}>
                      <Paper bg={`maroon.${tile.shade}`} p="md" radius="md" ta="center">
                        <Text size="xl" fw={700} c="white">{vStats[tile.key] ?? 0}</Text>
                        <Text size="xs" c="white" opacity={0.82}>{tile.label}</Text>
                      </Paper>
                    </Grid.Col>
                  ))}
                </Grid>
              ) : <EmptyState message="No data" />}
            </div>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper withBorder radius="md" shadow="sm">
            <Group p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
              <ThemeIcon variant="light" color="carribu"><IconBusStop size={16} /></ThemeIcon>
              <Title order={4}>Today's Trips</Title>
            </Group>
            <div style={{ padding: trips.length ? 0 : 16 }}>
              {trips.length > 0 ? (
                <Table.ScrollContainer minWidth={320}>
                  <Table verticalSpacing="sm" highlightOnHover>
                    <Table.Thead><Table.Tr><Table.Th>Route</Table.Th><Table.Th>Driver</Table.Th><Table.Th>Status</Table.Th></Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {trips.map(t => (
                        <Table.Tr key={t.id}>
                          <Table.Td>{t.route?.name || '-'}</Table.Td>
                          <Table.Td>{t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '-'}</Table.Td>
                          <Table.Td><Badge color={statusColor(t.status)} variant="light">{t.status.replace('_', ' ')}</Badge></Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              ) : <EmptyState message="No trips today." />}
            </div>
          </Paper>
        </Grid.Col>
      </Grid>
    </div>
  );
};

export default DashboardPage;
