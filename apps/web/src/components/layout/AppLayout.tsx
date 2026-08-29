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
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const checkOnboardingStatus = async () => {
    if (user?.role === 'ORGANIZATION_ADMIN') {
      try {
        const branches = await fetchApi<any[]>('/branches');
        if (branches.length === 0) {
          setNeedsOnboarding(true);
        } else {
          setNeedsOnboarding(false);
        }
      } catch (err) {
        console.error('Failed to check onboarding status:', err);
      }
    }
  };

  useEffect(() => {
    checkOnboardingStatus();
  }, [user]);

  if (needsOnboarding) {
    return (
      <OnboardingWizard 
        onComplete={() => {
          setNeedsOnboarding(false);
          // Refresh routing / layout state
          window.location.reload();
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />
      <OfflineBanner />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};
