import React from 'react';
import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import { AppShell, Burger, Group, NavLink, Text, Stack, Avatar, Button, Divider, ScrollArea, Box, Image } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconLayoutDashboard, IconBus, IconSteeringWheel, IconBackpack, IconUsers, IconRoute, IconBusStop, IconLogout,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { to: '/vehicles', label: 'Vehicles', icon: IconBus },
  { to: '/drivers', label: 'Drivers', icon: IconSteeringWheel },
  { to: '/students', label: 'Students', icon: IconBackpack },
  { to: '/parents', label: 'Parents', icon: IconUsers },
  { to: '/routes', label: 'Routes', icon: IconRoute },
  { to: '/trips', label: 'Trips', icon: IconBusStop },
];

// Shared responsive shell: header + collapsible navbar (drawer on mobile).
// Replaces the old fixed-position .sidebar/.main-content CSS layout while
// preserving the same nav destinations, active-route highlighting, user
// identity display and logout action.
const AppLayout = ({ children }) => {
  const [opened, { toggle, close }] = useDisclosure(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Image
              src="/carribu-logo.jpg"
              alt="Carribu School Transport"
              h={58}
              w="auto"
              fit="contain"
            />
          </Group>
          <Group visibleFrom="sm" gap="sm">
            <Avatar radius="xl" color="carribu" variant="filled">{initials || '?'}</Avatar>
            <Box>
              <Text size="sm" fw={600} lh={1.2}>{user?.firstName} {user?.lastName}</Text>
              <Text size="xs" c="dimmed" tt="capitalize" lh={1.2}>{user?.role} • {user?.school?.name || 'School'}</Text>
            </Box>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" bg="maroon.7" style={{ borderColor: 'var(--mantine-color-maroon-8)' }}>
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={4}>
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  component={RouterNavLink}
                  to={item.to}
                  label={item.label}
                  leftSection={<Icon size={18} stroke={1.6} />}
                  active={location.pathname === item.to}
                  onClick={close}
                  variant="filled"
                  color="maroon"
                  className="sidebar-nav-link"
                />
              );
            })}
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
          <Divider mb="sm" color="rgba(255, 255, 255, 0.25)" />
          <Stack gap={2} mb="sm" hiddenFrom="sm">
            <Text size="sm" fw={600} c="white">{user?.firstName} {user?.lastName}</Text>
            <Text size="xs" c="white" opacity={0.75} tt="capitalize">{user?.role} • {user?.school?.name || 'School'}</Text>
          </Stack>
          <Button
            fullWidth
            variant="transparent"
            c="white"
            leftSection={<IconLogout size={16} />}
            onClick={logout}
            style={{ border: '1px solid rgba(255, 255, 255, 0.35)' }}
          >
            Logout
          </Button>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main bg="var(--mantine-color-gray-0)">{children}</AppShell.Main>
    </AppShell>
  );
};

export default AppLayout;
