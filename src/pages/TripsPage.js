import React, { useState, useEffect } from 'react';
import { tripAPI, routeAPI } from '../services/api';
import Modal from '../components/Modal';
const TripsPage = () => {
  const [trips,setTrips]=useState([]); const [routes,setRoutes]=useState([]); const [loading,setLoading]=useState(true);
  const [modalOpen,setModalOpen]=useState(false); const [logModalOpen,setLogModalOpen]=useState(false); const [selectedTrip,setSelectedTrip]=useState(null); const [tripLogs,setTripLogs]=useState([]);
  const [form,setForm]=useState({routeId:'',type:'morning_pickup',scheduledDate:new Date().toISOString().split('T')[0]});
  const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [success,setSuccess]=useState('');
  const [dateFilter,setDateFilter]=useState(new Date().toISOString().split('T')[0]); const [statusFilter,setStatusFilter]=useState('');
  const fetch=async()=>{setLoading(true);try{const p={};if(dateFilter)p.date=dateFilter;if(statusFilter)p.status=statusFilter;const[t,r]=await Promise.all([tripAPI.getAll(p),routeAPI.getAll()]);setTrips(t.data.trips);setRoutes(r.data.routes.filter(r=>r.isActive));}catch(e){}finally{setLoading(false);}};
  useEffect(()=>{fetch();},[dateFilter,statusFilter]);
  const schedule=async()=>{setError('');setSaving(true);try{await tripAPI.create(form);setSuccess('Scheduled!');setModalOpen(false);fetch();setTimeout(()=>setSuccess(''),3000);}catch(e){setError(e.response?.data?.error||'Failed');}finally{setSaving(false);}};
  const start=async id=>{try{await tripAPI.start(id);setSuccess('Started!');fetch();setTimeout(()=>setSuccess(''),3000);}catch(e){}};
  const end=async id=>{try{await tripAPI.end(id);setSuccess('Completed!');fetch();setTimeout(()=>setSuccess(''),3000);}catch(e){}};
  const viewLogs=async trip=>{setSelectedTrip(trip);try{const{data}=await tripAPI.getLogs(trip.id);setTripLogs(data.logs);setLogModalOpen(true);}catch(e){}};
  const st={total:trips.length,completed:trips.filter(t=>t.status==='completed').length,inProgress:trips.filter(t=>t.status==='in_progress').length,scheduled:trips.filter(t=>t.status==='scheduled').length};
  return(<div>
    <div className="page-header"><div><h1>🚌 Trip Management</h1><p>Schedule and track daily trips</p></div><button className="btn btn-primary" onClick={()=>{setForm({routeId:'',type:'morning_pickup',scheduledDate:new Date().toISOString().split('T')[0]});setError('');setModalOpen(true);}}>+ Schedule Trip</button></div>
    {success&&<div className="alert alert-success">{success}</div>}
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-icon blue">🚌</div><div className="stat-info"><h4>{st.total}</h4><p>Total</p></div></div>
      <div className="stat-card"><div className="stat-icon green">✅</div><div className="stat-info"><h4>{st.completed}</h4><p>Completed</p></div></div>
      <div className="stat-card"><div className="stat-icon yellow">🔄</div><div className="stat-info"><h4>{st.inProgress}</h4><p>In Progress</p></div></div>
      <div className="stat-card"><div className="stat-icon red">📅</div><div className="stat-info"><h4>{st.scheduled}</h4><p>Scheduled</p></div></div>
    </div>
    <div className="filter-bar"><input type="date" className="form-control" style={{width:'auto'}} value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/><select className="form-control" style={{width:'auto'}} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All</option><option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select><button className="btn btn-outline btn-sm" onClick={()=>{setDateFilter('');setStatusFilter('');}}>Clear</button></div>
    <div className="card"><div className="table-container">{loading?<div className="card-body"><p>Loading...</p></div>:trips.length===0?<div className="empty-state"><p>No trips found.</p></div>:
      <table><thead><tr><th>Route</th><th>Vehicle</th><th>Driver</th><th>Type</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{trips.map(t=>
        <tr key={t.id}><td><strong>{t.route?.name||'-'}</strong></td><td>{t.vehicle?.plateNumber||'-'}</td><td>{t.driver?`${t.driver.firstName} ${t.driver.lastName}`:'-'}</td>
          <td><span className={`badge ${t.type==='morning_pickup'?'badge-morning':'badge-afternoon'}`}>{t.type==='morning_pickup'?'🌅 Morning':'🌇 Afternoon'}</span></td><td>{t.scheduledDate}</td>
          <td><span className={`badge badge-${t.status.replace('_','-')}`}>{t.status.replace('_',' ')}</span></td>
          <td><div className="btn-group">{t.status==='scheduled'&&<button className="btn btn-success btn-sm" onClick={()=>start(t.id)}>▶ Start</button>}{t.status==='in_progress'&&<button className="btn btn-primary btn-sm" onClick={()=>end(t.id)}>⏹ End</button>}<button className="btn btn-outline btn-sm" onClick={()=>viewLogs(t)}>📋 Logs</button></div></td></tr>)}</tbody></table>
    }</div></div>
    <Modal isOpen={modalOpen} onClose={()=>setModalOpen(false)} title="Schedule Trip" footer={<><button className="btn btn-outline" onClick={()=>setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={schedule} disabled={saving}>{saving?'Scheduling...':'Schedule'}</button></>}>
      {error&&<div className="alert alert-error">{error}</div>}
      <div className="form-group"><label>Route *</label><select className="form-control" value={form.routeId} onChange={e=>setForm(p=>({...p,routeId:e.target.value}))}><option value="">-- Select --</option>{routes.map(r=><option key={r.id} value={r.id}>{r.name} ({r.students?.length||0} students)</option>)}</select></div>
      <div className="form-row"><div className="form-group"><label>Type *</label><select className="form-control" value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}><option value="morning_pickup">🌅 Morning</option><option value="afternoon_dropoff">🌇 Afternoon</option></select></div><div className="form-group"><label>Date *</label><input type="date" className="form-control" value={form.scheduledDate} onChange={e=>setForm(p=>({...p,scheduledDate:e.target.value}))}/></div></div>
    </Modal>
    <Modal isOpen={logModalOpen} onClose={()=>setLogModalOpen(false)} title={`Logs — ${selectedTrip?.route?.name||''}`}>
      {tripLogs.length===0?<div className="empty-state"><p>No logs yet.</p></div>:<div className="table-container"><table><thead><tr><th>Time</th><th>Student</th><th>Action</th><th>Notes</th></tr></thead><tbody>{tripLogs.map(l=><tr key={l.id}><td>{new Date(l.timestamp).toLocaleTimeString()}</td><td>{l.student?.firstName} {l.student?.lastName}</td><td><span className={`badge ${l.action==='check_in'?'badge-active':l.action==='check_out'?'badge-completed':'badge-cancelled'}`}>{l.action==='check_in'?'📥 In':l.action==='check_out'?'📤 Out':'❌ Absent'}</span></td><td>{l.notes||'-'}</td></tr>)}</tbody></table></div>}
    </Modal>
  </div>);
};
export default TripsPage;
