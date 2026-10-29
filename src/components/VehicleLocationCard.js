import React, { useEffect, useState } from 'react';
import { Alert, Anchor, Badge, Box, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { vehicleAPI } from '../services/api';
import { EmptyState } from './ui';

const VehicleLocationCard = ({ vehicleId, tripId }) => {
  const [state, setState] = useState(null);

  useEffect(() => {
    let active = true;
    let timer;
    const controller = new AbortController();
    setState(null);

    const poll = async () => {
      try {
        const { data } = await vehicleAPI.getLocation(vehicleId, { signal: controller.signal });
        if (active) setState({ vehicleId, tripId, data, error: '' });
      } catch (err) {
        if (active && !controller.signal.aborted) {
          setState({
            vehicleId,
            tripId,
            data: null,
            error: err.response?.data?.error || 'Vehicle location could not be loaded.',
          });
        }
      } finally {
        if (active) timer = setTimeout(poll, 10000);
      }
    };

    poll();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [vehicleId, tripId]);

  const current = state?.vehicleId === vehicleId && state?.tripId === tripId ? state : null;
  const { location, locationSource } = current?.data || {};
  const activeTrip = current?.data?.trip;
  const trip = tripId != null && String(activeTrip?.id) !== String(tripId) ? null : activeTrip;

  return (
    <Paper withBorder shadow="sm" p="md">
      <Group justify="space-between" mb="md">
        <Box>
          <Title order={4}>Active trip location</Title>
          <Text size="xs" c="dimmed">Checks for updates every 10 seconds. Tracking is available only during active trips.</Text>
        </Box>
        {trip && <Badge variant="light">{locationSource === 'traccar' ? 'Traccar device' : 'Driver phone GPS'}</Badge>}
      </Group>
      {!current ? (
        <Text size="sm" c="dimmed">Loading vehicle location...</Text>
      ) : current.error ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>{current.error}</Alert>
      ) : !trip ? (
        <EmptyState message={tripId != null
          ? 'This trip is no longer active. Location tracking has stopped.'
          : 'This vehicle has no active trip. Its location will appear here when a trip starts.'} />
      ) : (
        <Stack gap="sm">
          <Anchor component={Link} to={`/trips/${trip.id}`}>{trip.route?.name || `Trip #${trip.id}`} - View active trip</Anchor>
          {location ? (
            <>
              <Box
                component="iframe"
                title="Vehicle location"
                w="100%"
                h={350}
                style={{ border: 0, borderRadius: 10 }}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.01}%2C${location.lat - 0.008}%2C${location.lng + 0.01}%2C${location.lat + 0.008}&layer=mapnik&marker=${location.lat}%2C${location.lng}`}
              />
              <Group>
                <Text size="sm">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</Text>
                <Text size="sm">{location.speed == null ? 'Speed unavailable' : `${Math.round(location.speed)} km/h`}</Text>
                <Anchor size="sm" href={`https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}`} target="_blank" rel="noreferrer">Open full map</Anchor>
              </Group>
              <Text size="xs" c="dimmed">Last GPS fix: {new Date(location.recordedAt).toLocaleString()}. This is the last reported position, not a guarantee the vehicle is currently there.</Text>
            </>
          ) : (
            <EmptyState message={locationSource === 'traccar'
              ? 'Waiting for a Traccar GPS fix recorded after this trip started. The linked device must be online and the vehicle active.'
              : 'Waiting for the driver phone to share a GPS location for this trip.'} />
          )}
        </Stack>
      )}
    </Paper>
  );
};

export default VehicleLocationCard;
