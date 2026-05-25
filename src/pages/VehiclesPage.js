import React, { useState, useEffect, useCallback } from 'react';
import { vehicleAPI } from '../services/api';
import Modal from '../components/Modal';
const empty={plateNumber:'',make:'',model:'',year:'',capacity:30,color:'',status:'active',insuranceExpiry:'',lastServiceDate:''};
const VehiclesPage = () => {
  const [vehicles,setVehicles]=useState([]); const [stats,setStats]=useState(null); const [loading,setLoading]=useState(true); const [search,setSearch]=useState(''); const [statusFilter,setStatusFilter]=useState('');
  const [modalOpen,setModalOpen]=useState(false); const [editing,setEditing]=useState(null); const [form,setForm]=useState(empty); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [success,setSuccess]=useState('');
  const fetch=useCallback(async()=>{setLoading(true);try{const p={};if(search)p.search=search;if(statusFilter)p.status=statusFilter;const[v,s]=await Promise.all([vehicleAPI.getAll(p),vehicleAPI.getStats()]);setVehicles(v.data.vehicles);setStats(s.data.stats);}catch(e){}finally{setLoading(false);}},[search,statusFilter]);
  useEffect(()=>{fetch();},[fetch]);
  const openAdd=()=>{setEditing(null);setForm(empty);setError('');setModalOpen(true);};
  const openEdit=v=>{setEditing(v);setForm({plateNumber:v.plateNumber,make:v.make||'',model:v.model||'',year:v.year||'',capacity:v.capacity,color:v.color||'',status:v.status,insuranceExpiry:v.insuranceExpiry||'',lastServiceDate:v.lastServiceDate||''});setError('');setModalOpen(true);};
  const save=async()=>{setError('');setSaving(true);try{if(editing){await vehicleAPI.update(editing.id,form);setSuccess('Updated!');}else{await vehicleAPI.create(form);setSuccess('Added!');}setModalOpen(false);fetch();setTimeout(()=>setSuccess(''),3000);}catch(e){setError(e.response?.data?.error||'Failed');}finally{setSaving(false);}};
  const del=async id=>{if(!window.confirm('Retire this vehicle?'))return;try{await vehicleAPI.delete(id);setSuccess('Retired.');fetch();setTimeout(()=>setSuccess(''),3000);}catch(e){}};
  const ch=(f,v)=>setForm(p=>({...p,[f]:v}));
  return(<div>
    <div className="page-header"><div><h1>🚐 Vehicle Fleet Management</h1><p>Manage transport vehicles per school</p></div><button className="btn btn-primary" onClick={openAdd}>+ Add Vehicle</button></div>
    {success&&<div className="alert alert-success">{success}</div>}
    {stats&&<div className="stats-grid">
      <div className="stat-card"><div className="stat-icon blue">🚐</div><div className="stat-info"><h4>{stats.total}</h4><p>Total</p></div></div>
      <div className="stat-card"><div className="stat-icon green">✅</div><div className="stat-info"><h4>{stats.active}</h4><p>Active</p></div></div>
      <div className="stat-card"><div className="stat-icon yellow">🔧</div><div className="stat-info"><h4>{stats.maintenance}</h4><p>Maintenance</p></div></div>
      <div className="stat-card"><div className="stat-icon red">🚫</div><div className="stat-info"><h4>{stats.retired}</h4><p>Retired</p></div></div>
    </div>}
    <div className="filter-bar">
      <input placeholder="Search plate, make, model..." value={search} onChange={e=>setSearch(e.target.value)} className="form-control" style={{width:280}}/>
      <select className="form-control" style={{width:'auto'}} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All Status</option><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option></select>
    </div>
    <div className="card"><div className="table-container">{loading?<div className="card-body"><p>Loading...</p></div>:vehicles.length===0?<div className="empty-state"><p>No vehicles found.</p></div>:
      <table><thead><tr><th>Plate</th><th>Make/Model</th><th>Year</th><th>Capacity</th><th>Color</th><th>Status</th><th>Routes</th><th>Insurance</th><th>Actions</th></tr></thead>
      <tbody>{vehicles.map(v=><tr key={v.id}><td><strong>{v.plateNumber}</strong></td><td>{v.make} {v.model}</td><td>{v.year||'-'}</td><td>{v.capacity} seats</td><td>{v.color||'-'}</td>
        <td><span className={`badge badge-${v.status}`}>{v.status}</span></td><td>{v.routes?.length>0?v.routes.map(r=>r.name).join(', '):<span style={{color:'#9ca3af'}}>Unassigned</span>}</td><td>{v.insuranceExpiry||'-'}</td>
        <td><div className="btn-group"><button className="btn btn-outline btn-sm" onClick={()=>openEdit(v)}>Edit</button><button className="btn btn-danger btn-sm" onClick={()=>del(v.id)}>Retire</button></div></td></tr>)}</tbody></table>
    }</div></div>
    <Modal isOpen={modalOpen} onClose={()=>setModalOpen(false)} title={editing?'Edit Vehicle':'Add Vehicle'} footer={<><button className="btn btn-outline" onClick={()=>setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':editing?'Update':'Add Vehicle'}</button></>}>
      {error&&<div className="alert alert-error">{error}</div>}
      <div className="form-row"><div className="form-group"><label>Plate Number *</label><input className="form-control" placeholder="KDA 001A" value={form.plateNumber} onChange={e=>ch('plateNumber',e.target.value)}/></div><div className="form-group"><label>Capacity *</label><input type="number" className="form-control" value={form.capacity} onChange={e=>ch('capacity',parseInt(e.target.value))}/></div></div>
      <div className="form-row-3"><div className="form-group"><label>Make</label><input className="form-control" placeholder="Toyota" value={form.make} onChange={e=>ch('make',e.target.value)}/></div><div className="form-group"><label>Model</label><input className="form-control" placeholder="HiAce" value={form.model} onChange={e=>ch('model',e.target.value)}/></div><div className="form-group"><label>Year</label><input type="number" className="form-control" placeholder="2023" value={form.year} onChange={e=>ch('year',e.target.value)}/></div></div>
      <div className="form-row"><div className="form-group"><label>Color</label><input className="form-control" value={form.color} onChange={e=>ch('color',e.target.value)}/></div><div className="form-group"><label>Status</label><select className="form-control" value={form.status} onChange={e=>ch('status',e.target.value)}><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option></select></div></div>
      <div className="form-row"><div className="form-group"><label>Insurance Expiry</label><input type="date" className="form-control" value={form.insuranceExpiry} onChange={e=>ch('insuranceExpiry',e.target.value)}/></div><div className="form-group"><label>Last Service</label><input type="date" className="form-control" value={form.lastServiceDate} onChange={e=>ch('lastServiceDate',e.target.value)}/></div></div>
    </Modal>
  </div>);
};
export default VehiclesPage;
