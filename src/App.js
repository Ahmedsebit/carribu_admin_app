import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Center, Loader, Stack, Text } from '@mantine/core';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VehiclesPage from './pages/VehiclesPage';
import StudentsPage from './pages/StudentsPage';
import RoutesPage from './pages/RoutesPage';
import TripsPage from './pages/TripsPage';
import ParentsPage from './pages/ParentsPage';
import DriversPage from './pages/DriversPage';

const ProtectedRoute = ({children}) => {
  const {isAuthenticated,loading}=useAuth();
  if(loading) return <Center mih="100vh"><Stack align="center" gap="xs"><Loader color="carribu" /><Text c="dimmed" size="sm">Loading...</Text></Stack></Center>;
  return isAuthenticated?children:<Navigate to="/login"/>;
};
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
