import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from './api';

// Thunk for the Doctor's queue
export const fetchDoctorQueue = createAsyncThunk(
  'dashboard/fetchDoctorQueue',
  async () => {
    const response = await api.apiFetch('/api/queue/doctor');
    return response.data;
  }
);

// Thunk for the Patient's data
export const fetchPatientData = createAsyncThunk(
  'dashboard/fetchPatientData',
  async () => {
    const [appointmentsRes, prescriptionsRes, doctorsRes] = await Promise.all([
      api.apiFetch('/api/appointments'),
      api.apiFetch('/api/prescriptions'),
      api.apiFetch('/api/users?role=doctor')
    ]);
    
    return {
      appointments: appointmentsRes.data || [],
      prescriptions: prescriptionsRes.data || [],
      doctors: doctorsRes.data.users || [],
    };
  }
);

const initialState = {
  queue: [],
  appointments: [],
  prescriptions: [],
  doctors: [],
  loading: false,
  error: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Doctor Queue Logic
      .addCase(fetchDoctorQueue.pending, (state) => { state.loading = true; })
      .addCase(fetchDoctorQueue.fulfilled, (state, action) => {
        state.queue = action.payload;
        state.loading = false;
      })
      .addCase(fetchDoctorQueue.rejected, (state) => { state.loading = false; })
      // Patient Data Logic
      .addCase(fetchPatientData.pending, (state) => { state.loading = true; })
      .addCase(fetchPatientData.fulfilled, (state, action) => {
        state.appointments = action.payload.appointments;
        state.prescriptions = action.payload.prescriptions;
        state.doctors = action.payload.doctors;
        state.loading = false;
      })
      .addCase(fetchPatientData.rejected, (state) => { state.loading = false; });
  },
});

export default dashboardSlice.reducer;
