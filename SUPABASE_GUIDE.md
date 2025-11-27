# Supabase + Vercel 배포 가이드

## 📋 준비물

- Supabase 계정
- Vercel 계정
- Linear API Key
- OpenAI API Key

---

## 1️⃣ Supabase 설정 (5분)

### 1.1 프로젝트 생성

1. **https://supabase.com** 접속
2. "New Project" 클릭
3. 입력:
   - **Organization**: 기존 organization 선택 또는 새로 생성
   - **Name**: `unified-memory`
   - **Database Password**: 강력한 비밀번호 생성 ⚠️ **반드시 저장하세요!**
   - **Region**: `Northeast Asia (Seoul)` - 가장 가까운 리전
   - **Pricing Plan**: Free (시작용) 또는 Pro
4. "Create new project" 클릭 (약 2분 소요)

### 1.2 데이터베이스 스키마 생성

1. 프로젝트 대시보드에서 **SQL Editor** 클릭 (왼쪽 메뉴)
2. "New Query" 클릭
3. `supabase-setup.sql` 파일 내용 전체 복사
4. SQL Editor에 붙여넣기
5. "Run" 버튼 클릭 (또는 Cmd/Ctrl + Enter)
6. 성공 메시지 확인:
   ```
   Tables created: 2
   pgvector extension: vector (version 0.x.x)
   ```

### 1.3 Connection String 가져오기

1. **Settings** > **Database** 클릭
2. **Connection string** 섹션에서:
   - **Connection pooling** 탭 선택
   - **Mode**: `Transaction` 선택
   - **URI** 복사 (예: `postgresql://postgres.xxx:[YOUR-PASSWORD]@xxx.pooler.supabase.com:6543/postgres`)
3. `[YOUR-PASSWORD]`를 실제 비밀번호로 교체

---

## 2️⃣ Vercel 배포 (10분)

### 2.1 프로젝트 Import

1. **https://vercel.com** 접속
2. "Add New..." > "Project" 클릭
3. Git repository import:
   - GitHub repository 선택
   - Repository access 권한 부여
4. **Build & Development Settings**:
   - **Framework Preset**: Next.js (자동 감지됨)
   - **Root Directory**: `.` (그대로 두기)
   - ✅ vercel.json이 자동으로 설정을 처리합니다

### 2.2 환경 변수 설정

"Environment Variables" 섹션에서 아래 변수들을 추가하세요:

#### 필수 변수 (PostgreSQL)

```bash
POSTGRES_HOST=xxx.pooler.supabase.com
POSTGRES_PORT=6543
POSTGRES_USER=postgres.xxx
POSTGRES_PASSWORD=당신의_supabase_비밀번호
POSTGRES_DB=postgres
POSTGRES_MAX_CONNECTIONS=20
VECTOR_DIMENSIONS=1536
```

> 💡 **Tip**: Supabase Connection String을 파싱해서 입력하세요:
>
> - `postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DB]`
> - Connection pooling URI 사용 (pooler.supabase.com:6543)

#### 필수 변수 (Application)

```bash
NODE_ENV=production
WORKSPACE=tenxai
```

#### 필수 변수 (OpenAI)

```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

#### 필수 변수 (Linear)

```bash
LINEAR_API_KEY=lin_api_...
LINEAR_TEAM_KEY=TEN
```

#### 선택 변수 (Logging)

```bash
LOG_LEVEL=info
```

### 2.3 배포

1. "Deploy" 버튼 클릭
2. 빌드 로그 확인 (약 2-3분 소요)
3. ✅ 성공 메시지 확인: "Your project has been deployed"
4. 배포 URL 확인: `https://your-project.vercel.app`

---

## 3️⃣ Linear 데이터 동기화 (5분)

배포가 완료되면 Linear 데이터를 프로덕션 DB에 동기화해야 합니다.

### 옵션 A: 로컬에서 프로덕션 DB로 동기화

```bash
# 환경 변수를 프로덕션 Supabase로 설정
export POSTGRES_HOST=xxx.pooler.supabase.com
export POSTGRES_PORT=6543
export POSTGRES_USER=postgres.xxx
export POSTGRES_PASSWORD=당신의_supabase_비밀번호
export POSTGRES_DB=postgres

# Linear 데이터 동기화 (로컬 스크립트가 프로덕션 API 호출)
LINEAR_API_KEY="lin_api_..." \
LINEAR_TEAM_KEY="TEN" \
pnpm tsx scripts/sync-linear-real.ts
```

### 옵션 B: API 엔드포인트 직접 호출

```bash
# Linear issues를 fetch하여 프로덕션 API로 전송
curl -X POST https://your-project.vercel.app/api/momo/sync-linear \
  -H "Content-Type: application/json" \
  -d '{
    "issues": [...]  # Linear API에서 가져온 issues
  }'
```

---

## 4️⃣ 검증 (2분)

### 배포 확인

다음 URL들을 테스트하세요:

1. **홈페이지**

   ```
   https://your-project.vercel.app
   ```

2. **Linear Issues API**

   ```
   https://your-project.vercel.app/api/momo/issues?workspace=tenxai
   ```

   - 예상 결과: Linear issues 목록이 JSON으로 반환

3. **VOC API**

   ```
   https://your-project.vercel.app/api/momo/voc?workspace=sample
   ```

   - 예상 결과: Sample VOC 데이터 또는 빈 배열

4. **Relations API**
   ```
   https://your-project.vercel.app/api/momo/relations?workspace=sample
   ```

### 데이터베이스 확인

Supabase Dashboard > **Table Editor**에서:

- `canonical_objects` 테이블에 데이터가 있는지 확인
- Linear issues가 제대로 들어갔는지 확인

---

## 5️⃣ 팀 멤버 초대

### Vercel 팀 액세스

1. Vercel Dashboard > **Settings** > **Members**
2. "Invite Member" 클릭
3. 이메일 주소 입력
4. Role 선택:
   - **Owner**: 모든 권한
   - **Member**: 배포, 로그 확인 가능
   - **Viewer**: 읽기 전용

### Supabase 팀 액세스

1. Supabase Dashboard > **Settings** > **Team**
2. "Invite" 클릭
3. 이메일 입력 및 role 선택

---

## 🎉 완료!

배포 URL: `https://your-project.vercel.app`

### 다음 단계

- [ ] 팀원들에게 URL 공유
- [ ] 모니터링 설정 (Vercel Analytics, Sentry)
- [ ] Custom domain 설정 (선택사항)
- [ ] 정기적인 Linear 동기화 설정 (Vercel Cron 또는 GitHub Actions)

---

## 🐛 문제 해결

### 빌드 실패

- Vercel Dashboard > Deployments > 실패한 배포 클릭 > Logs 확인
- 환경 변수가 제대로 설정되었는지 확인

### API가 500 에러 반환

- Vercel Dashboard > Functions > Logs 확인
- Supabase connection string이 정확한지 확인
- pgvector extension이 활성화되었는지 확인

### 데이터베이스 연결 실패

- Connection pooling 사용하는지 확인 (pooler.supabase.com:6543)
- Supabase에서 외부 연결을 허용하는지 확인 (기본적으로 허용됨)
- IP whitelist 설정이 없는지 확인

---

## 📚 참고 자료

- [Vercel 문서](https://vercel.com/docs)
- [Supabase 문서](https://supabase.com/docs)
- [pgvector 문서](https://github.com/pgvector/pgvector)
