import React, { useState, useEffect, useCallback } from 'react';
import { studentAPI } from '../services/api';
import Modal from '../components/Modal';
const empty={firstName:'',lastName:'',grade:''};
const StudentsPage = () => {
  const [students,setStudents]=useState([]); const [loading,setLoading]=useState(true); const [search,setSearch]=useState(''); const [gradeFilter,setGradeFilter]=useState('');
  const [modalOpen,setModalOpen]=useState(false); const [editing,setEditing]=useState(null); const [form,setForm]=useState(empty); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [success,setSuccess]=useState('');
  const fetch=useCallback(async()=>{setLoading(true);try{const p={};if(search)p.search=search;if(gradeFilter)p.grade=gradeFilter;const{data}=await studentAPI.getAll(p);setStudents(data.students);}catch(e){}finally{setLoading(false);}},[search,gradeFilter]);
  useEffect(()=>{fetch();},[fetch]);
  const openAdd=()=>{setEditing(null);setForm(empty);setError('');setModalOpen(true);};
  const openEdit=s=>{setEditing(s);setForm({firstName:s.firstName,lastName:s.lastName,grade:s.grade||''});setError('');setModalOpen(true);};
  const save=async()=>{setError('');setSaving(true);try{if(editing){await studentAPI.update(editing.id,form);setSuccess('Updated!');}else{await studentAPI.create(form);setSuccess('Added!');}setModalOpen(false);fetch();setTimeout(()=>setSuccess(''),3000);}catch(e){setError(e.response?.data?.error||'Failed');}finally{setSaving(false);}};
  const del=async id=>{if(!window.confirm('Deactivate?'))return;try{await studentAPI.delete(id);setSuccess('Deactivated.');fetch();setTimeout(()=>setSuccess(''),3000);}catch(e){}};
  const ch=(f,v)=>setForm(p=>({...p,[f]:v}));
  const grades=[...new Set(students.map(s=>s.grade).filter(Boolean))].sort();
  return(<div>
    <div className="page-header"><div><h1>🎒 Student Management</h1><p>Manage students and transport details</p></div><button className="btn btn-primary" onClick={openAdd}>+ Add Student</button></div>
    {success&&<div className="alert alert-success">{success}</div>}
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-icon blue">🎒</div><div className="stat-info"><h4>{students.length}</h4><p>Total</p></div></div>
      <div className="stat-card"><div className="stat-icon green">🗺️</div><div className="stat-info"><h4>{students.filter(s=>s.routes?.length>0).length}</h4><p>Assigned</p></div></div>
      <div className="stat-card"><div className="stat-icon yellow">⚠️</div><div className="stat-info"><h4>{students.filter(s=>!s.routes||s.routes.length===0).length}</h4><p>Unassigned</p></div></div>
    </div>
    <div className="filter-bar"><input placeholder="Search students..." value={search} onChange={e=>setSearch(e.target.value)} className="form-control" style={{width:280}}/><select className="form-control" style={{width:'auto'}} value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)}><option value="">All Grades</option>{grades.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
    <div className="card"><div className="table-container">{loading?<div className="card-body"><p>Loading...</p></div>:students.length===0?<div className="empty-state"><p>No students found.</p></div>:
      <table><thead><tr><th>Name</th><th>Grade</th><th>Parent</th><th>Pickup</th><th>Route(s)</th><th>Actions</th></tr></thead><tbody>{students.map(s=>
        <tr key={s.id}><td><strong>{s.firstName} {s.lastName}</strong></td><td>{s.grade||'-'}</td><td>{s.parent?`${s.parent.firstName} ${s.parent.lastName}`:<span style={{color:'#9ca3af'}}>Not linked</span>}</td>
          <td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.parent?.pickupAddress||'-'}</td>
          <td>{s.routes?.length>0?s.routes.map(r=><span key={r.id} className="badge badge-active" style={{marginRight:4}}>{r.name}</span>):<span style={{color:'#9ca3af'}}>None</span>}</td>
          <td><div className="btn-group"><button className="btn btn-outline btn-sm" onClick={()=>openEdit(s)}>Edit</button><button className="btn btn-danger btn-sm" onClick={()=>del(s.id)}>Remove</button></div></td></tr>)}</tbody></table>
    }</div></div>
    <Modal isOpen={modalOpen} onClose={()=>setModalOpen(false)} title={editing?'Edit Student':'Add Student'} footer={<><button className="btn btn-outline" onClick={()=>setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':editing?'Update':'Add'}</button></>}>
      {error&&<div className="alert alert-error">{error}</div>}
      <div className="form-row"><div className="form-group"><label>First Name *</label><input className="form-control" value={form.firstName} onChange={e=>ch('firstName',e.target.value)}/></div><div className="form-group"><label>Last Name *</label><input className="form-control" value={form.lastName} onChange={e=>ch('lastName',e.target.value)}/></div></div>
      <div className="form-group"><label>Grade</label><input className="form-control" placeholder="Grade 3" value={form.grade} onChange={e=>ch('grade',e.target.value)}/></div>
    </Modal>
  </div>);
};
export default StudentsPage;
