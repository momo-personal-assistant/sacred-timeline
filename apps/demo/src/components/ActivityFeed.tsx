'use client';

import { useState, useEffect } from 'react';

interface ActivityEvent {
  id: string;
  type:
    | 'paper_added'
    | 'paper_analyzed'
    | 'experiment_created'
    | 'paper_validated'
    | 'paper_rejected';
  timestamp: Date;
  title: string;
  description: string;
  metadata?: {
    paper_id?: string;
    paper_title?: string;
    experiment_id?: number;
    experiment_name?: string;
    f1_before?: number;
    f1_after?: number;
    f1_delta?: number;
    priority?: string;
    tags?: string[];
    expected_f1_gain?: number;
  };
}

function getEventIcon(type: string): string {
  switch (type) {
    case 'paper_added':
      return '🆕';
    case 'paper_analyzed':
      return '📊';
    case 'experiment_created':
      return '🧪';
    case 'paper_validated':
      return '✅';
    case 'paper_rejected':
      return '❌';
    default:
      return '📌';
  }
}

function getEventColor(type: string): string {
  switch (type) {
    case 'paper_added':
      return '#3b82f6'; // blue
    case 'paper_analyzed':
      return '#8b5cf6'; // purple
    case 'experiment_created':
      return '#f59e0b'; // amber
    case 'paper_validated':
      return '#10b981'; // green
    case 'paper_rejected':
      return '#ef4444'; // red
    default:
      return '#6b7280'; // gray
  }
}

function formatTimestamp(timestamp: Date): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupActivitiesByDate(activities: ActivityEvent[]) {
  const groups: { [key: string]: ActivityEvent[] } = {};

  activities.forEach((activity) => {
    const date = new Date(activity.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let groupKey: string;
    if (date.toDateString() === today.toDateString()) {
      groupKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = 'Yesterday';
    } else {
      groupKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(activity);
  });

  return groups;
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchActivities();
  }, [days]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/activity?days=${days}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch activities');
      const data = await response.json();
      setActivities(data.activities);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        Loading activity feed...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: '4px',
          color: '#991b1b',
        }}
      >
        Error: {error}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
        }}
      >
        <p style={{ color: '#6b7280', marginBottom: '0.5rem' }}>No recent activity</p>
        <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
          Add papers and run experiments to see activity here
        </p>
      </div>
    );
  }

  const groupedActivities = groupActivitiesByDate(activities);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Activity Feed
          </h3>
          <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>Recent events and progress updates</p>
        </div>

        {/* Time filter */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: days === d ? '#3b82f6' : 'white',
                color: days === d ? 'white' : '#6b7280',
                border: `1px solid ${days === d ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Activity timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {Object.entries(groupedActivities).map(([dateGroup, events]) => (
          <div key={dateGroup}>
            {/* Date header */}
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: '1rem',
                paddingBottom: '0.5rem',
                borderBottom: '2px solid #e5e7eb',
              }}
            >
              {dateGroup}
            </div>

            {/* Events for this date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {events.map((activity) => (
                <div
                  key={activity.id}
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    padding: '1rem',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = getEventColor(activity.type);
                    e.currentTarget.style.boxShadow = `0 1px 3px rgba(0,0,0,0.1)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      fontSize: '1.5rem',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: `${getEventColor(activity.type)}15`,
                      borderRadius: '8px',
                      flexShrink: 0,
                    }}
                  >
                    {getEventIcon(activity.type)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: '#111827' }}>
                          {activity.title}
                        </div>
                        <div
                          style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.5rem' }}
                        >
                          {activity.description}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {formatTimestamp(activity.timestamp)}
                      </div>
                    </div>

                    {/* Metadata */}
                    {activity.metadata && (
                      <div
                        style={{
                          display: 'flex',
                          gap: '1rem',
                          flexWrap: 'wrap',
                          marginTop: '0.5rem',
                        }}
                      >
                        {activity.metadata.priority && (
                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: '#6b7280' }}>Priority: </span>
                            <span
                              style={{
                                fontWeight: 600,
                                color:
                                  activity.metadata.priority === 'high'
                                    ? '#ef4444'
                                    : activity.metadata.priority === 'medium'
                                      ? '#f59e0b'
                                      : '#6b7280',
                              }}
                            >
                              {activity.metadata.priority.toUpperCase()}
                            </span>
                          </div>
                        )}

                        {activity.metadata.expected_f1_gain !== undefined && (
                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: '#6b7280' }}>Expected: </span>
                            <span style={{ fontWeight: 600, color: '#10b981' }}>
                              +{activity.metadata.expected_f1_gain.toFixed(1)}% F1
                            </span>
                          </div>
                        )}

                        {activity.metadata.f1_after !== undefined && (
                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: '#6b7280' }}>F1: </span>
                            <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                              {(activity.metadata.f1_after * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}

                        {activity.metadata.tags && activity.metadata.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {activity.metadata.tags.slice(0, 3).map((tag: string) => (
                              <span
                                key={tag}
                                style={{
                                  padding: '0.15rem 0.5rem',
                                  backgroundColor: '#f3f4f6',
                                  color: '#6b7280',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Summary footer */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          fontSize: '0.875rem',
          color: '#6b7280',
        }}
      >
        Showing {activities.length} events from the last {days} days
      </div>
    </div>
  );
}
