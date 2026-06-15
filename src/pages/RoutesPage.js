import React, { useState, useEffect, useRef } from 'react';
import { routeAPI, vehicleAPI, studentAPI, driverAPI } from '../services/api';
import Modal from '../components/Modal';
const empty={name:'',description:'',vehicleId:'',driverId:'',type:'both',grades:[],departureTime:'07:00',outboundWaypoints:[],returnWaypoints:[],studentIds:[]};
const GRADE_OPTIONS = ['Pre-K','K','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Form 1','Form 2','Form 3','Form 4'];

const RouteMap = ({ waypoints, onWaypointsChange, suggestedStudents }) => {
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(!!window.google?.maps);
  const [useDirections, setUseDirections] = useState(true);
  const [placingMode, setPlacingMode] = useState(null); // 'start', 'end', 'waypoint'

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
        } else {
          const updated = [...waypoints.slice(0, -1), point];
          // If only start exists, append; otherwise replace last
          if (waypoints.length === 1) {
            onWaypointsChange([...waypoints, point]);
          } else {
            onWaypointsChange([...waypoints.slice(0, waypoints.length - 1), point]);
          }
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
      <div style={{ border: '2px dashed #d1d5db', borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 8 }}>📍 <strong>Route Waypoints</strong></p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {waypoints.map((wp, i) => (
            <span key={i} style={{ background: i === 0 ? '#dcfce7' : i === waypoints.length - 1 ? '#fee2e2' : '#fef9c3', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>
              {i === 0 ? '🟢 Start' : i === waypoints.length - 1 ? '🔴 End' : `📍 Stop ${i}`}: {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
              <button onClick={() => onWaypointsChange(waypoints.filter((_, j) => j !== i))} style={{ marginLeft: 4, background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id="wp-lat" type="number" step="any" placeholder="Latitude" className="form-control" style={{ width: 130 }} />
          <input id="wp-lng" type="number" step="any" placeholder="Longitude" className="form-control" style={{ width: 130 }} />
          <button className="btn btn-outline btn-sm" onClick={() => {
            const lat = parseFloat(document.getElementById('wp-lat').value);
            const lng = parseFloat(document.getElementById('wp-lng').value);
            if (!isNaN(lat) && !isNaN(lng)) { onWaypointsChange([...waypoints, { lat, lng }]); document.getElementById('wp-lat').value = ''; document.getElementById('wp-lng').value = ''; }
          }}>+ Add Point</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={`btn btn-sm ${placingMode === 'start' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPlacingMode(placingMode === 'start' ? null : 'start')}>
          🟢 {waypoints.length > 0 ? 'Move Start' : 'Set Start'}
        </button>
        <button className={`btn btn-sm ${placingMode === 'end' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPlacingMode(placingMode === 'end' ? null : 'end')}>
          🔴 {waypoints.length > 1 ? 'Move End' : 'Set End'}
        </button>
        <button className={`btn btn-sm ${placingMode === 'waypoint' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPlacingMode(placingMode === 'waypoint' ? null : 'waypoint')}>
          📍 Add Waypoint
        </button>
        {waypoints.length > 0 && <button className="btn btn-sm btn-danger" onClick={() => onWaypointsChange([])}>🗑️ Clear All</button>}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}>
          <input type="checkbox" checked={useDirections} onChange={e => setUseDirections(e.target.checked)} />
          Show driving route
        </label>
      </div>
      {placingMode && (
        <div style={{ padding: '6px 12px', background: placingMode === 'start' ? '#dcfce7' : placingMode === 'end' ? '#fee2e2' : '#fef9c3', borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
          👆 Click on the map to {placingMode === 'start' ? 'set the start point' : placingMode === 'end' ? 'set the end point' : 'add a waypoint'}
          {placingMode === 'waypoint' && ' (keep clicking to add more, then click "Add Waypoint" button again to stop)'}
        </div>
      )}
      <div ref={mapRef} style={{ width: '100%', height: 350, borderRadius: 12, marginBottom: 12, cursor: placingMode ? 'crosshair' : 'default' }} />
    </div>
  );
};

const RoutesPage = () => {
  const [routes,setRoutes]=useState([]); const [vehicles,setVehicles]=useState([]); const [students,setStudents]=useState([]); const [drivers,setDrivers]=useState([]); const [loading,setLoading]=useState(true);
  const [modalOpen,setModalOpen]=useState(false); const [editing,setEditing]=useState(null); const [form,setForm]=useState(empty); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [success,setSuccess]=useState(''); const [expanded,setExpanded]=useState(null);
  const [suggested,setSuggested]=useState(null); const [suggesting,setSuggesting]=useState(false);
  const fetch=async()=>{setLoading(true);try{const[r,v,s,d]=await Promise.all([routeAPI.getAll(),vehicleAPI.getAll(),studentAPI.getAll(),driverAPI.getAll()]);setRoutes(r.data.routes);setVehicles(v.data.vehicles.filter(v=>v.status==='active'));setStudents(s.data.students);setDrivers(d.data.drivers);}catch(e){}finally{setLoading(false);}};
  useEffect(()=>{fetch();},[]);
  const openAdd=()=>{setEditing(null);setForm(empty);setError('');setSuggested(null);setModalOpen(true);};
  const openEdit=r=>{setEditing(r);setForm({name:r.name,description:r.description||'',vehicleId:r.vehicleId||'',driverId:r.driverId||'',type:r.type,grades:r.grades||[],departureTime:r.departureTime||'07:00',outboundWaypoints:(r.routeWaypoints||[]).filter(w=>w.leg==='outbound').sort((a,b)=>a.orderIndex-b.orderIndex).map(w=>({lat:parseFloat(w.lat),lng:parseFloat(w.lng),label:w.label,isStop:w.isStop})),returnWaypoints:(r.routeWaypoints||[]).filter(w=>w.leg==='return').sort((a,b)=>a.orderIndex-b.orderIndex).map(w=>({lat:parseFloat(w.lat),lng:parseFloat(w.lng),label:w.label,isStop:w.isStop})),studentIds:r.students?.map(s=>s.id)||[]});setError('');setSuggested(null);setModalOpen(true);};
  const save=async()=>{setError('');setSaving(true);try{const payload={...form,vehicleId:form.vehicleId||null,driverId:form.driverId||null};if(editing){await routeAPI.update(editing.id,payload);setSuccess('Updated!');}else{await routeAPI.create(payload);setSuccess('Created!');}setModalOpen(false);fetch();setTimeout(()=>setSuccess(''),3000);}catch(e){setError(e.response?.data?.error||'Failed');}finally{setSaving(false);}};
  const suggestStudents=async(grades,waypoints)=>{if(!grades||!waypoints)return;if(grades.length===0&&waypoints.length===0)return;setSuggesting(true);try{const{data}=await routeAPI.suggestStudents({grades,waypoints,radiusKm:3});setSuggested(data.students);return data.students;}catch(e){console.error(e);return[];}finally{setSuggesting(false);}};
  const autoSuggest=async(grades,waypoints)=>{if(grades.length===0||waypoints.length===0){setSuggested(null);return;}const results=await suggestStudents(grades,waypoints);if(results&&results.length>0){const ids=results.map(s=>s.id);setForm(p=>({...p,studentIds:[...new Set([...p.studentIds,...ids])]}));}};
  const addSuggestedStudents=()=>{if(!suggested)return;const ids=suggested.map(s=>s.id);setForm(p=>({...p,studentIds:[...new Set([...p.studentIds,...ids])]}));setSuccess(`${ids.length} students added from suggestions`);setTimeout(()=>setSuccess(''),3000);};
  const handleGradesChange=(grade)=>{const newGrades=form.grades.includes(grade)?form.grades.filter(x=>x!==grade):[...form.grades,grade];setForm(p=>({...p,grades:newGrades}));autoSuggest(newGrades,[...form.outboundWaypoints,...form.returnWaypoints]);};
  const handleOutboundChange=(wps)=>{setForm(p=>({...p,outboundWaypoints:wps}));autoSuggest(form.grades,[...wps,...form.returnWaypoints]);};
  const handleReturnChange=(wps)=>{setForm(p=>({...p,returnWaypoints:wps}));autoSuggest(form.grades,[...form.outboundWaypoints,...wps]);};
  const ch=(f,v)=>setForm(p=>({...p,[f]:v}));
  const toggleStudent=id=>setForm(p=>({...p,studentIds:p.studentIds.includes(id)?p.studentIds.filter(i=>i!==id):[...p.studentIds,id]}));
  return(<div>
    <div className="page-header"><div><h1>🗺️ Route Management</h1><p>Configure routes, assign vehicles and students</p></div><button className="btn btn-primary" onClick={openAdd}>+ Create Route</button></div>
    {success&&<div className="alert alert-success">{success}</div>}
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-icon blue">🗺️</div><div className="stat-info"><h4>{routes.length}</h4><p>Total Routes</p></div></div>
      <div className="stat-card"><div className="stat-icon green">🚐</div><div className="stat-info"><h4>{routes.filter(r=>r.vehicleId).length}</h4><p>With Vehicles</p></div></div>
      <div className="stat-card"><div className="stat-icon yellow">🎒</div><div className="stat-info"><h4>{routes.reduce((s,r)=>s+(r.students?.length||0),0)}</h4><p>Students Assigned</p></div></div>
    </div>
    {loading?<p>Loading...</p>:routes.length===0?<div className="card"><div className="empty-state"><p>No routes yet.</p></div></div>:
      <div style={{display:'grid',gap:'1rem'}}>{routes.map(r=><div key={r.id} className="card">
        <div className="card-header" style={{cursor:'pointer'}} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>
          <div style={{display:'flex',alignItems:'center',gap:'1rem'}}><h3>{r.name}</h3><span className={`badge badge-${r.type}`}>{r.type}</span>{r.isActive?<span className="badge badge-active">Active</span>:<span className="badge badge-retired">Inactive</span>}</div>
          <div className="btn-group"><button className="btn btn-outline btn-sm" onClick={e=>{e.stopPropagation();openEdit(r);}}>Edit</button><span style={{fontSize:'1.2rem'}}>{expanded===r.id?'▲':'▼'}</span></div>
        </div>
        <div className="card-body">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'1rem',fontSize:'.875rem'}}>
            <div><strong>Vehicle:</strong> {r.vehicle?`${r.vehicle.plateNumber} (${r.vehicle.make} ${r.vehicle.model}, ${r.vehicle.capacity} seats)`:<span style={{color:'#9ca3af'}}>Unassigned</span>}</div>
            <div><strong>Driver:</strong> {r.driver?`${r.driver.firstName} ${r.driver.lastName}`:<span style={{color:'#9ca3af'}}>Unassigned</span>}</div>
            <div><strong>Departure:</strong> {r.departureTime||'Not set'}</div>
            <div><strong>Students:</strong> {r.students?.length||0}</div>
          </div>
          {r.grades&&r.grades.length>0&&<div style={{marginTop:8,fontSize:'.8rem'}}><strong>Grades:</strong> {r.grades.join(', ')}</div>}
          {expanded===r.id&&r.students?.length>0&&<div style={{marginTop:'1rem'}}><h4 style={{fontSize:'.85rem',marginBottom:'.5rem'}}>Assigned Students:</h4><table><thead><tr><th>#</th><th>Student</th><th>Grade</th></tr></thead><tbody>{r.students.sort((a,b)=>(a.RouteStudent?.stopOrder||0)-(b.RouteStudent?.stopOrder||0)).map((s,i)=><tr key={s.id}><td>{i+1}</td><td>{s.firstName} {s.lastName}</td><td>{s.grade||'-'}</td></tr>)}</tbody></table></div>}
        </div>
      </div>)}</div>}
    <Modal isOpen={modalOpen} onClose={()=>setModalOpen(false)} title={editing?'Edit Route':'Create Route'} footer={<><button className="btn btn-outline" onClick={()=>setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':editing?'Update':'Create'}</button></>}>
      {error&&<div className="alert alert-error">{error}</div>}
      <div className="form-group"><label>Name *</label><input className="form-control" placeholder="Westlands–Kilimani Route" value={form.name} onChange={e=>ch('name',e.target.value)}/></div>
      <div className="form-group"><label>Description</label><textarea className="form-control" rows={2} value={form.description} onChange={e=>ch('description',e.target.value)}/></div>
      <div className="form-row">
        <div className="form-group"><label>Vehicle</label><select className="form-control" value={form.vehicleId} onChange={e=>ch('vehicleId',e.target.value)}><option value="">-- Select --</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.plateNumber} ({v.make} {v.model})</option>)}</select></div>
        <div className="form-group"><label>Driver</label><select className="form-control" value={form.driverId} onChange={e=>ch('driverId',e.target.value)}><option value="">-- Select --</option>{drivers.map(d=><option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}</select></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Type</label><select className="form-control" value={form.type} onChange={e=>ch('type',e.target.value)}><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="both">Both</option></select></div>
        <div className="form-group"><label>Departure Time</label><input type="time" className="form-control" value={form.departureTime} onChange={e=>ch('departureTime',e.target.value)}/></div>
      </div>
      <div className="form-group"><label>Grades Served</label>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'8px',border:'1px solid #e5e7eb',borderRadius:8}}>
          {GRADE_OPTIONS.map(g=><label key={g} style={{display:'flex',alignItems:'center',gap:4,fontSize:'.8rem',cursor:'pointer',padding:'2px 6px',background:form.grades.includes(g)?'#dcfce7':'#f9fafb',borderRadius:4}}>
            <input type="checkbox" checked={form.grades.includes(g)} onChange={()=>handleGradesChange(g)} style={{width:14,height:14}}/>{g}
          </label>)}
        </div>
      </div>
      <div className="form-group"><label>Outbound Waypoints ({form.outboundWaypoints.length} points) — A → B path</label>
        <RouteMap waypoints={form.outboundWaypoints} onWaypointsChange={handleOutboundChange} suggestedStudents={suggested}/>
        {form.outboundWaypoints.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>{form.outboundWaypoints.map((wp,i)=><span key={i} style={{background:i===0?'#dcfce7':i===form.outboundWaypoints.length-1?'#fee2e2':'#fef9c3',padding:'3px 8px',borderRadius:6,fontSize:'.75rem'}}>{i===0?'🟢 Start':i===form.outboundWaypoints.length-1?'🔴 End':`📍 Stop ${i}`}: ({wp.lat.toFixed(4)},{wp.lng.toFixed(4)}) <button onClick={()=>handleOutboundChange(form.outboundWaypoints.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontWeight:'bold'}}>×</button></span>)}</div>}
      </div>
      <div className="form-group"><label>Return Waypoints ({form.returnWaypoints.length} points) — B → A path</label>
        <RouteMap waypoints={form.returnWaypoints} onWaypointsChange={handleReturnChange} suggestedStudents={suggested}/>
        {form.returnWaypoints.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>{form.returnWaypoints.map((wp,i)=><span key={i} style={{background:i===0?'#dcfce7':i===form.returnWaypoints.length-1?'#fee2e2':'#fef9c3',padding:'3px 8px',borderRadius:6,fontSize:'.75rem'}}>{i===0?'🟢 Start':i===form.returnWaypoints.length-1?'🔴 End':`📍 Stop ${i}`}: ({wp.lat.toFixed(4)},{wp.lng.toFixed(4)}) <button onClick={()=>handleReturnChange(form.returnWaypoints.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontWeight:'bold'}}>×</button></span>)}</div>}
      </div>
      <div className="form-group" style={{borderTop:'1px solid #e5e7eb',paddingTop:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <label>Students ({form.studentIds.length}) {suggesting&&<span style={{color:'#6b7280',fontSize:'.8rem'}}>— auto-matching...</span>}</label>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-outline btn-sm" onClick={()=>suggestStudents(form.grades,[...form.outboundWaypoints,...form.returnWaypoints])} disabled={suggesting||(form.outboundWaypoints.length===0&&form.returnWaypoints.length===0)||form.grades.length===0}>{suggesting?'Finding...':'🎯 Re-suggest'}</button>
            {suggested&&<button className="btn btn-outline btn-sm" onClick={addSuggestedStudents}>✅ Add All ({suggested.length})</button>}
          </div>
        </div>
        {suggested&&<div style={{marginBottom:8,padding:8,background:'#eff6ff',borderRadius:8,fontSize:'.8rem'}}><strong>💡 {suggested.length} students auto-matched</strong> within 3km of route with matching grades:{suggested.map(s=><span key={s.id} style={{display:'inline-block',background:'#dbeafe',margin:'2px 4px',padding:'2px 6px',borderRadius:4}}>{s.firstName} {s.lastName} ({s.grade}) - {s.distanceKm?.toFixed(1)}km</span>)}</div>}
        <div style={{maxHeight:180,overflowY:'auto',border:'1px solid #e5e7eb',borderRadius:8,padding:'.5rem'}}>{students.map(s=><label key={s.id} style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.3rem .5rem',cursor:'pointer',fontSize:'.85rem'}}><input type="checkbox" checked={form.studentIds.includes(s.id)} onChange={()=>toggleStudent(s.id)}/>{s.firstName} {s.lastName} <span style={{color:'#9ca3af'}}>({s.grade||'N/A'})</span></label>)}</div>
      </div>
    </Modal>
  </div>);
};
export default RoutesPage;
