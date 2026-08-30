import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { OfflineBanner } from './OfflineBanner';
import { ToastContainer } from '../common/Toast';
import { useAuth } from '../../context/AuthContext';
import { fetchApi } from '../../services/api';
import { OnboardingWizard } from '../admin/OnboardingWizard';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />
      <OfflineBanner />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {user?.role !== 'PLATFORM_ADMIN' && <Sidebar />}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};
