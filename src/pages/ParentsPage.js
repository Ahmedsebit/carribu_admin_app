import React, { useState, useEffect, useCallback, useRef } from 'react';
import { parentAPI, studentAPI, importAPI } from '../services/api';
import Modal from '../components/Modal';

const LocationPicker = ({ lat, lng, onLocationChange }) => {
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markerRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(!!window.google?.maps);

  useEffect(() => {
    if (googleReady) return;
    const interval = setInterval(() => {
      if (window.google?.maps) { setGoogleReady(true); clearInterval(interval); }
    }, 500);
    return () => clearInterval(interval);
  }, [googleReady]);

  useEffect(() => {
    if (!googleReady || !mapRef.current) return;
    const center = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : { lat: -1.2921, lng: 36.8219 };

    if (!mapObjRef.current) {
      mapObjRef.current = new window.google.maps.Map(mapRef.current, { center, zoom: 14, mapTypeControl: false });
      mapObjRef.current.addListener('click', (e) => {
        onLocationChange(e.latLng.lat(), e.latLng.lng());
      });
    }

    if (markerRef.current) markerRef.current.setMap(null);
    if (lat && lng) {
      const pos = { lat: parseFloat(lat), lng: parseFloat(lng) };
      markerRef.current = new window.google.maps.Marker({ position: pos, map: mapObjRef.current, draggable: true });
      markerRef.current.addListener('dragend', () => {
        const p = markerRef.current.getPosition();
        onLocationChange(p.lat(), p.lng());
      });
      mapObjRef.current.panTo(pos);
    }
  }, [googleReady, lat, lng]);

  if (!googleReady) return <p style={{ fontSize: 13, color: '#6b7280' }}>📍 Google Maps not loaded — enter coordinates manually above.</p>;
  return <div ref={mapRef} style={{ width: '100%', height: 220, borderRadius: 8, marginTop: 8, marginBottom: 8 }} />;
};

const emptyForm = { firstName: '', lastName: '', email: '', phone: '', pickupAddress: '', pickupLat: '', pickupLng: '' };

