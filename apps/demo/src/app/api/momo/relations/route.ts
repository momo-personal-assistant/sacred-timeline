import { NextResponse } from 'next/server';

export interface RelationItem {
  id: string;
  from_id: string;
  from_title: string;
  from_platform: string;
  to_id: string;
  to_title: string;
  to_platform: string;
  relation_type: string;
  confidence: number;
}

// VOC -> Issue relations
const MOMO_RELATIONS: RelationItem[] = [
  {
    id: 'rel-001',
    from_id: 'voc-001',
    from_title: 'Gmail 이메일 중복 표시 문제',
    from_platform: 'discord',
    to_id: 'TEN-159',
    to_title: 'Gmail sync UX 개선',
    to_platform: 'linear',
    relation_type: 'triggered_by',
    confidence: 0.95,
  },
  {
    id: 'rel-002',
    from_id: 'voc-003',
    from_title: '메일 작성 CC/BCC 기능 요청',
    from_platform: 'discord',
    to_id: 'TEN-160',
    to_title: 'Gmail UI with cc/bcc',
    to_platform: 'linear',
    relation_type: 'triggered_by',
    confidence: 0.98,
  },
  {
    id: 'rel-003',
    from_id: 'voc-004',
    from_title: '투두-이메일 연결 요청',
    from_platform: 'discord',
    to_id: 'TEN-144',
    to_title: '리마인더 알림 버튼',
    to_platform: 'linear',
    relation_type: 'triggered_by',
    confidence: 0.75,
  },
  {
    id: 'rel-004',
    from_id: 'voc-006',
    from_title: 'www 도메인 로그인 유실',
    from_platform: 'discord',
    to_id: 'TEN-125',
    to_title: 'www 도메인 세션 문제 수정',
    to_platform: 'linear',
    relation_type: 'triggered_by',
    confidence: 0.92,
  },
];

export async function GET() {
  const avgConfidence =
    MOMO_RELATIONS.reduce((acc, r) => acc + r.confidence, 0) / MOMO_RELATIONS.length;

  const byType = MOMO_RELATIONS.reduce(
    (acc, rel) => {
      acc[rel.relation_type] = (acc[rel.relation_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return NextResponse.json({
    items: MOMO_RELATIONS,
    summary: {
      total: MOMO_RELATIONS.length,
      avgConfidence,
      byType,
    },
  });
}
