import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Paper, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { Link } from 'react-router-dom';
import { absenceAPI } from '../services/api';
import Modal from '../components/Modal';
import { EmptyState, LoadingState, PageHeader } from '../components/ui';

const AbsenceRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [review, setReview] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    let active = true;
    let timer;
    const controller = new AbortController();
    const load = async () => {
      try {
        const { data } = await absenceAPI.getAll({ status: status || undefined, date: date || undefined, page }, { signal: controller.signal, timeout: 10000 });
        if (!active) return;
        setRequests(data.requests);
        setPages(data.pages);
        setError('');
      } catch (err) {
        if (active) setError(err.response?.data?.error || 'Absence requests could not be loaded.');
      } finally {
        if (active) { setLoading(false); timer = setTimeout(load, 15000); }
      }
    };
    setLoading(true);
    load();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [status, date, page, refresh]);

  const openReview = (request, trip = null) => { setReview({ request, trip }); setNotes(''); setReviewError(''); };
  const save = async () => {
    if (!notes.trim()) { setReviewError('Explain the decision before confirming.'); return; }
    setSaving(true);
    try {
      if (review.trip) await absenceAPI.confirm(review.request.id, { tripId: review.trip.id, notes: notes.trim() });
      else await absenceAPI.reject(review.request.id, { notes: notes.trim() });
      setReview(null);
      setRefresh(value => value + 1);
    } catch (err) { setReviewError(err.response?.data?.error || 'The review could not be recorded.'); }
    finally { setSaving(false); }
  };

  return (
    <Stack>
      <PageHeader title="Absence review" subtitle="Parent requests do not change attendance automatically. Confirm each active trip separately." actions={<Button variant="default" onClick={() => setRefresh(value => value + 1)}>Refresh</Button>} />
      {error && <Alert color="red">{error}</Alert>}
      <Group>
        <Select label="Review status" data={[{ value: '', label: 'All statuses' }, { value: 'pending', label: 'Pending' }, { value: 'confirmed', label: 'Recorded for at least one trip' }, { value: 'rejected', label: 'Rejected' }]} value={status} onChange={value => { setStatus(value || ''); setPage(1); }} />
        <TextInput type="date" label="Absence date (blank for all dates)" value={date} onChange={event => { setDate(event.target.value); setPage(1); }} />
      </Group>
      {loading ? <LoadingState /> : requests.length === 0 ? <EmptyState message="No absence requests match these filters." /> : requests.map(request => (
        <Paper key={request.id} withBorder p="md" radius="md">
          <Group justify="space-between">
            <Text fw={700}>{request.student?.firstName} {request.student?.lastName} - {request.date}</Text>
            <Badge color={request.status === 'rejected' ? 'red' : request.status === 'confirmed' ? 'green' : 'orange'}>{request.status}</Badge>
          </Group>
          <Text size="sm">Submitted by {request.parent?.firstName} {request.parent?.lastName}</Text>
          <Text size="sm" mt="xs">{request.reason || 'No reason supplied.'}</Text>
          <Text size="xs" c="dimmed" mt="xs">Recorded for {request.confirmedTripIds.length} trip(s). Additional journeys require separate confirmation.</Text>
          {request.reviewedBy && <Text size="xs" c="dimmed">Last reviewed by {request.reviewedBy.firstName} {request.reviewedBy.lastName}: {request.reviewNotes}</Text>}
          <Stack mt="sm" gap="xs">
            {request.matchingTrips.map(trip => (
              <Group key={trip.id}>
                <Button component={Link} to={`/trips/${trip.id}`} variant="subtle" size="xs">{trip.routeName} - {trip.type === 'morning_pickup' ? 'Morning' : 'Afternoon'}</Button>
                <Badge variant="light">{trip.studentStatus.replace(/_/g, ' ')}</Badge>
                {trip.parentMatches === false && <Text size="xs" c="red">Parent linkage changed; review the student record.</Text>}
                {trip.confirmed ? <Text size="xs" c="green">Already confirmed for this trip</Text>
                  : trip.canConfirm && <Button size="xs" onClick={() => openReview(request, trip)}>{trip.studentStatus === 'absent' ? 'Link recorded absence' : 'Confirm absence for this trip'}</Button>}
              </Group>
            ))}
            {request.status !== 'rejected' && !request.matchingTrips.length && <Text size="sm" c="dimmed">Awaiting a matching active trip. Attendance will not be applied automatically when it starts.</Text>}
            {request.status === 'pending' && <Button variant="light" color="red" size="xs" style={{ alignSelf: 'flex-start' }} onClick={() => openReview(request)}>Reject request</Button>}
          </Stack>
        </Paper>
      ))}
      <Group justify="center"><Button variant="default" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><Text size="sm">Page {page} of {pages}</Text><Button variant="default" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Next</Button></Group>
      <Modal isOpen={Boolean(review)} onClose={() => { if (!saving) setReview(null); }} title={review?.trip ? 'Confirm absence for this trip' : 'Reject absence request'} footer={<><Button variant="default" disabled={saving} onClick={() => setReview(null)}>Cancel</Button><Button loading={saving} disabled={!notes.trim()} onClick={save}>Confirm decision</Button></>}>
        {reviewError && <Alert color="red">{reviewError}</Alert>}
        <Text fw={700}>{review?.request.student?.firstName} {review?.request.student?.lastName} - {review?.request.date}</Text>
        {review?.trip && <Text size="sm">{review.trip.routeName} - Trip #{review.trip.id} ({review.trip.type === 'morning_pickup' ? 'Morning' : 'Afternoon'})</Text>}
        <Text size="sm">{review?.trip ? 'Confirm the child will not board this specific trip. A boarded or dropped-off child cannot be marked absent.' : 'This rejects the request without changing any trip attendance.'}</Text>
        <Textarea label="Decision notes" required maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} />
      </Modal>
    </Stack>
  );
};

export default AbsenceRequestsPage;
