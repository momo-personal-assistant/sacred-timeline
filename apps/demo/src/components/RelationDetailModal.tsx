'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RelationDetail {
  from_id: string;
  from_title: string;
  from_platform: string;
  to_id: string;
  to_title: string;
  to_platform: string;
  confidence: number;
}

interface RelationDetailModalProps {
  relation: RelationDetail | null;
  workspace: string;
  onClose: () => void;
}

interface ObjectDetail {
  id: string;
  title: string;
  body: string;
  platform: string;
  object_type: string;
  timestamps?: {
    created_at: string;
    updated_at: string;
  };
}

export default function RelationDetailModal({
  relation,
  workspace,
  onClose,
}: RelationDetailModalProps) {
  const [issueDetail, setIssueDetail] = useState<ObjectDetail | null>(null);
  const [feedbackDetail, setFeedbackDetail] = useState<ObjectDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!relation) return;

    const fetchDetails = async () => {
      setLoading(true);
      try {
        // Fetch full issue and feedback details from DB
        const issueRes = await fetch(`/api/momo/object/${relation.from_id}?workspace=${workspace}`);
        const feedbackRes = await fetch(
          `/api/momo/object/${relation.to_id}?workspace=${workspace}`
        );

        if (issueRes.ok && feedbackRes.ok) {
          const issue = await issueRes.json();
          const feedback = await feedbackRes.json();
          setIssueDetail(issue);
          setFeedbackDetail(feedback);
        }
      } catch (error) {
        console.error('Failed to fetch relation details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [relation, workspace]);

  if (!relation) return null;

  const confidenceColor =
    relation.confidence >= 0.7
      ? 'text-green-600'
      : relation.confidence >= 0.5
        ? 'text-yellow-600'
        : 'text-orange-600';

  return (
    <Dialog open={!!relation} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Relation Details</span>
            <Badge variant="outline" className={`text-lg font-mono ${confidenceColor}`}>
              {(relation.confidence * 100).toFixed(0)}% Match
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Comparing Issue ({relation.from_id}) with Feedback ({relation.to_id})
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-muted-foreground">Loading details...</p>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
            {/* Issue Column */}
            <div className="flex flex-col border rounded-lg overflow-hidden">
              <div className="bg-purple-50 dark:bg-purple-950 p-3 border-b">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="bg-purple-100 text-purple-800">
                    Issue (Linear)
                  </Badge>
                  <span className="font-mono text-xs text-purple-600">{relation.from_id}</span>
                </div>
                <h3 className="font-semibold text-sm">{relation.from_title}</h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                {issueDetail ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                        DESCRIPTION
                      </h4>
                      <p className="text-sm whitespace-pre-wrap">
                        {issueDetail.body || 'No description'}
                      </p>
                    </div>
                    {issueDetail.timestamps?.created_at && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">
                          CREATED
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {new Date(issueDetail.timestamps.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No details available</p>
                )}
              </ScrollArea>
            </div>

            {/* Feedback Column */}
            <div className="flex flex-col border rounded-lg overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-950 p-3 border-b">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="bg-gray-100 text-gray-800">
                    Feedback (Notion)
                  </Badge>
                  <span className="font-mono text-xs text-gray-600">{relation.to_id}</span>
                </div>
                <h3 className="font-semibold text-sm">{relation.to_title}</h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                {feedbackDetail ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                        DESCRIPTION
                      </h4>
                      <p className="text-sm whitespace-pre-wrap">
                        {feedbackDetail.body || 'No description'}
                      </p>
                    </div>
                    {feedbackDetail.timestamps?.created_at && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">
                          CREATED
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {new Date(feedbackDetail.timestamps.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No details available</p>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        <div className="border-t pt-4 flex justify-end">
          <Button onClick={onClose} variant="outline">
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
