import React, { useEffect } from 'react';
import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import { AppShell, Burger, Group, NavLink, Text, Stack, Avatar, Button, Divider, ScrollArea, Box, Image } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconLayoutDashboard, IconBus, IconSteeringWheel, IconBackpack, IconUsers, IconRoute, IconBusStop, IconHistory, IconLogout,
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
  { to: '/trip-history', label: 'Trip History', icon: IconHistory },
  { to: '/absences', label: 'Absence Review', icon: IconBackpack },
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
  useEffect(() => { document.getElementById('main-content')?.focus({ preventScroll: true }); }, [location.pathname]);

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Burger aria-label={opened ? 'Close navigation' : 'Open navigation'} opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
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

      <AppShell.Navbar aria-label="Main navigation" p="md" bg="carribu.8" style={{ borderColor: 'var(--mantine-color-carribu-9)' }}>
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
                  active={location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)}
                  onClick={close}
                  variant="filled"
                  color="carribu"
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

      <AppShell.Main id="main-content" tabIndex={-1} bg="var(--mantine-color-gray-0)">{children}</AppShell.Main>
    </AppShell>
  );
};

export default AppLayout;
