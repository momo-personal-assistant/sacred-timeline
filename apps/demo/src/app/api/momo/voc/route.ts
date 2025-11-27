import { NextResponse } from 'next/server';

export interface VOCItem {
  id: string;
  platform: 'discord' | 'linear' | 'notion';
  object_type: string;
  title: string;
  body: string;
  actor: string;
  timestamp: string;
  status?: string;
  linkedIssue?: string;
}

// Discord VOC data
const MOMO_VOC_DATA: VOCItem[] = [
  {
    id: 'voc-001',
    platform: 'discord',
    object_type: 'voc',
    title: 'Gmail 이메일 중복 표시 문제',
    body: '회사 메일 스레드 중에, 지메일로 이메일을 보내면, 보내면서 동시에 메일 받는사람에 나도 들어가있어서, 내가 보낸 메일이 2번 보여요',
    actor: 'alberttri23@gmail.com',
    timestamp: '2024-11-14',
    status: 'resolved',
    linkedIssue: 'TEN-159',
  },
  {
    id: 'voc-002',
    platform: 'discord',
    object_type: 'voc',
    title: '카드 추가 요청',
    body: '결제 수단에 카드 추가 가능할까요?',
    actor: 'alberttri23@gmail.com',
    timestamp: '2024-11-14',
    status: 'pending',
  },
  {
    id: 'voc-003',
    platform: 'discord',
    object_type: 'voc',
    title: '메일 작성 CC/BCC 기능 요청',
    body: '메일 작성할때 cc/bcc 넣는거 추가 가능할까요?',
    actor: 'alberttri23@gmail.com',
    timestamp: '2024-11-14',
    status: 'resolved',
    linkedIssue: 'TEN-160',
  },
  {
    id: 'voc-004',
    platform: 'discord',
    object_type: 'voc',
    title: '투두-이메일 연결 요청',
    body: '투두 추가하면 관련 이메일도 보이면 좋겠음',
    actor: 'alberttri23@gmail.com',
    timestamp: '2024-11-14',
    status: 'resolved',
    linkedIssue: 'TEN-144',
  },
  {
    id: 'voc-005',
    platform: 'discord',
    object_type: 'voc',
    title: '슬랙 연결 가능 여부',
    body: '슬랙도 연결 가능할까요?',
    actor: 'alberttri23@gmail.com',
    timestamp: '2024-11-14',
    status: 'backlog',
  },
  {
    id: 'voc-006',
    platform: 'discord',
    object_type: 'voc',
    title: 'www 도메인 로그인 유실',
    body: '웹에서 www.ten.im 으로 접속하면 로그인 정보가 유실되는 문제 (ten.im 에서만 유지)',
    actor: 'alberttri23@gmail.com',
    timestamp: '2024-11-14',
    status: 'resolved',
    linkedIssue: 'TEN-125',
  },
];

export async function GET() {
  const resolvedCount = MOMO_VOC_DATA.filter((v) => v.status === 'resolved').length;
  const pendingCount = MOMO_VOC_DATA.filter((v) => v.status === 'pending').length;
  const backlogCount = MOMO_VOC_DATA.filter((v) => v.status === 'backlog').length;

  return NextResponse.json({
    items: MOMO_VOC_DATA,
    summary: {
      total: MOMO_VOC_DATA.length,
      resolved: resolvedCount,
      pending: pendingCount,
      backlog: backlogCount,
      linkedCount: MOMO_VOC_DATA.filter((v) => v.linkedIssue).length,
    },
  });
}
