# CampusArena

Campus sports management with player profiles, team join requests, tournament lineups, and live referee scoring.

## Stack

- React 18, Vite, Socket.IO client, Manrope, and Hugeicons
- Node.js, Express, MongoDB, Redis, and Socket.IO
- Shared lineup rules in `shared/sportLineups.json`

## Run locally

Use Node.js 20.19+, 22.13+, or 24+. Start MongoDB and Redis first.

1. Install dependencies from the project root:

   ```bash
   npm install
   npm --prefix backend install
   npm --prefix frontend install
   ```

2. Copy `backend/.env.example` to `backend/.env`. Set a private `JWT_SECRET` and confirm your database settings:

   ```env
   PORT=5001
   MONGODB_URI=mongodb://localhost:27017
   DB_NAME=campusarena
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=replace-with-a-long-random-secret
   ```

3. Start the servers in separate terminals:

   ```bash
   npm run dev:backend
   ```

   ```bash
   npm run dev:frontend
   ```

Open [localhost:5173](http://localhost:5173). Backend health is available at [localhost:5001/api/health](http://localhost:5001/api/health).

Vite proxies `/api` and `/socket.io` to port 5001. `VITE_API_URL` and `VITE_SOCKET_URL` can override the defaults. Production hosting needs equivalent routing and WebSocket support.

## Project commands

| Command                   | Purpose                                                                           |
| ------------------------- | --------------------------------------------------------------------------------- |
| `npm run lint`            | Check frontend and backend for undefined names, unused code, and unreachable code |
| `npm run format`          | Format maintained project files                                                   |
| `npm run format:check`    | Check formatting                                                                  |
| `npm run build`           | Build the frontend into `frontend/dist`                                           |
| `npm run seed:demo`       | Create or refine fictional demo data                                              |
| `npm run bootstrap:admin` | Create or promote the first admin                                                 |

Environment files, installed dependencies, build output, and local database backups are excluded from Git.

## Accounts and permissions

Registration creates a player account. Complete a player profile with a username, name, and interested sports. Player records are linked to accounts by normalized email and user ID.

- **Players:** create teams, request membership, and submit tournament lineups as team leaders.
- **Referees:** participate through their player profile and manage live scores/events for their assigned matches.
- **Event managers:** manage competition data and referee assignments.
- **Admins:** create tournaments, schedule matches, assign referees, and manage account roles.

Login sessions survive reloads until logout or JWT expiry (seven days). Light/dark preferences are saved locally.

### First admin

Temporarily set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in `backend/.env`, then run `npm run bootstrap:admin`. The password must contain at least 12 characters. Remove the bootstrap password afterward. Existing accounts are promoted without changing their password.

Never use the example JWT value or development fallback for a deployed app.

## Fictional demo data

`npm run seed:demo` creates/refines 26 teams across 13 named sports, 210 players, captains, default rosters, competitions, and opening fixtures. The database may contain additional user-created records. Team sports have enough starters and substitutes; individual sports use four-person training squads.

- Demo player: `demo.player2@campusarena.example`
- Demo referee: `demo.referee@campusarena.example`
- Demo event manager: `demo.manager@campusarena.example`
- Default demo password: `CampusDemo@2026`

`DEMO_PASSWORD` overrides the password for newly created demo accounts. Existing passwords are preserved. These are fictional local development accounts, not production credentials.

Stable seed keys prevent duplicates. The seeder preserves personal accounts, user-created records, existing results, and memberships added in the app. Before modifying demo records it saves a JSON snapshot under `backend/.demo-backups/`. The old `backend/src/scripts/seed-demo.js` entry point forwards to the maintained seeder.

## Live match flow

1. An admin or event manager assigns a referee to a scheduled match.
2. The referee opens **Home → Assigned matches** and selects the fixture.
3. Start the match, publish scores, or record team/player fouls and cards. Player lookup accepts a username or full player ID.
4. Viewers open **Match Centre** to receive updates for the selected match.
5. Finishing a match confirms and locks the final result.

Socket.IO authenticates with the JWT in `auth.token`. Every score and foul update is written to MongoDB and cached in Redis, then broadcast to the match room. The referee interface waits for a server acknowledgement. Completed/cancelled matches reject further updates.

```js
socket.emit('join-match', matchId);
socket.emit('match-update', {
  matchId,
  score: { teamA: 2, teamB: 1 },
  status: 'live'
});
```

## API entry points

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/teams`, `GET /api/players`, `GET /api/tournaments`
- `POST /api/teams/mine`, `POST /api/teams/:id/join-request`
- `POST /api/tournaments/:id/players/register`
- `GET /api/matches`, `POST /api/matches`, `PATCH /api/matches/:id/referee`

Authenticated requests use `Authorization: Bearer <token>`. Match queries support `tournamentId` and `status` filters.

See [DESIGN.md](DESIGN.md) for UI conventions and stylesheet responsibilities.
