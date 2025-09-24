import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../utils/api';

// Async thunk to check the user's session status
export const checkUserStatus = createAsyncThunk(
  'auth/checkUserStatus',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.apiFetch('/api/auth/me');
      if (!res.ok) {
        return rejectWithValue('No active session');
      }
      return res.data.user;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  user: null,
  isAuthenticated: false,
  authStatus: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.authStatus = 'succeeded';
    },
    logoutSuccess: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.authStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkUserStatus.pending, (state) => {
        state.authStatus = 'loading';
      })
      .addCase(checkUserStatus.fulfilled, (state, action) => {
        state.authStatus = 'succeeded';
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(checkUserStatus.rejected, (state) => {
        state.authStatus = 'failed';
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

export const { loginSuccess, logoutSuccess } = authSlice.actions;
export default authSlice.reducer;
