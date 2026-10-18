# Synthetic session workspace preview

Run from the repository root:

```sh
node tests/session-lifecycle/preview/server.mjs
```

Open http://localhost:4175. Only localhost port 4175 is used; a busy port fails startup.
The preview imports the real `SessionWorkspace` default export with `{ session, groupId }`
and the real `app/globals.css` through Tailwind PostCSS. That component must exist first.

All eight students are TestStudent1 through TestStudent8. Actions are delayed in-memory
mocks, and Next links/navigation emit local events. Completing a session updates the
fixture props through `synthetic-session-action`. Controls provide a one-shot failure,
save delay (default 900 ms), and reset. The last mock action appears beside the controls.

This is a standalone test harness, never a production route or authentication bypass.
No database, credentials, environment files, or remote writes are used. Browser QA and
screenshots are run separately by main; this script does not start a browser daemon.
