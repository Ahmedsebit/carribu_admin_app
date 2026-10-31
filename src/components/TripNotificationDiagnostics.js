import React, { useEffect, useState } from 'react';
import { Alert, Badge, Group, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { tripAPI } from '../services/api';

export default function TripNotificationDiagnostics({ tripId }) {
  const [state, setState] = useState(null);
  useEffect(() => {
    let active = true;
    let timer;
    const controller = new AbortController();
    setState(null);
    const load = async () => {
      try {
        const { data } = await tripAPI.getNotifications(tripId, { signal: controller.signal });
        if (active) setState({ events: data.events, error: '' });
      } catch (error) {
        if (active && !controller.signal.aborted) setState({
          events: [], error: error.response?.data?.error || 'Notification diagnostics could not be loaded.',
        });
      } finally {
        if (active) timer = setTimeout(load, 15000);
      }
    };
    load();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [tripId]);
  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Title order={4}>Parent notification delivery</Title>
        <Text size="xs" c="dimmed">
          In-app messages are saved with the trip action. Accepted means the push provider accepted the notification, not that the parent read it.
        </Text>
        {!state ? <Text size="sm">Loading delivery diagnostics...</Text>
          : state.error ? <Alert color="red">{state.error}</Alert>
            : !state.events.length ? <Text size="sm">No trip notifications queued yet.</Text>
              : (
                <>
                  <Group>{[...new Set(state.events.map(event => event.status))].map(status => (
                    <Badge key={status} color={status === 'failed' ? 'red' : status === 'accepted' ? 'green' : 'yellow'}>
                      {status.replace(/_/g, ' ')}: {state.events.filter(event => event.status === status).length}
                    </Badge>
                  ))}</Group>
                  <Table.ScrollContainer minWidth={500}>
                    <Table>
                      <Table.Thead><Table.Tr><Table.Th>Event</Table.Th><Table.Th>Status</Table.Th><Table.Th>Attempts</Table.Th><Table.Th>Diagnostic</Table.Th></Table.Tr></Table.Thead>
                      <Table.Tbody>{state.events.slice(0, 50).map(event => (
                        <Table.Tr key={event.id}>
                          <Table.Td>{event.event}</Table.Td><Table.Td>{event.status.replace(/_/g, ' ')}</Table.Td>
                          <Table.Td>{event.attempts}</Table.Td>
                          <Table.Td>
                            {event.lastError || '-'}
                            <Text size="xs" c="dimmed">
                              {Object.entries(event.providerResults || {}).map(([provider, result]) => `${provider}: ${result.status.replace(/_/g, ' ')}`).join('; ')}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}</Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </>
              )}
      </Stack>
    </Paper>
  );
}
