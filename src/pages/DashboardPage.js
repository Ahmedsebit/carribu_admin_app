import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { schoolAPI, vehicleAPI, tripAPI } from '../services/api';
const DashboardPage = () => {
  const {user}=useAuth(); const [dash,setDash]=useState(null); const [vStats,setVStats]=useState(null); const [trips,setTrips]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ if(!user?.schoolId) return; (async()=>{ try { const [d,v,t]=await Promise.all([schoolAPI.getDashboard(user.schoolId),vehicleAPI.getStats(),tripAPI.getAll({date:new Date().toISOString().split('T')[0]})]); setDash(d.data.dashboard);setVStats(v.data.stats);setTrips(t.data.trips); } catch(e){} finally{setLoading(false);} })(); },[user]);
  if(loading) return <p>Loading dashboard...</p>;
  return (<div>
    <div className="page-header"><div><h1>Dashboard</h1><p>Welcome back, {user?.firstName}!</p></div></div>
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-icon blue">🚐</div><div className="stat-info"><h4>{dash?.vehicleCount||0}</h4><p>Active Vehicles</p></div></div>
      <div className="stat-card"><div className="stat-icon green">🎒</div><div className="stat-info"><h4>{dash?.studentCount||0}</h4><p>Students</p></div></div>
      <div className="stat-card"><div className="stat-icon yellow">🗺️</div><div className="stat-info"><h4>{dash?.routeCount||0}</h4><p>Routes</p></div></div>
      <div className="stat-card"><div className="stat-icon red">👨‍✈️</div><div className="stat-info"><h4>{dash?.driverCount||0}</h4><p>Drivers</p></div></div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem'}}>
      <div className="card"><div className="card-header"><h3>🚐 Fleet Status</h3></div><div className="card-body">{vStats?
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
          {[['Active',vStats.active,'#dcfce7','#16a34a'],['Maintenance',vStats.maintenance,'#fef3c7','#d97706'],['Retired',vStats.retired,'#f3f4f6','#6b7280'],['Total',vStats.total,'#dbeafe','#2563eb']].map(([l,n,bg,c])=>
            <div key={l} style={{textAlign:'center',padding:'1rem',background:bg,borderRadius:'8px'}}><div style={{fontSize:'1.5rem',fontWeight:700,color:c}}>{n}</div><div style={{fontSize:'.8rem',color:c}}>{l}</div></div>)}
        </div>:<p>No data</p>}</div></div>
      <div className="card"><div className="card-header"><h3>🚌 Today's Trips</h3></div><div className="card-body">{trips.length>0?
        <div className="table-container"><table><thead><tr><th>Route</th><th>Driver</th><th>Status</th></tr></thead><tbody>{trips.map(t=>
          <tr key={t.id}><td>{t.route?.name||'-'}</td><td>{t.driver?`${t.driver.firstName} ${t.driver.lastName}`:'-'}</td><td><span className={`badge badge-${t.status.replace('_','-')}`}>{t.status.replace('_',' ')}</span></td></tr>
        )}</tbody></table></div>:<div className="empty-state"><p>No trips today.</p></div>}</div></div>
    </div>
  </div>);
};
export default DashboardPage;
