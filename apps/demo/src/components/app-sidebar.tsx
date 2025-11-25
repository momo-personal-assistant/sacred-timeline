'use client';

import { Activity, BeakerIcon, Database, Search } from 'lucide-react';
import * as React from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab: 'query' | 'experiments' | 'activity';
  onTabChange: (tab: 'query' | 'experiments' | 'activity') => void;
}

const navigationItems = [
  {
    title: 'Experiments',
    value: 'experiments' as const,
    icon: BeakerIcon,
  },
  {
    title: 'Query Interface',
    value: 'query' as const,
    icon: Search,
  },
  {
    title: 'Activity',
    value: 'activity' as const,
    icon: Activity,
  },
];

export function AppSidebar({ activeTab, onTabChange, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                <div>
                  <div className="text-base font-semibold">Memory RAG</div>
                  <div className="text-xs text-muted-foreground">Week 2: Embedding & Retrieval</div>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navigationItems.map((item) => (
            <SidebarMenuItem key={item.value}>
              <SidebarMenuButton
                isActive={activeTab === item.value}
                onClick={() => onTabChange(item.value)}
                tooltip={item.title}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
