import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
const Sidebar = () => {
  const {user,logout}=useAuth();
  const items = [{to:'/dashboard',label:'Dashboard',icon:'📊'},{to:'/vehicles',label:'Vehicles',icon:'🚐'},{to:'/drivers',label:'Drivers',icon:'🚗'},{to:'/students',label:'Students',icon:'🎒'},{to:'/parents',label:'Parents',icon:'👪'},{to:'/routes',label:'Routes',icon:'🗺️'},{to:'/trips',label:'Trips',icon:'🚌'}];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><h2>🚐 SchoolTransport</h2><p>Management System</p></div>
      <nav className="sidebar-nav">{items.map(i=><NavLink key={i.to} to={i.to} className={({isActive})=>isActive?'active':''}><span>{i.icon}</span><span>{i.label}</span></NavLink>)}</nav>
      <div className="sidebar-footer">
        <div style={{marginBottom:'.5rem'}}><strong>{user?.firstName} {user?.lastName}</strong><div style={{fontSize:'.7rem',textTransform:'capitalize'}}>{user?.role} • {user?.school?.name||'School'}</div></div>
        <button onClick={logout} className="btn btn-outline btn-sm" style={{width:'100%',justifyContent:'center',color:'#ccc',borderColor:'#555'}}>Logout</button>
      </div>
    </aside>);
};
export default Sidebar;
