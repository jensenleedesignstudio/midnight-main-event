# Motion Boxing Arena

A playable 2D boxing arcade: React, TypeScript and Canvas, with local MediaPipe pose recognition and a server-authoritative Socket.IO multiplayer server. All arena art, fighters, effects and audio are procedural.

## Run

**Opened `dist/offline.html` directly?** That export supports keyboard VS AI only. A `file://` page cannot load the pose worker; allowing camera permission does not fix this. Use the commands below and open the localhost URL for motion controls and multiplayer. The standalone page checks this before requesting your camera.

Requires Node.js 22 or newer and npm. From this directory:

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies multiplayer requests to the Node server on port 3001. Both processes start together. To start individually, use `npm run dev:client` and `npm run dev:server` in separate terminals.

Production:

```sh
npm run build
npm start
```

Open **http://localhost:3001**. The Node server serves the production client and Socket.IO together. No environment variables are needed for this same-origin setup. `.env.example` documents the optional port, allowed frontend origins and separate frontend/backend configuration. Vite reads `.env` automatically; export server variables in the shell (e.g. `PORT=3002 npm start`) or load them with your hosting platform.

## Play

Choose **VS AI**, select a difficulty and enter the ring. The arena is shown from your fighter’s perspective, with your gloves in the foreground and the opponent ahead. Your fighter automatically approaches the opponent, while webcam players can lean toward or away from the camera to move forward or back. Each fight is one 90-second round, decided by knockout or remaining health; equal health produces a draw. Hits, damage dealt and session wins are scored. Rematch from the results screen.

The opponent faces the camera and throws punches toward you. On defeat, a ghostly woman lunges onto the screen and screams before the results appear. The scare waits until the tab is visible, can be skipped, and respects the mute control.

| Key | Action | Motion gesture |
| --- | --- | --- |
| J | Left jab | Quickly extend the left arm, then return to guard |
| K | Right cross | Quickly extend the right arm, then return to guard |
| L | Hook | Keyboard only; camera punches use arm straightening |
| Space (hold) | Block | Hold both hands beside the face |
| A / D | Slip left / right | Move the head and shoulders sideways together |
| S | Duck | Drop the head by bending the knees |
| Escape | Pause / resume AI fight | Use the Pause button |

Keyboard inputs remain available as a fallback when motion controls are enabled. Losing window focus pauses AI matches and releases keyboard block. Online matches keep running on focus loss.

After motion calibration, raise both hands beside your head, or extend both fists toward the camera, and hold for 0.6 seconds. Watch the start-progress bar. Hands may stay about shoulder-width apart; closed fists are not required because this tracker measures wrists and arm joints. This starts the AI fight, or readies you in an online room once both players have joined. Clicking **Enter the Ring** also requests native fullscreen immediately. Gesture starts fill the browser with the live camera in the top-right; if the browser requires a click for native fullscreen, click **Enter fullscreen**. **Exit fight view** restores the setup layout. The camera reports each arm's elbow angle or “out of view” to help adjust framing.

Blocks absorb roughly 80% of damage and drain the visible guard meter while held. Releasing guard refills it; an empty meter breaks guard until it recovers. Raising guard in the 12 frames before impact makes a perfect block: the punch deals no damage and the attacker is dazed briefly. Slips avoid jabs and crosses during their active window, while hooks catch slips. Ducks avoid crosses and hooks, while jabs catch ducks. Attacks have startup, active and recovery frames. Defensive moves have recovery cooldowns, so timing matters. Hook windup is slower and its range is shorter. Repeated keydown events are ignored, and action states reject attack spam.

### AI

- **Easy:** long attack delays, predictable jab–jab–cross pattern, slow reactions and rare defense.
- **Medium:** more frequent attacks and combinations, moderate reaction delays, blocks and slips.
- **Hard:** faster decisions, more combinations, responsive defense and attack selection that punishes guard.

AI difficulty changes behavior, not health or damage. Seeded AI decisions and fixed-step combat rules are deterministic.

## Webcam setup

1. Select **Motion controls**. Allow camera permission.
2. Wait for the pose model to load. Face the camera rather than standing sideways. A slight boxing stance is fine, but keep both shoulders, elbows, wrists and hips visible; use good lighting.
3. Raise your hands into a relaxed guard. Calibration starts automatically and takes approximately three seconds (40 confidently tracked samples).
4. Check the labeled body points, confidence, and recognized gestures in the camera panel. Straighten either arm so the shoulder, elbow, and hand line up, then bend it back into guard. To slip, move the head and shoulders sideways together. Drop your head to duck. Lean your body toward the camera to advance or away to retreat. Then start the match.

