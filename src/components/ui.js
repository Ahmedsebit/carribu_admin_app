import React from 'react';
import { Badge, Paper, Group, Text, ThemeIcon, SimpleGrid, Stack, Title, Box, Center, Loader } from '@mantine/core';

// Small collection of shared presentation helpers used across every page so
// that pages don't each re-implement the same header / stat-card / badge /
// empty-state markup with slightly different inline styles.

// Maps every status/type vocabulary used across vehicles, trips, routes and
// live-trip rosters to a Mantine color. Centralising this avoids duplicating
// the mapping (and its inevitable drift) in each page.
const STATUS_COLORS = {
  active: 'green', completed: 'green', on_time: 'green', onbus: 'green', dropped: 'green',
  maintenance: 'yellow', scheduled: 'yellow', upcoming: 'yellow', morning: 'yellow', arrived: 'yellow', delayed: 'orange',
  retired: 'gray', waiting: 'gray',
  in_progress: 'blue', afternoon: 'blue',
  both: 'indigo',
  cancelled: 'red', missed: 'red', not_started: 'red', absent: 'red',
};

export const statusColor = (key) => STATUS_COLORS[key] || 'gray';

export const StatusBadge = ({ status, children, ...props }) => (
  <Badge color={statusColor(status)} variant="light" {...props}>{children}</Badge>
);

export const PageHeader = ({ title, subtitle, actions }) => (
  <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap" gap="sm">
    <Box>
      <Title order={2}>{title}</Title>
      {subtitle && <Text c="dimmed" size="sm">{subtitle}</Text>}
    </Box>
    {actions && <Group gap="sm">{actions}</Group>}
  </Group>
);

export const StatsGrid = ({ children, cols }) => (
  <SimpleGrid cols={{ base: 1, xs: 2, sm: cols || 4 }} spacing="md" mb="lg">{children}</SimpleGrid>
);

export const StatCard = ({ icon, value, label }) => (
  <Paper
    p="md"
    radius="md"
    shadow="sm"
    style={{ background: 'linear-gradient(135deg, var(--mantine-color-maroon-6), var(--mantine-color-maroon-8))' }}
  >
    <Group>
      <ThemeIcon size={48} radius="md" c="white" bg="rgba(255, 255, 255, 0.16)">{icon}</ThemeIcon>
      <Stack gap={0}>
        <Text size="xl" fw={700} c="white">{value}</Text>
        <Text size="xs" c="white" opacity={0.82}>{label}</Text>
      </Stack>
    </Group>
  </Paper>
);

export const EmptyState = ({ message = 'No data found.' }) => (
  <Center py="xl">
    <Text c="dimmed" size="sm">{message}</Text>
  </Center>
);

export const LoadingState = ({ label = 'Loading...' }) => (
  <Center py="xl">
    <Stack align="center" gap="xs">
      <Loader color="carribu" />
      <Text c="dimmed" size="sm">{label}</Text>
    </Stack>
  </Center>
);
