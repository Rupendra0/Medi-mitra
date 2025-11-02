import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from '../utils/api';
import { logoutSuccess } from '../utils/authSlice';

export default function ButtonBar() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const dashboardLabel = useMemo(() => {
    if (user?.role === 'doctor') return 'Doctor Dashboard';
    if (user?.role === 'patient') return 'Patient Dashboard';
    return 'Dashboard Home';
  }, [user?.role]);

  const handleDashboard = () => {
    if (user?.role === 'doctor') {
      navigate('/doctor');
    } else if (user?.role === 'patient') {
      navigate('/patient');
    } else {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    try {
      await api.apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      dispatch(logoutSuccess());
      navigate('/');
    }
  };

  return (
    <div className="sidebar-button-bar">
      <button type="button" className="sidebar-btn sidebar-btn-primary" onClick={handleDashboard}>
        {dashboardLabel}
      </button>
      <button type="button" className="sidebar-btn sidebar-btn-secondary" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}
