import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { checkUserStatus } from "./utils/authSlice"; // Import the thunk
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import CallPage from "./pages/CallPage";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CallNotification from "./components/CallNotification";

// This component now handles the loading state
const ProtectedRoute = ({ children, role }) => {
  const { isAuthenticated, user, authStatus } = useSelector((state) => state.auth);

  if (authStatus === 'loading' || authStatus === 'idle') {
    // Show a loading screen while we check for a session
    return <div>Loading...</div>; // Or a spinner component
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && user?.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const Layout = ({ children }) => {
  const location = useLocation();
  const path = location.pathname;
  const hideNavbarFooter = path === "/login" || path === "/signup" || path.startsWith("/patient") || path.startsWith("/doctor");

  return (
    <div className="min-h-screen flex flex-col">
      {!hideNavbarFooter && <Navbar />}
      <main className="flex-grow">{children}</main>
      {!hideNavbarFooter && <Footer />}
    </div>
  );
};

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Dispatch the thunk to check user status on initial load
    dispatch(checkUserStatus());
  }, [dispatch]);

  return (
    <Router>
      <Layout>
        <CallNotification />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route 
            path="/call/:id"
            element={
              <ProtectedRoute>
                <CallPage />
              </ProtectedRoute>
            }
          />
          
          <Route 
            path="/patient/*" 
            element={
              <ProtectedRoute role="patient">
                <PatientDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/doctor/*" 
            element={
              <ProtectedRoute role="doctor">
                <DoctorDashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
