# Racing Line

An overhead Formula-style racing game in a single HTML page: 8 circuits, 5 teams, AI opponents, DRS, slipstream, track limits, tyre wear, lock-ups, weather and more.

Play: https://matthewtorgerson.github.io/racing-line/

## Multiplayer

Choose **Host multiplayer**, then share the room code, link or QR code. Friends open the link (or choose **Join multiplayer** and type the code).

Players connect to the host's browser directly over WebRTC, using [PeerJS](https://peerjs.com). PeerJS's free public server only introduces the browsers to each other; the race data goes straight between them. Up to 10 cars per race: empty grid slots are filled with AI.

Some networks (often mobile data or strict office/school Wi-Fi) block direct connections. Those need a TURN relay, which this version doesn't include yet.

When the game is opened on claude.ai it uses claude.ai's own room service instead.
