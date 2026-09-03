import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../common/Toast';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />

      <div className="flex-1 flex w-full max-w-[1600px] mx-auto">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};
