import React, { useState, useEffect, useCallback } from 'react';
import { driverAPI } from '../services/api';
import Modal from '../components/Modal';

const emptyForm = { firstName: '', lastName: '', email: '', phone: '' };

const DriversPage = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await driverAPI.getAll();
      setDrivers(data.drivers);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setTempPassword(''); setModalOpen(true); };
  const openEdit = d => { setEditing(d); setForm({ firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone || '' }); setError(''); setTempPassword(''); setModalOpen(true); };

  const save = async () => {
    setError(''); setSaving(true);
    try {
      if (editing) {
        await driverAPI.update(editing.id, form);
        setSuccess('Driver updated!');
      } else {
        const { data } = await driverAPI.create(form);
        if (data.tempPassword) setTempPassword(data.tempPassword);
        if (data.previewUrl) {
          setSuccess(`Driver created! Email sent.`);
          window.open(data.previewUrl, '_blank');
        } else {
          setSuccess('Driver created! Welcome email sent.');
        }
      }
      setModalOpen(false); fetchDrivers();
      setTimeout(() => setSuccess(''), 5000);
    } catch (e) { setError(e.response?.data?.error || 'Failed to save'); } finally { setSaving(false); }
  };

  const resetPassword = async id => {
    if (!window.confirm('Reset this driver\'s password? A new password will be generated and emailed to them.')) return;
    try {
      const { data } = await driverAPI.resetPassword(id);
      if (data.tempPassword) setTempPassword(data.tempPassword);
      if (data.previewUrl) {
        window.open(data.previewUrl, '_blank');
      }
      setSuccess(data.emailSent ? 'Password reset! New password emailed to driver.' : 'Password reset! (Email delivery could not be confirmed)');
      setTimeout(() => setSuccess(''), 5000);
    } catch (e) { setError(e.response?.data?.error || 'Failed to reset password'); setTimeout(() => setError(''), 5000); }
  };

  const deactivate = async id => {
    if (!window.confirm('Deactivate this driver?')) return;
    try { await driverAPI.delete(id); setSuccess('Driver deactivated.'); fetchDrivers(); setTimeout(() => setSuccess(''), 3000); } catch (e) { console.error(e); }
  };

  const ch = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const filtered = drivers.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return `${d.firstName} ${d.lastName}`.toLowerCase().includes(s) || d.email.toLowerCase().includes(s);
  });

  return (
    <div>
      <div className="page-header">
        <div><h1>🚗 Driver Management</h1><p>Manage drivers and their assignments</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Driver</button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && !modalOpen && <div className="alert alert-error">{error}</div>}
      {tempPassword && (
        <div className="alert alert-success" style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e' }}>
          <strong>Temporary Password:</strong> {tempPassword} <br />
          <small>This was included in the welcome email sent to the driver.</small>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue">🚗</div><div className="stat-info"><h4>{drivers.length}</h4><p>Total Drivers</p></div></div>
        <div className="stat-card"><div className="stat-icon green">🗺️</div><div className="stat-info"><h4>{drivers.filter(d => d.assignedRoutes && d.assignedRoutes.length > 0).length}</h4><p>With Routes</p></div></div>
        <div className="stat-card"><div className="stat-icon yellow">⚠️</div><div className="stat-info"><h4>{drivers.filter(d => !d.assignedRoutes || d.assignedRoutes.length === 0).length}</h4><p>Unassigned</p></div></div>
      </div>

      <div className="filter-bar">
        <input placeholder="Search drivers by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="form-control" style={{ width: 320 }} />
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? <div className="card-body"><p>Loading...</p></div> : filtered.length === 0 ? <div className="empty-state"><p>No drivers found.</p></div> : (
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Routes</th><th>Vehicle</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map(d => (
                <tr key={d.id}>
                  <td><strong>{d.firstName} {d.lastName}</strong></td>
                  <td>{d.email}</td>
                  <td>{d.phone || '-'}</td>
                  <td>{d.assignedRoutes?.length > 0 ? d.assignedRoutes.map(r => <span key={r.id} className="badge badge-active" style={{ marginRight: 4 }}>{r.name}</span>) : <span style={{ color: '#9ca3af' }}>None</span>}</td>
                  <td>{d.assignedRoutes?.find(r => r.vehicle) ? d.assignedRoutes.filter(r => r.vehicle).map(r => <span key={r.id} className="badge" style={{ marginRight: 4, background: '#dbeafe', color: '#1e40af' }}>{r.vehicle.plateNumber}</span>) : <span style={{ color: '#9ca3af' }}>-</span>}</td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(d)}>Edit</button>
                      <button className="btn btn-outline btn-sm" style={{ color: '#d97706', borderColor: '#d97706' }} onClick={() => resetPassword(d.id)}>Reset Password</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deactivate(d.id)}>Deactivate</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Driver' : 'Add Driver'}
        footer={<><button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Add Driver'}</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-row">
          <div className="form-group"><label>First Name *</label><input className="form-control" value={form.firstName} onChange={e => ch('firstName', e.target.value)} /></div>
          <div className="form-group"><label>Last Name *</label><input className="form-control" value={form.lastName} onChange={e => ch('lastName', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Email *</label><input className="form-control" type="email" value={form.email} onChange={e => ch('email', e.target.value)} disabled={!!editing} /></div>
          <div className="form-group"><label>Phone</label><input className="form-control" value={form.phone} onChange={e => ch('phone', e.target.value)} /></div>
        </div>
        {!editing && <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>A temporary password will be auto-generated and emailed to the driver.</p>}
      </Modal>
    </div>
  );
};

export default DriversPage;