const ParentsPage = () => {
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detailModal, setDetailModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [newChildFirst, setNewChildFirst] = useState('');
  const [newChildLast, setNewChildLast] = useState('');
  const [newChildGrade, setNewChildGrade] = useState('');
  const [addingChild, setAddingChild] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);

  const fetchParents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await parentAPI.getAll();
      setParents(data.parents);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchParents(); }, [fetchParents]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModalOpen(true); };
  const openEdit = p => { setEditing(p); setForm({ firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone || '', pickupAddress: p.pickupAddress || '', pickupLat: p.pickupLat || '', pickupLng: p.pickupLng || '' }); setError(''); setModalOpen(true); };

  const openDetail = async (p) => {
    try {
      const { data } = await parentAPI.getById(p.id);
      setSelectedParent(data.parent);
      const { data: studData } = await studentAPI.getAll();
      setAllStudents(studData.students.filter(s => !s.parentId));
      setDetailModal(true);
    } catch (e) { console.error(e); }
  };

  const save = async () => {
    setError('');
    if (!editing && !form.phone?.trim()) { setError('Phone number is required.'); return; }
    setSaving(true);
    try {
      if (editing) {
        await parentAPI.update(editing.id, form);
        setSuccess('Parent updated!');
      } else {
        await parentAPI.create(form);
        setSuccess('Parent added! They can set their password in the app using their phone number.');
      }
      setModalOpen(false); fetchParents();
      setTimeout(() => setSuccess(''), 5000);
    } catch (e) { setError(e.response?.data?.error || 'Failed to save'); } finally { setSaving(false); }
  };

  const deactivate = async id => {
    if (!window.confirm('Deactivate this parent?')) return;
    try { await parentAPI.delete(id); setSuccess('Parent deactivated.'); fetchParents(); setTimeout(() => setSuccess(''), 3000); } catch (e) { console.error(e); }
  };

  const assignStudent = async () => {
    if (!assignStudentId || !selectedParent) return;
    try {
      await studentAPI.update(assignStudentId, { parentId: selectedParent.id });
      setSuccess('Student assigned to parent!');
      const { data } = await parentAPI.getById(selectedParent.id);
      setSelectedParent(data.parent);
      const { data: studData } = await studentAPI.getAll();
      setAllStudents(studData.students.filter(s => !s.parentId));
      setAssignStudentId('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Failed to assign'); }
  };

  const removeStudent = async (studentId) => {
    if (!window.confirm('Remove student from this parent?')) return;
    try {
      await studentAPI.update(studentId, { parentId: null });
      const { data } = await parentAPI.getById(selectedParent.id);
      setSelectedParent(data.parent);
      setSuccess('Student removed from parent.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { console.error(e); }
  };

  const createChild = async () => {
    if (!newChildFirst || !newChildLast) return;
    setAddingChild(true);
    try {
      const { data } = await studentAPI.create({ firstName: newChildFirst, lastName: newChildLast, grade: newChildGrade, parentId: selectedParent.id });
      setSuccess(`Student ${newChildFirst} ${newChildLast} created and linked!`);
      setNewChildFirst(''); setNewChildLast(''); setNewChildGrade('');
      const { data: parentData } = await parentAPI.getById(selectedParent.id);
      setSelectedParent(parentData.parent);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Failed to create student'); }
    finally { setAddingChild(false); }
  };

  const handleImportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportPreview(null);
    setImportResults(null);
    try {
      const { data } = await importAPI.preview(file);
      setImportPreview(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to preview CSV');
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setError('');
    try {
      const { data } = await importAPI.importParentsStudents(importFile);
      setImportResults(data);
      setSuccess(data.message);
      fetchParents();
      setTimeout(() => setSuccess(''), 8000);
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    setImportFile(null);
    setImportPreview(null);
    setImportResults(null);
  };

  const ch = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const filtered = parents.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) || p.email.toLowerCase().includes(s);
  });

  return (
    <div>
      <div className="page-header">
        <div><h1>👪 Parent Management</h1><p>Manage parents and assign children</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setImportModalOpen(true)}>📤 Import CSV</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Parent</button>
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue">👪</div><div className="stat-info"><h4>{parents.length}</h4><p>Total Parents</p></div></div>
        <div className="stat-card"><div className="stat-icon green">✅</div><div className="stat-info"><h4>{parents.filter(p => p.children && p.children.length > 0).length}</h4><p>With Children</p></div></div>
        <div className="stat-card"><div className="stat-icon yellow">⚠️</div><div className="stat-info"><h4>{parents.filter(p => !p.children || p.children.length === 0).length}</h4><p>No Children Linked</p></div></div>
      </div>

      <div className="filter-bar">
        <input placeholder="Search parents by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="form-control" style={{ width: 320 }} />
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? <div className="card-body"><p>Loading...</p></div> : filtered.length === 0 ? <div className="empty-state"><p>No parents found.</p></div> : (
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Pickup Address</th><th>Children</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.firstName} {p.lastName}</strong></td>
                  <td>{p.email}</td>
                  <td>{p.phone || '-'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pickupAddress || '-'}</td>
                  <td>{p.children?.length || 0} student{p.children?.length !== 1 ? 's' : ''}</td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-outline btn-sm" onClick={() => openDetail(p)}>View</button>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deactivate(p.id)}>Deactivate</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Parent' : 'Add Parent'}
        footer={<><button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Add Parent'}</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-row">
          <div className="form-group"><label>First Name *</label><input className="form-control" value={form.firstName} onChange={e => ch('firstName', e.target.value)} /></div>
          <div className="form-group"><label>Last Name *</label><input className="form-control" value={form.lastName} onChange={e => ch('lastName', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Email *</label><input className="form-control" type="email" value={form.email} onChange={e => ch('email', e.target.value)} disabled={!!editing} /></div>
          <div className="form-group"><label>Phone *</label><input className="form-control" placeholder="e.g. 0712345678" value={form.phone} onChange={e => ch('phone', e.target.value)} /></div>
        </div>
        <div className="form-group"><label>Pickup Address</label><input className="form-control" placeholder="e.g. 123 Westlands Rd, Nairobi" value={form.pickupAddress} onChange={e => ch('pickupAddress', e.target.value)} /></div>
        <div className="form-row">
          <div className="form-group"><label>Pickup Latitude</label><input className="form-control" type="number" step="any" placeholder="-1.2921" value={form.pickupLat} onChange={e => ch('pickupLat', e.target.value)} /></div>
          <div className="form-group"><label>Pickup Longitude</label><input className="form-control" type="number" step="any" placeholder="36.8219" value={form.pickupLng} onChange={e => ch('pickupLng', e.target.value)} /></div>
        </div>
        <LocationPicker lat={form.pickupLat} lng={form.pickupLng} onLocationChange={(lat, lng) => setForm(p => ({ ...p, pickupLat: lat, pickupLng: lng }))} />
        {!editing && <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>A temporary password will be auto-generated and emailed to the parent.</p>}
      </Modal>

      {/* Detail/Children Modal */}
      <Modal isOpen={detailModal} onClose={() => setDetailModal(false)} title={selectedParent ? `${selectedParent.firstName} ${selectedParent.lastName} — Children` : 'Parent Details'}
        footer={<button className="btn btn-outline" onClick={() => setDetailModal(false)}>Close</button>}>
        {selectedParent && (
          <div>
            <p style={{ marginBottom: 12, color: '#6b7280' }}><strong>Email:</strong> {selectedParent.email} | <strong>Phone:</strong> {selectedParent.phone || '-'}</p>
            <p style={{ marginBottom: 16, color: '#6b7280' }}><strong>Pickup:</strong> {selectedParent.pickupAddress || 'Not set'}</p>

            <h4 style={{ marginBottom: 8 }}>Children ({selectedParent.children?.length || 0})</h4>
            {selectedParent.children && selectedParent.children.length > 0 ? (
              <table style={{ width: '100%', marginBottom: 16 }}>
                <thead><tr><th>Name</th><th>Grade</th><th>Action</th></tr></thead>
                <tbody>{selectedParent.children.map(c => (
                  <tr key={c.id}><td>{c.firstName} {c.lastName}</td><td>{c.grade || '-'}</td><td><button className="btn btn-danger btn-sm" onClick={() => removeStudent(c.id)}>Remove</button></td></tr>
                ))}</tbody>
              </table>
            ) : <p style={{ color: '#9ca3af', marginBottom: 16 }}>No children assigned yet.</p>}

            <h4 style={{ marginBottom: 8 }}>Assign Existing Student</h4>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <select className="form-control" value={assignStudentId} onChange={e => setAssignStudentId(e.target.value)} style={{ flex: 1 }}>
                <option value="">Select unassigned student...</option>
                {allStudents.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.grade || 'No grade'})</option>)}
              </select>
              <button className="btn btn-primary" onClick={assignStudent} disabled={!assignStudentId}>Assign</button>
            </div>

            <h4 style={{ marginBottom: 8 }}>Add New Child</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="form-control" placeholder="First Name *" value={newChildFirst} onChange={e => setNewChildFirst(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
              <input className="form-control" placeholder="Last Name *" value={newChildLast} onChange={e => setNewChildLast(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
              <input className="form-control" placeholder="Grade" value={newChildGrade} onChange={e => setNewChildGrade(e.target.value)} style={{ width: 80 }} />
              <button className="btn btn-primary" onClick={createChild} disabled={addingChild || !newChildFirst || !newChildLast}>{addingChild ? 'Adding...' : 'Add'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Import CSV Modal */}
      <Modal isOpen={importModalOpen} onClose={closeImportModal} title="📤 Import Parents & Students from CSV"
        footer={<>
          <button className="btn btn-outline" onClick={closeImportModal}>Close</button>
          {importPreview && !importResults && (
            <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
              {importing ? 'Importing...' : `Import ${importPreview.totalParents} Parents & ${importPreview.totalStudents} Students`}
            </button>
          )}
        </>}>
        {error && <div className="alert alert-error">{error}</div>}

        {!importResults ? (
          <div>
            <div className="form-group">
              <label>Select CSV File</label>
              <input type="file" accept=".csv" className="form-control" onChange={handleImportFileChange} />
              <small style={{ color: '#6b7280' }}>Upload a CSV with columns: Parent Name, Phone Number, Child(ren), Grade/Class</small>
            </div>

            <div style={{ marginTop: 12, padding: '10px 12px', background: '#eff6ff', borderRadius: 8, fontSize: 13, color: '#1e40af' }}>
              Imported parents set their own password in the app using their phone number — no credentials are sent.
            </div>

            {importPreview && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  <div style={{ background: '#eff6ff', padding: '12px 16px', borderRadius: 8, flex: 1 }}>
                    <strong style={{ fontSize: 20 }}>{importPreview.totalParents}</strong>
                    <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Parents</p>
                  </div>
                  <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: 8, flex: 1 }}>
                    <strong style={{ fontSize: 20 }}>{importPreview.totalStudents}</strong>
                    <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Students</p>
                  </div>
                </div>
                <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <table style={{ width: '100%', fontSize: 13 }}>
                    <thead><tr><th style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>Parent</th><th style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>Phone</th><th style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>Children</th></tr></thead>
                    <tbody>{importPreview.parents.map((p, i) => (
                      <tr key={i}>
                        <td>{p.name}</td>
                        <td>{p.phone || <span style={{ color: '#ef4444' }}>Missing</span>}</td>
                        <td>{p.children.map(c => `${c.name} (${c.grade || '?'})`).join(', ')}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="alert alert-success" style={{ marginBottom: 16 }}>{importResults.message}</div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ background: '#eff6ff', padding: '10px 14px', borderRadius: 8 }}>
                <strong>{importResults.parentsCreated}</strong> <span style={{ fontSize: 13 }}>parents created</span>
              </div>
              <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8 }}>
                <strong>{importResults.studentsCreated}</strong> <span style={{ fontSize: 13 }}>students created</span>
              </div>
            </div>

            {importResults.created && importResults.created.length > 0 && (
              <div>
                <h4 style={{ marginBottom: 8 }}>Parents Added</h4>
                <small style={{ color: '#6b7280', display: 'block', marginBottom: 8 }}>They set their own password in the app using their phone number</small>
                <div style={{ maxHeight: 250, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <table style={{ width: '100%', fontSize: 13 }}>
                    <thead><tr><th style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>Name</th><th style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>Phone</th></tr></thead>
                    <tbody>{importResults.created.map((c, i) => (
                      <tr key={i}>
                        <td>{c.name}</td>
                        <td><code>{c.phone || '-'}</code></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            {importResults.skipped?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ marginBottom: 4, color: '#f59e0b' }}>Skipped ({importResults.skipped.length})</h4>
                <ul style={{ fontSize: 13, color: '#6b7280', maxHeight: 100, overflow: 'auto' }}>
                  {importResults.skipped.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {importResults.errors?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ marginBottom: 4, color: '#ef4444' }}>Errors ({importResults.errors.length})</h4>
                <ul style={{ fontSize: 13, color: '#ef4444', maxHeight: 100, overflow: 'auto' }}>
                  {importResults.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ParentsPage;
