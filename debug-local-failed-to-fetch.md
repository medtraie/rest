# Debug Session: local-failed-to-fetch
- **Status**: [OPEN]
- **Issue**: Local app shows startup recovery screen with message `Failed to fetch`.

## Hypotheses
| ID | Hypothesis | Evidence to collect |
|----|------------|---------------------|
| A | A debug boot collector in `index.html` posts to `127.0.0.1:7777` on localhost and causes unhandled rejections when debug server is not running | Console shows `Failed to fetch` or `ERR_CONNECTION_REFUSED` from `/event` |
| B | Service Worker / cache is interfering with localhost requests | Application tab shows SW; disabling fixes |
| C | Supabase/network call during bootstrap fails and triggers recovery | Network shows failing requests to Supabase |
| D | Dev server is not actually running or blocked by another process/port | `GET http://localhost:8080/` fails |

## Repro Steps
1. Start dev server
2. Open http://localhost:8080/
3. Observe recovery screen and error

## Evidence
[Pending]

## Conclusion
[Pending]

