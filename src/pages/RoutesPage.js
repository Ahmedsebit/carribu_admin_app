import React, { useState, useEffect, useRef } from 'react';
import {
  Group, Button, TextInput, Textarea, Select, Table, Paper, Alert, Badge, Text, Title, Stack, Box,
  Checkbox, SimpleGrid, ScrollArea, Collapse, ActionIcon, Switch,
} from '@mantine/core';
import {
  IconPlus, IconEdit, IconAlertCircle, IconCircleCheck, IconChevronDown, IconChevronUp, IconX, IconTarget,
} from '@tabler/icons-react';
import { routeAPI, vehicleAPI, studentAPI, driverAPI } from '../services/api';
import Modal from '../components/Modal';
import { PageHeader, StatsGrid, StatCard, StatusBadge, EmptyState, LoadingState } from '../components/ui';

const empty = { name: '', description: '', vehicleId: '', driverId: '', type: 'both', grades: [], departureTime: '07:00', outboundWaypoints: [], returnWaypoints: [], studentIds: [] };
const GRADE_OPTIONS = ['Pre-K', 'K', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Form 1', 'Form 2', 'Form 3', 'Form 4'];

const RouteMap = ({ waypoints, onWaypointsChange, suggestedStudents }) => {
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(!!window.google?.maps);
  const [useDirections, setUseDirections] = useState(true);
  const [placingMode, setPlacingMode] = useState(null); // 'start', 'end', 'waypoint'
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  useEffect(() => {
    if (googleReady) return;
    const interval = setInterval(() => {
      if (window.google?.maps) { setGoogleReady(true); clearInterval(interval); }
    }, 500);
    return () => clearInterval(interval);
  }, [googleReady]);

  useEffect(() => {
    if (!googleReady || !mapRef.current) return;

    // Clear old markers and lines
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    if (directionsRendererRef.current) { directionsRendererRef.current.setMap(null); directionsRendererRef.current = null; }

    const center = waypoints.length > 0 ? { lat: waypoints[0].lat, lng: waypoints[0].lng } : { lat: -1.2921, lng: 36.8219 };

    if (!mapObjRef.current) {
      mapObjRef.current = new window.google.maps.Map(mapRef.current, { center, zoom: 13, mapTypeControl: false });
    }
    const map = mapObjRef.current;

    // Draw waypoints with distinct start/end markers
    waypoints.forEach((wp, i) => {
      const isStart = i === 0;
      const isEnd = i === waypoints.length - 1 && waypoints.length > 1;
      let icon, label;

      if (isStart) {
        icon = { url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png', scaledSize: new window.google.maps.Size(40, 40) };
        label = 'A';
      } else if (isEnd) {
        icon = { url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png', scaledSize: new window.google.maps.Size(40, 40) };
        label = 'B';
      } else {
        icon = { url: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png', scaledSize: new window.google.maps.Size(34, 34) };
        label = `${i}`;
      }

      const marker = new window.google.maps.Marker({ position: { lat: wp.lat, lng: wp.lng }, map, label: { text: label, color: '#fff', fontWeight: 'bold', fontSize: '12px' }, icon, draggable: true, title: isStart ? 'Start Point' : isEnd ? 'End Point' : `Stop ${i}` });
      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        const updated = [...waypoints];
        updated[i] = { ...updated[i], lat: pos.lat(), lng: pos.lng() };
        onWaypointsChange(updated);
      });
      markersRef.current.push(marker);
    });

    // Draw student markers
    if (suggestedStudents) {
      suggestedStudents.filter(s => s.pickupLat && s.pickupLng).forEach(s => {
        const m = new window.google.maps.Marker({ position: { lat: s.pickupLat, lng: s.pickupLng }, map, icon: { url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' }, title: `${s.firstName} ${s.lastName} (${s.grade})` });
        markersRef.current.push(m);
      });
    }

    // Draw route
    if (waypoints.length > 1) {
      if (useDirections) {
        const directionsService = new window.google.maps.DirectionsService();
        const origin = waypoints[0];
        const destination = waypoints[waypoints.length - 1];
        const intermediateWaypoints = waypoints.slice(1, -1).map(wp => ({ location: new window.google.maps.LatLng(wp.lat, wp.lng), stopover: true }));

        directionsService.route({
          origin: new window.google.maps.LatLng(origin.lat, origin.lng),
          destination: new window.google.maps.LatLng(destination.lat, destination.lng),
          waypoints: intermediateWaypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        }, (result, status) => {
          if (status === 'OK') {
            directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
              map, directions: result, suppressMarkers: true,
              polylineOptions: { strokeColor: '#16a34a', strokeWeight: 4, strokeOpacity: 0.8 }
            });
          } else {
            polylineRef.current = new window.google.maps.Polyline({ path: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })), map, strokeColor: '#16a34a', strokeWeight: 3 });
          }
        });
      } else {
        polylineRef.current = new window.google.maps.Polyline({ path: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })), map, strokeColor: '#16a34a', strokeWeight: 3 });
      }

      const bounds = new window.google.maps.LatLngBounds();
      waypoints.forEach(wp => bounds.extend({ lat: wp.lat, lng: wp.lng }));
      map.fitBounds(bounds, 50);
    }
  }, [googleReady, waypoints, suggestedStudents, useDirections]);

  // Handle map clicks based on placing mode
  useEffect(() => {
    if (!googleReady || !mapObjRef.current) return;
    const map = mapObjRef.current;
    const listener = map.addListener('click', (e) => {
      const point = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      if (placingMode === 'start') {
        const updated = waypoints.length > 0 ? [point, ...waypoints.slice(1)] : [point];
        onWaypointsChange(updated);
        setPlacingMode(null);
      } else if (placingMode === 'end') {
        if (waypoints.length === 0) {
          onWaypointsChange([point]);
        } else if (waypoints.length === 1) {
          onWaypointsChange([...waypoints, point]);
        } else {
          onWaypointsChange([...waypoints.slice(0, waypoints.length - 1), point]);
        }
        setPlacingMode(null);
      } else if (placingMode === 'waypoint') {
        if (waypoints.length < 2) {
          onWaypointsChange([...waypoints, point]);
        } else {
          // Insert before the end point
          const updated = [...waypoints.slice(0, -1), point, waypoints[waypoints.length - 1]];
          onWaypointsChange(updated);
        }
        // Stay in waypoint mode so user can keep adding
      }
    });
    return () => window.google.maps.event.removeListener(listener);
  }, [googleReady, placingMode, waypoints, onWaypointsChange]);

  if (!googleReady) {
    return (
      <Box style={{ border: '2px dashed var(--mantine-color-gray-4)', borderRadius: 12 }} p="md" mb="md">
        <Text size="sm" c="dimmed" mb={8}>📍 <strong>Route Waypoints</strong></Text>
        <Group gap={8} mb={8}>
          {waypoints.map((wp, i) => (
            <Badge key={i} color={i === 0 ? 'green' : i === waypoints.length - 1 ? 'red' : 'yellow'} variant="light"
              rightSection={<ActionIcon size="xs" color="red" variant="transparent" onClick={() => onWaypointsChange(waypoints.filter((_, j) => j !== i))}><IconX size={12} /></ActionIcon>}>
              {i === 0 ? '🟢 Start' : i === waypoints.length - 1 ? '🔴 End' : `📍 Stop ${i}`}: {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
            </Badge>
          ))}
        </Group>
        <Group>
          <TextInput placeholder="Latitude" value={manualLat} onChange={e => setManualLat(e.target.value)} w={140} />
          <TextInput placeholder="Longitude" value={manualLng} onChange={e => setManualLng(e.target.value)} w={140} />
          <Button variant="default" size="xs" onClick={() => {
            const lat = parseFloat(manualLat);
            const lng = parseFloat(manualLng);
            if (!isNaN(lat) && !isNaN(lng)) { onWaypointsChange([...waypoints, { lat, lng }]); setManualLat(''); setManualLng(''); }
          }}>+ Add Point</Button>
        </Group>
      </Box>
    );
  }

  return (
    <Box>
      <Group mb={8} gap={8}>
        <Button size="xs" variant={placingMode === 'start' ? 'filled' : 'default'} onClick={() => setPlacingMode(placingMode === 'start' ? null : 'start')}>
          🟢 {waypoints.length > 0 ? 'Move Start' : 'Set Start'}
        </Button>
        <Button size="xs" variant={placingMode === 'end' ? 'filled' : 'default'} onClick={() => setPlacingMode(placingMode === 'end' ? null : 'end')}>
          🔴 {waypoints.length > 1 ? 'Move End' : 'Set End'}
        </Button>
        <Button size="xs" variant={placingMode === 'waypoint' ? 'filled' : 'default'} onClick={() => setPlacingMode(placingMode === 'waypoint' ? null : 'waypoint')}>
          📍 Add Waypoint
        </Button>
        {waypoints.length > 0 && <Button size="xs" color="red" variant="light" onClick={() => onWaypointsChange([])}>🗑️ Clear All</Button>}
        <Switch ml="auto" size="xs" label="Show driving route" checked={useDirections} onChange={e => setUseDirections(e.currentTarget.checked)} />
      </Group>
      {placingMode && (
        <Alert py={6} px={12} mb={8} color={placingMode === 'start' ? 'green' : placingMode === 'end' ? 'red' : 'yellow'} variant="light">
          👆 Click on the map to {placingMode === 'start' ? 'set the start point' : placingMode === 'end' ? 'set the end point' : 'add a waypoint'}
          {placingMode === 'waypoint' && ' (keep clicking to add more, then click "Add Waypoint" button again to stop)'}
        </Alert>
      )}
      <Box ref={mapRef} style={{ width: '100%', height: 350, borderRadius: 12, marginBottom: 12, cursor: placingMode ? 'crosshair' : 'default' }} />
    </Box>
  );
};

