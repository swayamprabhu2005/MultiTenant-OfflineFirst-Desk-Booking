import React, { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { ReportIssueModal } from './ReportIssueModal';

export const ReportIssueButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setIsOpen(true)}
          type="button"
          aria-label="Report an Issue to Superadmin"
          className="group flex items-center space-x-2 px-3.5 py-2.5 bg-slate-900/90 hover:bg-slate-950 text-white rounded-full shadow-lg hover:shadow-xl hover:shadow-indigo-950/20 border border-slate-700/60 backdrop-blur-md transition-all duration-200 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <div className="relative flex items-center justify-center">
            <LifeBuoy className="w-4 h-4 text-indigo-400 group-hover:rotate-45 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          </div>

          <span className="text-xs font-bold tracking-tight pr-0.5 hidden sm:inline text-slate-200 group-hover:text-white">
            Report Issue
          </span>
        </button>
      </div>

      <ReportIssueModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
};
