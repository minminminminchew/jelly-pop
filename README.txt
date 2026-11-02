Jelly Pop

English UI. No top header. Scores and controls sit at the bottom.
Colored transparent jelly spheres use real-time transmission, refraction, volume absorption, and elastic deformation.

Move to aim. Click or release to shoot. Match 3 or more of the same color.
Space: swap. Arrow keys: aim. Enter: shoot. P/Escape: pause. R: restart.

Local run after extracting:
python3 -m http.server 4173 --directory dist
Open http://localhost:4173

Three.js 0.180.0 is included. No npm install required.
Tests: node --test tests/physics.test.js
Visual deformation is procedural, not a full soft-body simulation.

Colored caustics: precomputed rays refract through a sphere onto the white receiving surface. The optical footprint deforms with each jelly; this is a real-time approximation, not full scene path tracing.

Sixth bubble type: a clear traditional glass marble with a tapered, twisted blue-and-yellow glass vane. Swirl marbles match other swirl marbles and support swapping, falling and elimination.

Natural-field update: a continuous board with irregular, locally correlated color regions and an uneven lower edge; no preset hanging pods or necks. Shot colors generally favor reachable matches without weighting predicted jackpot size. The previewed next color is preserved while it remains on the board. Detached bubbles fall all the way out. Five consecutive misses advance the board; successful matches reset misses.
Tests: node --test tests/*.test.js
