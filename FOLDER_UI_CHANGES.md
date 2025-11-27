# Experiment Documentation Folder Categorization - UI Updates

## 📝 Summary

프론트엔드에 실험 문서의 폴더 구분이 이제 표시됩니다! (The frontend now displays folder categorization for experiment documentation!)

## 🎯 Changes Made

### 1. **Added Folder Type to Interface**

- `ExperimentDoc` interface now includes `folder_type` field
- Types: `'completed' | 'plans' | 'rejected' | 'root'`

### 2. **Folder Badge in Experiment Detail View**

- When viewing an experiment that has associated markdown documentation
- A colored badge appears next to the status badge showing the folder type:
  - **Completed** - Green badge (Emerald)
  - **Plan** - Blue badge
  - **Rejected** - Red badge (Rose)
  - **Uncategorized** - Gray badge (shown for 'root' folder items)

### 3. **Folder Statistics Card**

- At the top of the experiment detail view
- Shows overview: "Experiment Documentation: X Completed, Y Plans, Z Rejected"
- Provides context about the entire documentation collection
- Only displayed when an experiment has associated documentation

### 4. **API Integration**

- Frontend now fetches and stores `byFolder` statistics from API
- Statistics show: 3 Completed, 1 Plan, 1 Rejected documents

## 🖼️ Visual Examples

### Header with Folder Badge:

```
[Completed ✓] [Baseline ⭐] [Completed 📄] EXP-006-STAGE-2: Project Metadata Signal
```

### Folder Statistics Card:

```
┌─────────────────────────────────────────────────────────┐
│ 📄 Experiment Documentation:                            │
│ [3 Completed] [1 Plans] [1 Rejected]                   │
└─────────────────────────────────────────────────────────┘
```

## 📂 Current Folder Structure

```
docs/experiments/
├── completed/          # 3 documents
│   ├── EXP-005-project-based-data.md
│   ├── EXP-006-stage-1-results.md
│   └── EXP-006-stage-2-results.md
├── plans/              # 1 document
│   └── EXP-006-multi-signal-fusion-plan.md
├── rejected/           # 1 document
│   └── EXP-004-relation-inference-optimization.md
└── templates/          # 1 template (shown as 'root')
    └── experiment-template.md
```

## ✅ What You Should See Now

1. **Open the demo app** at http://localhost:3001
2. **Click on any experiment** in the sidebar (e.g., "EXP-006-STAGE-2")
3. **Look for the folder badge** next to the "Completed" status badge
4. **Look for the statistics card** at the top showing "3 Completed, 1 Plans, 1 Rejected"

## 🎨 Color Scheme

- **Completed**: `bg-emerald-500/10 text-emerald-700` (Green)
- **Plans**: `bg-blue-500/10 text-blue-700` (Blue)
- **Rejected**: `bg-rose-500/10 text-rose-700` (Red)
- **Uncategorized**: `bg-slate-500/10 text-slate-700` (Gray)

## 🔄 Hot Reload

Changes should be live immediately. If not visible:

1. Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+F5)
2. Check browser console for any errors
3. Verify the API response: `curl http://localhost:3001/api/experiment-docs | jq '.byFolder'`

## 📊 API Response Verification

```bash
curl -s http://localhost:3001/api/experiment-docs | jq '{count: .count, byFolder: .byFolder}'
```

Expected output:

```json
{
  "count": 6,
  "byFolder": {
    "completed": 3,
    "plans": 1,
    "rejected": 1,
    "root": 1
  }
}
```

## 🚀 Future Enhancements (Optional)

If you want even more visibility:

1. Add folder filter buttons to show only completed/plans/rejected docs
2. Create a dedicated "Docs Browser" tab that lists all docs grouped by folder
3. Add folder badges to the sidebar experiment list
4. Add search/filter functionality for experiment docs

## ✨ Files Modified

1. `apps/demo/src/components/ExperimentDocsPanel.tsx`
   - Added `folder_type` to interface
   - Created `folderConfig` for styling
   - Added folder badge in header
   - Added folder statistics card
   - Fetches and stores `byFolder` stats

2. `apps/demo/src/app/page.tsx`
   - Cleaned up unused state

---

**Last Updated**: 2025-11-27
**Status**: ✅ Complete and Live
