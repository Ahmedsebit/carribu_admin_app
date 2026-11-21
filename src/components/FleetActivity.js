import React, { useEffect, useState } from 'react';
import { Alert, Badge, Box, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { EmptyState } from './ui';

export function validFleetPosition(location) {
  return location != null && ['lat', 'lng'].every((key, index) => {
    const value = location[key];
    return value != null && value !== '' && typeof value !== 'boolean'
      && String(value).trim() !== '' && Number.isFinite(Number(value))
      && Math.abs(Number(value)) <= (index === 0 ? 90 : 180);
  });
}

export function fleetStatus(entry, now = Date.now()) {
  if (entry.error) return 'failed';
  if (!validFleetPosition(entry.location)) return 'missing';
  const age = entry.location.recordedAt ? now - new Date(entry.location.recordedAt).getTime() : NaN;
  return !entry.location.isLastKnown && entry.location.isFresh !== false
    && Number.isFinite(age) && age >= -30000 && age <= 120000 ? 'fresh' : 'stale';
}

const labels = { fresh: 'Fresh GPS fix', stale: 'Last known / unverified position', missing: 'No GPS fix', failed: 'GPS update failed' };
const colors = { fresh: 'green', stale: 'yellow', missing: 'gray', failed: 'red' };

const FleetActivity = ({ entries, now = Date.now() }) => {
  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => {
    if (selectedId != null && !entries.some(entry => entry.trip.id === selectedId)) setSelectedId(null);
  }, [entries, selectedId]);
  const selected = entries.find(entry => entry.trip.id === selectedId)
    || entries.find(entry => validFleetPosition(entry.location)) || entries[0];
  const status = selected && fleetStatus(selected, now);
  const position = selected && validFleetPosition(selected.location) ? selected.location : null;
  const lat = Number(position?.lat), lng = Number(position?.lng);
  const bbox = [Math.max(-180, lng - 0.01), Math.max(-90, lat - 0.008), Math.min(180, lng + 0.01), Math.min(90, lat + 0.008)].join(',');

  return (
    <Paper withBorder shadow="sm" p="md" h="100%">
      <Group justify="space-between" mb="md">
        <Box><Title order={4}>Live Fleet Activity</Title><Text size="xs" c="dimmed">Checks every 15 seconds. Select a bus to view its geographical position.</Text></Box>
        <Badge color="green" variant="light">{entries.filter(entry => fleetStatus(entry, now) === 'fresh').length} live</Badge>
      </Group>
      {!entries.length ? <EmptyState message="No active trips are available for location tracking." /> : (
        <Stack gap="sm">
          <Group>{entries.map(entry => (
            <Button key={entry.trip.id} size="xs" variant={entry.trip.id === selected?.trip.id ? 'filled' : 'light'} color={colors[fleetStatus(entry, now)]} aria-pressed={entry.trip.id === selected?.trip.id} onClick={() => setSelectedId(entry.trip.id)}>
              {entry.trip.vehicle?.plateNumber || `Trip #${entry.trip.id}`} - {labels[fleetStatus(entry, now)]}
            </Button>
          ))}</Group>
          <Text fw={650}>{selected.trip.route?.name || 'Active trip'} - {selected.trip.vehicle?.plateNumber || 'No vehicle assigned'}</Text>
          <Badge color={colors[status]} style={{ alignSelf: 'flex-start' }}>{labels[status]}</Badge>
          {status !== 'fresh' && <Alert color={status === 'failed' ? 'red' : 'yellow'}>{selected.error || (status === 'missing' ? 'Waiting for a GPS fix for this active trip.' : 'This position is not live. Do not use it as evidence of the bus currently being here.')}</Alert>}
          {position && <>
            <Box component="iframe" title="Selected bus geographical location" w="100%" h={300} style={{ border: 0, borderRadius: 10 }} src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`} />
            <Text size="sm">{lat.toFixed(5)}, {lng.toFixed(5)} - {position.speed == null ? 'Speed unavailable' : `Reported speed: ${Math.round(position.speed)} km/h`}</Text>
            <Text size="xs" c="dimmed">Last reported fix: {position.recordedAt ? new Date(position.recordedAt).toLocaleString() : 'Timestamp unavailable'}. This is a reported position, not a guarantee of the bus's current location.</Text>
          </>}
        </Stack>
      )}
    </Paper>
  );
};

export default FleetActivity;
