import React, { useState, useEffect, useCallback } from 'react';
import { parentAPI, studentAPI } from '../services/api';
import Modal from '../components/Modal';

const emptyForm = { firstName: '', lastName: '', email: '', phone: '' };

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
  const [tempPassword, setTempPassword] = useState('');
  const [detailModal, setDetailModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [newChildFirst, setNewChildFirst] = useState('');
  const [newChildLast, setNewChildLast] = useState('');
  const [newChildGrade, setNewChildGrade] = useState('');
  const [addingChild, setAddingChild] = useState(false);

  const fetchParents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await parentAPI.getAll();
      setParents(data.parents);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchParents(); }, [fetchParents]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setTempPassword(''); setModalOpen(true); };
  const openEdit = p => { setEditing(p); setForm({ firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone || '' }); setError(''); setTempPassword(''); setModalOpen(true); };

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
    setError(''); setSaving(true);
    try {
      if (editing) {
        await parentAPI.update(editing.id, form);
        setSuccess('Parent updated!');
      } else {
        const { data } = await parentAPI.create(form);
        if (data.tempPassword) setTempPassword(data.tempPassword);
        if (data.previewUrl) {
          setSuccess(`Parent created! Email sent — preview: ${data.previewUrl}`);
          window.open(data.previewUrl, '_blank');
        } else {
          setSuccess('Parent created! Welcome email sent.');
        }
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
        <button className="btn btn-primary" onClick={openAdd}>+ Add Parent</button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {tempPassword && (
        <div className="alert alert-success" style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e' }}>
          <strong>Temporary Password:</strong> {tempPassword} <br />
          <small>This was included in the welcome email. Save it in case the email doesn't arrive.</small>
        </div>
      )}

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
          <div className="form-group"><label>Phone</label><input className="form-control" value={form.phone} onChange={e => ch('phone', e.target.value)} /></div>
        </div>
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
    </div>
  );
};

export default ParentsPage;
