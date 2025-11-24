'use client';

import { useState } from 'react';

import ActivityFeed from '@/components/ActivityFeed';
import { AppSidebar } from '@/components/app-sidebar';
import ExperimentsPanel from '@/components/ExperimentsPanel';
import QueryPanel from '@/components/QueryPanel';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import ValidationPanel from '@/components/ValidationPanel';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'query' | 'validate' | 'experiments' | 'activity'>(
    'query'
  );

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" activeTab={activeTab} onTabChange={setActiveTab} />
      <SidebarInset>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
            {activeTab === 'query' ? (
              <QueryPanel />
            ) : activeTab === 'validate' ? (
              <ValidationPanel />
            ) : activeTab === 'experiments' ? (
              <ExperimentsPanel />
            ) : (
              <ActivityFeed onNavigateToExperiment={() => setActiveTab('experiments')} />
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
