# Audio / Asset Credits (CLAUDE.md §2)

Every asset used by TADAK gets a line here: source, license.

| Asset | Source | License |
|---|---|---|
| Calibration click / debug beat tone | Self-generated (Web Audio `OscillatorNode`, synthesized in code — no file) | N/A (self-generated) |
| Lo-fi kit (kick / snare / hat / rim), M2 Percussion sound pack | Self-generated (Web Audio synthesis in `src/ui/soundPack.ts` — sine/triangle oscillators + deterministic pseudo-noise; no sample files) | N/A (self-generated) |
| Session Tape WAV exports | Rendered from the player's own performance via `OfflineAudioContext` + the synthesized kit above | Player-owned output |
