# DevOS Patch Agent

The autonomous developer and maintainer of existing DevOS agents. Pippin receives surgical assignments from Celebrimbor (App Generator Agent) — bug fixes, feature additions, and updates on *existing* agent codebases. He clones the target repository, plans the change through the Bridge Agent, implements only what was assigned, and opens a Pull Request. He never pushes directly to `main`.

---

## Responsibilities

- **Assignment-Gated Execution** — takes no action without a valid assignment payload from Celebrimbor
- **Surgical Changes Only** — touches only the files required to fulfill the assignment; no refactoring beyond scope
- **Spec-First Analysis** — sends existing code and assignment spec to Bridge Agent for a change plan before writing a line
- **Pull Request Only** — all changes delivered via PR; direct pushes to `main` are forbidden
- **Traceability in Every Commit** — every commit message references the `PATCH-XXX` assignment ID

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (ESM) |
| Language | TypeScript (strict mode) |
| Framework | Express |
| Database | SQLite via `better-sqlite3` |
| Validation | Zod |
| Logging | Winston (structured JSON) |
| Security | Helmet, CORS, API token auth |
| VCS | Git (CLI) + GitHub REST API |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3014
NODE_ENV=development
DATABASE_PATH=./data/patch-agent.db
API_TOKEN=your-secure-api-token-here
LOG_LEVEL=info
BRIDGE_AGENT_URL=http://localhost:3005
BRIDGE_API_SUBSCRIPTION_KEY=your-bridge-subscription-key-here
APP_GENERATOR_AGENT_URL=http://localhost:3003
GITHUB_TOKEN=your-github-personal-access-token-here
WORKSPACE_PATH=./workspace
```

> `GITHUB_TOKEN` requires `repo` scope — used to create branches, push commits, and open PRs.

### 3. Run in development

```bash
npm run dev
```

### 4. Build and run in production

```bash
npm run build
npm start
```

---

## API Reference

All routes except `/health` require the `x-api-token` header.

### Health

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Shallow check — confirms the process is alive |
| GET | `/health?deep=true` | Deep check — SQLite + Bridge Agent connectivity |

**Shallow response:**
```json
{
  "status": "UP",
  "timestamp": "2026-06-14T10:00:00.000Z",
  "version": "1.0.0",
  "uptime_seconds": 42.3,
  "character": "Pippin",
  "persona_message": "I've got my assignment and the workspace is ready. Tell me what needs fixing and I'll have a PR open before supper."
}
```

---

### Patch Assignments

| Method | Route | Description |
|---|---|---|
| POST | `/api/v1/patch` | Accept a patch assignment from Celebrimbor |
| GET | `/api/v1/patches` | List all patch assignments and their statuses |
| GET | `/api/v1/patches/:patch_id` | Get status and result for a specific patch |
| POST | `/api/v1/patches/:patch_id/retry` | Retry a failed patch assignment |
| DELETE | `/api/v1/patches/:patch_id/workspace` | Clean up local workspace for a completed patch |

**Assignment request (from Celebrimbor):**
```json
{
  "patch_id": "PATCH-007",
  "target_agent": {
    "name": "backend-agent",
    "character": "Gimli",
    "github_repo": "cenon4dno/DevOS-backend-ai",
    "local_path": "./workspace/DevOS-backend-ai"
  },
  "assignment": {
    "type": "bug_fix | feature | update",
    "title": "Return 404 when user is not found",
    "description": "GET /api/v1/users/:id currently returns 500 when the user does not exist. It should return 404.",
    "acceptance_criteria": [
      "Given a missing user ID when GET /api/v1/users/:id is called then 404 is returned",
      "All existing tests continue to pass"
    ],
    "affected_files_hint": ["src/services/userService.ts"],
    "spec": {
      "functional": "[TAG: FUNCTIONAL] ...",
      "tech_spec": "[TAG: TECH-SPEC] ..."
    }
  },
  "context": {
    "reported_by": "Celebrimbor",
    "priority": "high",
    "related_patch_ids": []
  }
}
```

**Completion result:**
```json
{
  "patch_id": "PATCH-007",
  "status": "completed",
  "pull_request": {
    "url": "https://github.com/cenon4dno/DevOS-backend-ai/pull/42",
    "number": 42,
    "branch": "patch/PATCH-007-fix-user-404-response"
  },
  "changes": {
    "files_modified": ["src/services/userService.ts"],
    "lines_added": 18,
    "lines_removed": 4
  },
  "test_result": {
    "passed": true,
    "total": 42,
    "output_summary": "42 tests passed in 3.2s"
  },
  "completed_at": "ISO-8601"
}
```

---

## Execution Workflow

```
1. RECEIVE    → Accept assignment payload from Celebrimbor; validate with Zod
2. CLONE      → Clone or pull the target agent's GitHub repository to workspace
3. BRANCH     → Create feature branch: patch/<PATCH-XXX>-<kebab-slug>
4. ANALYZE    → Send existing relevant files + assignment spec to Bridge Agent for a change plan
5. IMPLEMENT  → Apply the change plan — edit files, add/remove code, update tests
6. VERIFY     → Run available test suite (npm test / vitest) — all existing tests must stay green
7. COMMIT     → Stage changed files; commit: "patch(PATCH-XXX): <short description>"
8. PUSH       → Push the feature branch to the remote repository
9. PR         → Create a Pull Request via GitHub API
10. REPORT    → Return PR URL, file change summary, and test results to Celebrimbor
```

---

## Assignment Types

| Type | Description |
|------|-------------|
| `bug_fix` | Diagnose and resolve a specific defect. Acceptance criteria must include the failing scenario and expected behaviour after fix. |
| `feature` | Implement a new capability. Acceptance criteria must list all new endpoints, behaviours, or data changes. |
| `update` | Apply a targeted update — dependency bump, configuration change, or minor enhancement. |

---

## Project Structure

```
src/
├── controllers/
│   ├── patchController.ts         # Assignment ingestion and status endpoints
│   └── healthController.ts
├── services/
│   ├── gitService.ts              # Clone, branch, commit, push
│   ├── changePlanService.ts       # Change plan request to Bridge Agent
│   ├── implementationService.ts   # File-by-file implementation via Bridge Agent
│   ├── testRunnerService.ts       # npm test / vitest execution
│   ├── githubService.ts           # PR creation via GitHub REST API
│   └── reportService.ts           # Result reporting to Celebrimbor
├── repositories/
│   └── patchRepository.ts
├── routes/
│   ├── patchRoutes.ts
│   └── healthRoutes.ts
├── schemas/
│   └── patchSchema.ts             # Zod schema for assignment payload
├── middleware/
├── database/
│   └── sqlite.ts
├── types/
│   └── index.ts
├── utils/
│   └── logger.ts
├── workspace/                     # Isolated per-patch working directories
└── index.ts
```

---

## SQLite Schema

```sql
CREATE TABLE patches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patch_id      TEXT UNIQUE NOT NULL,
  target_agent  TEXT NOT NULL,
  github_repo   TEXT NOT NULL,
  type          TEXT NOT NULL CHECK(type IN ('bug_fix', 'feature', 'update')),
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending', 'analyzing', 'implementing', 'testing',
                                 'pr_created', 'completed', 'failed', 'clarification_required')),
  branch_name   TEXT,
  pr_url        TEXT,
  pr_number     INTEGER,
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE patch_files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patch_id      TEXT NOT NULL REFERENCES patches(patch_id),
  file_path     TEXT NOT NULL,
  action        TEXT NOT NULL CHECK(action IN ('modified', 'added', 'deleted')),
  lines_added   INTEGER DEFAULT 0,
  lines_removed INTEGER DEFAULT 0
);
```

---

## Error Codes

| Code | Trigger |
|------|---------|
| `PATCH_MISSING_INFO` | Assignment description or acceptance criteria too vague to produce a change plan |
| `PATCH_REPO_UNREACHABLE` | Target GitHub repository cannot be cloned or pulled |
| `PATCH_BRIDGE_UNAVAILABLE` | Bridge Agent is offline or returns an error |
| `PATCH_TEST_FAILURE` | Existing tests fail after applying the change — PR is not created |
| `PATCH_GITHUB_ERROR` | GitHub API call fails (auth error, rate limit, PR creation failure) |
| `PATCH_SCOPE_VIOLATION` | Change plan touches files outside the declared `affected_files_hint` |
| `PATCH_WORKSPACE_CONFLICT` | Workspace directory for this `patch_id` already exists in a non-clean state |

---

## Baseline Compliance

This agent adheres to the following DevOS baseline specifications:

- **[ai-agent-baseline.md]** — SDD traceability headers on every file, structured Winston logging at all four levels (DEBUG/INFO/WARN/ERROR), `GET /health` mandate, no hardcoded environment variables
- **[nodejs-baseline.md]** — ESM modules, strict TypeScript (no `any`), Controller→Service→Repository layered architecture, Zod payload validation, Helmet/CORS security defaults, global error middleware
