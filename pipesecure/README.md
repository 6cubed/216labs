# PipeSecure

AI-powered continuous security scanning for GitHub repositories. PipeSecure integrates into your GitHub workflow and uses AI agents with Semgrep, ast-grep, and CVE databases to scan every commit for vulnerabilities.

## Features

- **GitHub OAuth** -- sign in with GitHub and connect your repositories
- **Initial Full Scan** -- onboard a repo and get an immediate full security scan
- **Per-Commit Scanning** -- every push triggers an AI-powered scan via GitHub webhooks
- **AI Agent Analysis** -- uses OpenAI with Semgrep MCP and ast-grep MCP for intelligent vulnerability detection
- **CVE Matching** -- parses dependency manifests and checks against the OSV.dev vulnerability database
- **Custom Rules** -- Semgrep rules for SQL injection, XSS, SSRF, path traversal, hardcoded secrets, and auth bypass; ast-grep rules for DOM-based XSS, eval injection, and prototype pollution
- **Dashboard** -- project management, scan history, filterable vulnerability reports with severity ratings

## Tech Stack

- **Frontend/Backend**: Next.js 15 (App Router) + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js v5 with GitHub OAuth
- **Job Queue**: BullMQ + Redis
- **AI**: OpenAI SDK + Model Context Protocol (MCP)
- **Scanning**: Semgrep, ast-grep, OSV.dev API
- **UI**: Tailwind CSS + shadcn/ui
- **Deployment**: Docker Compose

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- A GitHub OAuth App (for user login)
- A GitHub App (for webhooks and repo access)

### Setup

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/Cillian-Collins/pipesecure.git
cd pipesecure
npm install
```

2. Copy the environment file and configure it:

```bash
cp .env.example .env
```

Fill in your GitHub OAuth credentials, GitHub App details, and generate secrets:

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY (64 hex characters)
openssl rand -hex 32
```

3. Start PostgreSQL and Redis:

```bash
docker compose up postgres redis -d
```

4. Run database migrations:

```bash
npm run db:push
```

5. Start the development server and worker:

```bash
# Terminal 1: Next.js app
npm run dev

# Terminal 2: Background worker
npm run worker
```

6. Open http://localhost:3000

### Production Deployment

```bash
docker compose up -d
```

This starts all services: Next.js app, worker, PostgreSQL, and Redis.

## GitHub App Setup

1. Go to **Settings > Developer settings > GitHub Apps > New GitHub App**
2. Set the webhook URL to `https://yourdomain.com/api/github/webhook`
3. Set permissions:
   - Repository contents: Read
   - Metadata: Read
4. Subscribe to events: Push
5. Generate a private key and add it to your `.env`

## Architecture

```
Browser -> Next.js App -> API Routes -> PostgreSQL
                       -> GitHub OAuth (NextAuth.js)

GitHub Push Event -> Webhook Handler -> Redis Queue -> Worker
                                                        |
                                                   AI Agent
                                                   /   |   \
                                            Semgrep  ast-grep  OSV.dev
                                              MCP      MCP      API
                                                   \   |   /
                                                  Findings -> DB
```

## License

MIT