const WaypointChips = ({ waypoints, onChange }) => (
  waypoints.length > 0 ? (
    <Group gap={6} mt={4}>
      {waypoints.map((wp, i) => (
        <Badge key={i} color={i === 0 ? 'green' : i === waypoints.length - 1 ? 'red' : 'yellow'} variant="light"
          rightSection={<ActionIcon size="xs" color="red" variant="transparent" onClick={() => onChange(waypoints.filter((_, j) => j !== i))}><IconX size={12} /></ActionIcon>}>
          {i === 0 ? '🟢 Start' : i === waypoints.length - 1 ? '🔴 End' : `📍 Stop ${i}`}: ({wp.lat.toFixed(4)},{wp.lng.toFixed(4)})
        </Badge>
      ))}
    </Group>
  ) : null
);

const RoutesPage = () => {
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [students, setStudents] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [suggested, setSuggested] = useState(null);
  const [suggesting, setSuggesting] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const [r, v, s, d] = await Promise.all([routeAPI.getAll(), vehicleAPI.getAll(), studentAPI.getAll(), driverAPI.getAll()]);
      setRoutes(r.data.routes);
      setVehicles(v.data.vehicles.filter(v => v.status === 'active'));
      setStudents(s.data.students);
      setDrivers(d.data.drivers);
    } catch (e) { /* keep previous state on failure */ } finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setError(''); setSuggested(null); setModalOpen(true); };
  const openEdit = r => {
    setEditing(r);
    setForm({
      name: r.name, description: r.description || '', vehicleId: r.vehicleId ? String(r.vehicleId) : '', driverId: r.driverId ? String(r.driverId) : '', type: r.type,
      grades: r.grades || [], departureTime: r.departureTime || '07:00',
      outboundWaypoints: (r.routeWaypoints || []).filter(w => w.leg === 'outbound').sort((a, b) => a.orderIndex - b.orderIndex).map(w => ({ lat: parseFloat(w.lat), lng: parseFloat(w.lng), label: w.label, isStop: w.isStop })),
      returnWaypoints: (r.routeWaypoints || []).filter(w => w.leg === 'return').sort((a, b) => a.orderIndex - b.orderIndex).map(w => ({ lat: parseFloat(w.lat), lng: parseFloat(w.lng), label: w.label, isStop: w.isStop })),
      studentIds: r.students?.map(s => s.id) || [],
    });
    setError(''); setSuggested(null); setModalOpen(true);
  };
  const save = async () => {
    setError(''); setSaving(true);
    try {
      const payload = { ...form, vehicleId: form.vehicleId || null, driverId: form.driverId || null };
      if (editing) { await routeAPI.update(editing.id, payload); setSuccess('Updated!'); }
      else { await routeAPI.create(payload); setSuccess('Created!'); }
      setModalOpen(false); fetch(); setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Failed'); } finally { setSaving(false); }
  };
  const suggestStudents = async (grades, waypoints) => {
    if (!grades || !waypoints) return;
    if (grades.length === 0 && waypoints.length === 0) return;
    setSuggesting(true);
    try {
      const { data } = await routeAPI.suggestStudents({ grades, waypoints, radiusKm: 3 });
      setSuggested(data.students);
      return data.students;
    } catch (e) { console.error(e); return []; } finally { setSuggesting(false); }
  };
  const autoSuggest = async (grades, waypoints) => {
    if (grades.length === 0 || waypoints.length === 0) { setSuggested(null); return; }
    const results = await suggestStudents(grades, waypoints);
    if (results && results.length > 0) {
      const ids = results.map(s => s.id);
      setForm(p => ({ ...p, studentIds: [...new Set([...p.studentIds, ...ids])] }));
    }
  };
  const addSuggestedStudents = () => {
    if (!suggested) return;
    const ids = suggested.map(s => s.id);
    setForm(p => ({ ...p, studentIds: [...new Set([...p.studentIds, ...ids])] }));
    setSuccess(`${ids.length} students added from suggestions`);
    setTimeout(() => setSuccess(''), 3000);
  };
  const handleGradesChange = (grade) => {
    const newGrades = form.grades.includes(grade) ? form.grades.filter(x => x !== grade) : [...form.grades, grade];
    setForm(p => ({ ...p, grades: newGrades }));
    autoSuggest(newGrades, [...form.outboundWaypoints, ...form.returnWaypoints]);
  };
  const handleOutboundChange = (wps) => { setForm(p => ({ ...p, outboundWaypoints: wps })); autoSuggest(form.grades, [...wps, ...form.returnWaypoints]); };
  const handleReturnChange = (wps) => { setForm(p => ({ ...p, returnWaypoints: wps })); autoSuggest(form.grades, [...form.outboundWaypoints, ...wps]); };
  const ch = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const toggleStudent = id => setForm(p => ({ ...p, studentIds: p.studentIds.includes(id) ? p.studentIds.filter(i => i !== id) : [...p.studentIds, id] }));
  const selectedGrades = new Set(form.grades.map(grade => grade.trim().toLowerCase()));
  const gradeFilteredStudents = form.grades.length === 0
    ? students
    : students.filter(student =>
      selectedGrades.has(String(student.grade || '').trim().toLowerCase()) ||
      form.studentIds.includes(student.id)
    );
  const retainedOutsideGradeCount = form.grades.length === 0 ? 0 : gradeFilteredStudents.filter(student =>
    form.studentIds.includes(student.id) &&
    !selectedGrades.has(String(student.grade || '').trim().toLowerCase())
  ).length;

  return (
    <div>
      <PageHeader
        title="🗺️ Route Management"
        subtitle="Configure routes, assign vehicles and students"
        actions={<Button leftSection={<IconPlus size={16} />} onClick={openAdd}>Create Route</Button>}
      />
      {success && <Alert color="green" icon={<IconCircleCheck size={16} />} mb="md" withCloseButton onClose={() => setSuccess('')}>{success}</Alert>}

      <StatsGrid cols={3}>
        <StatCard icon="🗺️" value={routes.length} label="Total Routes" color="blue" />
        <StatCard icon="🚐" value={routes.filter(r => r.vehicleId).length} label="With Vehicles" color="green" />
        <StatCard icon="🎒" value={routes.reduce((s, r) => s + (r.students?.length || 0), 0)} label="Students Assigned" color="yellow" />
      </StatsGrid>

      {loading ? <LoadingState /> : routes.length === 0 ? <Paper withBorder radius="md"><EmptyState message="No routes yet." /></Paper> : (
        <Stack gap="md">
          {routes.map(r => (
            <Paper withBorder radius="md" shadow="sm" key={r.id}>
              <Group justify="space-between" p="md" style={{ cursor: 'pointer', borderBottom: expanded === r.id ? '1px solid var(--mantine-color-gray-2)' : 'none' }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <Group gap="sm">
                  <Title order={4}>{r.name}</Title>
                  <StatusBadge status={r.type}>{r.type}</StatusBadge>
                  {r.isActive ? <StatusBadge status="active">Active</StatusBadge> : <StatusBadge status="retired">Inactive</StatusBadge>}
                </Group>
                <Group gap={8}>
                  <ActionIcon variant="light" onClick={e => { e.stopPropagation(); openEdit(r); }}><IconEdit size={16} /></ActionIcon>
                  <ActionIcon variant="subtle">{expanded === r.id ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}</ActionIcon>
                </Group>
              </Group>
              <Box p="md">
                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
                  <Text size="sm"><strong>Vehicle:</strong> {r.vehicle ? `${r.vehicle.plateNumber} (${r.vehicle.make} ${r.vehicle.model}, ${r.vehicle.capacity} seats)` : <Text span c="dimmed">Unassigned</Text>}</Text>
                  <Text size="sm"><strong>Driver:</strong> {r.driver ? `${r.driver.firstName} ${r.driver.lastName}` : <Text span c="dimmed">Unassigned</Text>}</Text>
                  <Text size="sm"><strong>Departure:</strong> {r.departureTime || 'Not set'}</Text>
                  <Text size="sm"><strong>Students:</strong> {r.students?.length || 0}</Text>
                </SimpleGrid>
                {r.grades && r.grades.length > 0 && <Text size="xs" mt={8}><strong>Grades:</strong> {r.grades.join(', ')}</Text>}
                <Collapse in={expanded === r.id}>
                  {r.students?.length > 0 && (
                    <Box mt="md">
                      <Text size="sm" fw={600} mb={8}>Assigned Students:</Text>
                      <Table>
                        <Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>Student</Table.Th><Table.Th>Grade</Table.Th></Table.Tr></Table.Thead>
                        <Table.Tbody>
                          {r.students.sort((a, b) => (a.RouteStudent?.stopOrder || 0) - (b.RouteStudent?.stopOrder || 0)).map((s, i) => (
                            <Table.Tr key={s.id}><Table.Td>{i + 1}</Table.Td><Table.Td>{s.firstName} {s.lastName}</Table.Td><Table.Td>{s.grade || '-'}</Table.Td></Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Box>
                  )}
                </Collapse>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        wide
        title={editing ? 'Edit Route' : 'Create Route'}
        footer={<><Button variant="default" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Update' : 'Create'}</Button></>}
      >
        {error && <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>}
        <TextInput label="Name *" placeholder="Westlands–Kilimani Route" value={form.name} onChange={e => ch('name', e.target.value)} />
        <Textarea label="Description" rows={2} value={form.description} onChange={e => ch('description', e.target.value)} />
        <Group grow>
          <Select label="Vehicle" placeholder="-- Select --" data={vehicles.map(v => ({ value: String(v.id), label: `${v.plateNumber} (${v.make} ${v.model})` }))} value={form.vehicleId} onChange={v => ch('vehicleId', v || '')} clearable searchable />
          <Select label="Driver" placeholder="-- Select --" data={drivers.map(d => ({ value: String(d.id), label: `${d.firstName} ${d.lastName}` }))} value={form.driverId} onChange={v => ch('driverId', v || '')} clearable searchable />
        </Group>
        <Group grow>
          <Select label="Type" data={[{ value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }, { value: 'both', label: 'Both' }]} value={form.type} onChange={v => ch('type', v)} />
          <TextInput type="time" label="Departure Time" value={form.departureTime} onChange={e => ch('departureTime', e.target.value)} />
        </Group>
        <Box>
          <Text size="sm" fw={500} mb={6}>Grades Served</Text>
          <Group gap={6} p={8} style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}>
            {GRADE_OPTIONS.map(g => (
              <Checkbox key={g} label={g} checked={form.grades.includes(g)} onChange={() => handleGradesChange(g)} size="xs"
                styles={{ body: { background: form.grades.includes(g) ? 'var(--mantine-color-green-0)' : 'var(--mantine-color-gray-0)', padding: '2px 6px', borderRadius: 4 } }} />
            ))}
          </Group>
        </Box>
        <Box>
          <Text size="sm" fw={500} mb={6}>Outbound Waypoints ({form.outboundWaypoints.length} points) — A → B path</Text>
          <RouteMap waypoints={form.outboundWaypoints} onWaypointsChange={handleOutboundChange} suggestedStudents={suggested} />
          <WaypointChips waypoints={form.outboundWaypoints} onChange={handleOutboundChange} />
        </Box>
        <Box>
          <Text size="sm" fw={500} mb={6}>Return Waypoints ({form.returnWaypoints.length} points) — B → A path</Text>
          <RouteMap waypoints={form.returnWaypoints} onWaypointsChange={handleReturnChange} suggestedStudents={suggested} />
          <WaypointChips waypoints={form.returnWaypoints} onChange={handleReturnChange} />
        </Box>
        <Box pt={12} style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Group justify="space-between" mb={8}>
            <Text size="sm" fw={500}>
              Students ({form.studentIds.length} selected · {gradeFilteredStudents.length} shown)
              {suggesting && <Text span c="dimmed" size="xs"> — auto-matching...</Text>}
            </Text>
            <Group gap={8}>
              <Button size="xs" variant="default" leftSection={<IconTarget size={14} />} onClick={() => suggestStudents(form.grades, [...form.outboundWaypoints, ...form.returnWaypoints])} loading={suggesting} disabled={(form.outboundWaypoints.length === 0 && form.returnWaypoints.length === 0) || form.grades.length === 0}>Re-suggest</Button>
              {suggested && <Button size="xs" variant="default" onClick={addSuggestedStudents}>✅ Add All ({suggested.length})</Button>}
            </Group>
          </Group>
          {suggested && (
            <Alert color="blue" variant="light" mb={8}>
              <Text size="sm" fw={600} mb={4}>💡 {suggested.length} students auto-matched within 3km of route with matching grades:</Text>
              <Group gap={4}>
                {suggested.map(s => <Badge key={s.id} variant="light" color="blue">{s.firstName} {s.lastName} ({s.grade}) - {s.distanceKm?.toFixed(1)}km</Badge>)}
              </Group>
            </Alert>
          )}
          {form.grades.length === 0 && (
            <Alert color="blue" variant="light" mb={8}>
              Select one or more grades served to filter the student list.
            </Alert>
          )}
          {retainedOutsideGradeCount > 0 && (
            <Alert color="yellow" variant="light" mb={8}>
              {retainedOutsideGradeCount} currently assigned {retainedOutsideGradeCount === 1 ? 'student is' : 'students are'} outside the selected grades and {retainedOutsideGradeCount === 1 ? 'remains' : 'remain'} visible for review.
            </Alert>
          )}
          <ScrollArea.Autosize mah={180} style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }} p={8}>
            <Stack gap={4}>
              {gradeFilteredStudents.length > 0 ? gradeFilteredStudents.map(s => {
                const outsideSelectedGrades = form.grades.length > 0 && !selectedGrades.has(String(s.grade || '').trim().toLowerCase());
                return (
                  <Checkbox key={s.id} checked={form.studentIds.includes(s.id)} onChange={() => toggleStudent(s.id)}
                    label={<Text size="sm">{s.firstName} {s.lastName} <Text span c="dimmed">({s.grade || 'N/A'})</Text>{outsideSelectedGrades && <Text span c="yellow.8"> · assigned outside grades</Text>}</Text>} />
                );
              }) : (
                <Text size="sm" c="dimmed" ta="center" py="md">No students found in the selected grades.</Text>
              )}
            </Stack>
          </ScrollArea.Autosize>
        </Box>
      </Modal>
    </div>
  );
};

export default RoutesPage;