The mirrored preview labels the head, shoulders, elbows, hands, and hips. Mint marks the left arm, orange the right, and purple the hips. Anatomical left/right are preserved in the mirrored preview. Slips require both the head and shoulder center to move at least 0.25 calibrated shoulder widths in the same direction, with simultaneous movement over two frames. Head movement alone and shoulder movement alone do not slip. Punches trigger when either elbow exceeds 130 degrees; bend below 125 degrees to reset that arm. Retraction is tracked during cooldown too. The joint calculation uses MediaPipe world landmarks when available, with normalized landmarks as fallback. Each arm has its own visibility gate; hidden hips or the other hand no longer disable a visible punch. Ducking uses head height. Recalibrate after changing camera position; webcam depth estimates benefit from good lighting and clear elbow visibility.

Pose inference runs in a dedicated worker at a maximum of roughly 15 FPS with one frame in flight. The game renders with requestAnimationFrame independently. Camera frames stay on the device; only action names, block state, and forward/back movement are sent to the server. MediaPipe SDK and WASM are copied from the installed npm package by `predev` / `prebuild` and served locally. The lite model downloads from Google on first use, so initial motion setup needs internet access. If starting only the client process, first run `npm run setup:vision`. A classic worker is used for compatibility with the SDK’s WASM loader. The app loads Google Fonts with system fallbacks.

Camera permission needs **localhost or HTTPS**. A plain HTTP LAN IP normally supports keyboard play only. Camera/model failures display retry and keyboard fallback guidance. Switch to Keyboard or leave the arena to stop the camera; navigating away also stops tracks and terminates the worker. Tracking loss releases guard and blocks new pose actions until confident landmarks return.

## Two-player multiplayer

1. Start `npm run dev`.
2. Open two browser tabs at http://localhost:5173 (or separate browsers).
3. In each, select **Online** and enter a fighter name.
4. Player 1 selects **Create a room**, then shares the six-character code.
5. Player 2 enters the code and selects **Join**.
6. Choose controls and calibrate if using a webcam. Both players press **READY UP**.
7. After the countdown, each browser controls its own fighter. Both players must ready again for a rematch.

Use keyboard controls when testing two tabs with one physical camera. Two devices can use their own webcams independently. For LAN keyboard testing, open `http://HOST_LAN_IP:5173` on the second device and allow ports 5173/3001 through the host firewall as needed. For internet webcam play, deploy the production Node app behind HTTPS with WebSocket support. A static-only host cannot run the multiplayer server. If frontend/backend are hosted separately, set `VITE_SERVER_URL` at build time and `CLIENT_ORIGIN` on the server.

The server owns the 60 Hz simulation, range checks, damage, cooldowns, clock and winner. Snapshots are sent at 20 Hz. It accepts only whitelisted actions, caps message size, rate-limits events, permits two players per room, and never accepts client-supplied damage or fighter positions. Client input has no prediction; internet latency will be visible.

Transient disconnection pauses the match for up to 20 seconds. The same open tab reconnects using its private in-memory room token. After the grace period the connected fighter wins. Leaving voluntarily forfeits immediately. A page reload intentionally loses its anonymous identity: create a new room. Empty disconnected rooms are cleaned up. Rooms and scores are in memory and reset on server restart; no authentication, database, ranked ladder, spectators or cross-process room scaling is included.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run test:core` compiles and runs deterministic combat, AI and synthetic landmark tests with Node’s built-in runner. `npm run test:network` runs a real ephemeral HTTP/Socket.IO server and multiple clients to verify rooms, readiness, validated combat, capacity, pause/reconnect, rematch and forfeit. Automated landmark tests exercise the detector mathematics; they do not certify real-world camera accuracy.

## Layout

- `shared/combat.ts` — serializable, fixed-step combat rules
- `shared/ai.ts` — seeded difficulty profiles and bot decisions
- `server/index.ts` — Express, room lifecycle and authoritative simulation
- `src/game/` — procedural Canvas renderer and Web Audio effects
- `src/motion/` — calibration and gesture recognition
- `public/pose-worker.js` — classic MediaPipe inference worker
- `src/components/` — arena loop/HUD and camera lifecycle/debug UI
- `src/App.tsx` — setup, controls, lobby, results and socket lifecycle
- `tests/` — combat, gesture and live network tests

## MVP limits

Each match contains one round; the result screen offers rematches. Motion recognition is heuristic, not a trained boxing classifier, and needs physical testing across cameras and body types. There is no client prediction or snapshot interpolation yet. Rooms survive connection interruptions, but not a page reload or server restart. The development environment’s dependency/network and verification results are recorded in `VERIFICATION.md`.

MediaPipe implementation reference: [Google’s Pose Landmarker web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js).
