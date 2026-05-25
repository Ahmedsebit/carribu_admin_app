import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VehiclesPage from './pages/VehiclesPage';
import StudentsPage from './pages/StudentsPage';
import RoutesPage from './pages/RoutesPage';
import TripsPage from './pages/TripsPage';
import ParentsPage from './pages/ParentsPage';
import DriversPage from './pages/DriversPage';

const ProtectedRoute = ({children}) => { const {isAuthenticated,loading}=useAuth(); if(loading) return <div style={{padding:'2rem',textAlign:'center'}}>Loading...</div>; return isAuthenticated?children:<Navigate to="/login"/>; };
const AppLayout = ({children}) => <div className="app-layout"><Sidebar/><main className="main-content">{children}</main></div>;
const AppRoutes = () => {
  const {isAuthenticated}=useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated?<Navigate to="/dashboard"/>:<LoginPage/>}/>
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><DashboardPage/></AppLayout></ProtectedRoute>}/>
      <Route path="/vehicles" element={<ProtectedRoute><AppLayout><VehiclesPage/></AppLayout></ProtectedRoute>}/>
      <Route path="/students" element={<ProtectedRoute><AppLayout><StudentsPage/></AppLayout></ProtectedRoute>}/>
      <Route path="/routes" element={<ProtectedRoute><AppLayout><RoutesPage/></AppLayout></ProtectedRoute>}/>
      <Route path="/trips" element={<ProtectedRoute><AppLayout><TripsPage/></AppLayout></ProtectedRoute>}/>
      <Route path="/parents" element={<ProtectedRoute><AppLayout><ParentsPage/></AppLayout></ProtectedRoute>}/>
      <Route path="/drivers" element={<ProtectedRoute><AppLayout><DriversPage/></AppLayout></ProtectedRoute>}/>
      <Route path="*" element={<Navigate to="/dashboard"/>}/>
    </Routes>);
};
const App = () => <AuthProvider><Router><AppRoutes/></Router></AuthProvider>;
export default App;
