import type {
	FlowerSpecies,
	FlowerColorName,
	FlowerConfigItem,
	FlowerInstance,
	FoliageLeaf,
	SparkleParticle,
	Butterfly,
	BouquetState
} from './types.js';

export const COLOR_PROFILES: Record<
	FlowerColorName,
	{ base: string; shadow: string; highlight: string; stamen: string }
> = {
	red: {
		base: '#d32f2f',
		shadow: '#550000',
		highlight: '#ff5252',
		stamen: '#ffd600'
	},
	pink: {
		base: '#e91e63',
		shadow: '#6a0033',
		highlight: '#ff80ab',
		stamen: '#fff59d'
	},
	yellow: {
		base: '#fbc02d',
		shadow: '#bf4e00',
		highlight: '#fffde7',
		stamen: '#3e2723'
	},
	orange: {
		base: '#f57c00',
		shadow: '#942600',
		highlight: '#ffcc80',
		stamen: '#212121'
	},
	white: {
		base: '#f5f5f5',
		shadow: '#607d8b',
		highlight: '#ffffff',
		stamen: '#f57f17'
	},
	purple: {
		base: '#8e24aa',
		shadow: '#420b58',
		highlight: '#e1bee7',
		stamen: '#ffea00'
	},
	coral: {
		base: '#ff7043',
		shadow: '#ad2d00',
		highlight: '#ffe0b2',
		stamen: '#fbc02d'
	}
};

const PALETTE_COLORS: Record<string, FlowerColorName[]> = {
	sunset: ['red', 'pink', 'white', 'yellow', 'orange', 'coral', 'purple'],
	'pink-romance': ['pink', 'white', 'coral', 'pink', 'purple'],
	'golden-meadow': ['yellow', 'orange', 'white', 'yellow'],
	'passion-red': ['red', 'coral', 'purple', 'red'],
	'cyber-neon': ['purple', 'pink', 'yellow', 'coral'],
	'vintage-garden': ['coral', 'white', 'pink', 'purple']
};

export function buildFlowerItemsFromCounts(
	counts: {
		lilies: number;
		roses: number;
		tulips: number;
		daisies: number;
		orchids: number;
	},
	palette: string = 'sunset'
): FlowerConfigItem[] {
	const colors = PALETTE_COLORS[palette] || PALETTE_COLORS.sunset;
	const items: FlowerConfigItem[] = [];

	let colorIdx = 0;
	function nextColor(): FlowerColorName {
		const c = colors[colorIdx % colors.length];
		colorIdx++;
		return c;
	}

	const maxCount = Math.max(
		counts.lilies,
		counts.roses,
		counts.tulips,
		counts.daisies,
		counts.orchids
	);

	for (let i = 0; i < maxCount; i++) {
		if (i < counts.lilies) items.push({ type: 'lily', color: nextColor() });
		if (i < counts.roses) items.push({ type: 'rose', color: nextColor() });
		if (i < counts.tulips) items.push({ type: 'tulip', color: nextColor() });
		if (i < counts.daisies) items.push({ type: 'daisy', color: nextColor() });
		if (i < counts.orchids) items.push({ type: 'orchid', color: nextColor() });
	}

	if (items.length === 0) {
		items.push({ type: 'lily', color: 'red' });
	}

	return items;
}

/**
 * 3D vector rotation around Y-axis (turntable) followed by X-axis (camera pitch elevation)
 * Note: In 2D screen/canvas coordinates, +Y points downward. Pitching the camera downward
 * tilts +Z downward (+Y) and tilts -Z upward (-Y) into the upper background.
 */
export function rotatePoint3D(
	p: [number, number, number],
	angleY: number,
	pitchX: number
): [number, number, number] {
	const cosY = Math.cos(angleY);
	const sinY = Math.sin(angleY);
	// Rotate around Y
	const x1 = p[0] * cosY + p[2] * sinY;
	const y1 = p[1];
	const z1 = -p[0] * sinY + p[2] * cosY;

	// Rotate around X (pitch) in screen space (+Y is down)
	const cosX = Math.cos(pitchX);
	const sinX = Math.sin(pitchX);
	const y2 = y1 * cosX + z1 * sinX;
	const z2 = -y1 * sinX + z1 * cosX;

	return [x1, y2, z2];
}

export function createBouquetState(
	width: number,
	height: number,
	options: {
		flowerItems?: FlowerConfigItem[];
		sparklesCount?: number;
		butterfliesCount?: number;
	} = {}
): BouquetState {
	const items =
		options.flowerItems && options.flowerItems.length > 0
			? options.flowerItems
			: [{ type: 'lily' as const, color: 'red' as const }];

	const count = items.length;
	const rootX = width / 2;
	// Raise base of stems from height * 0.90 to 0.78 for proportionate, natural stem lengths
	const rootY = height * 0.78;
	const bouquetCenterY = height * 0.44;

	// Harmonious bouquet ring radii
	const innerRingR = Math.min(width * 0.12, 85);
	const outerRingR = Math.min(width * 0.22, 160);

	// Adaptive density scale factor so small bouquets look lush and large bouquets don't collide
	const baseDensityScale = Math.max(0.52, Math.min(0.88, 1.65 / Math.sqrt(count + 2)));

	const flowers: FlowerInstance[] = [];

	// Pseudo-random deterministic hash for organic height and position variation
	function hash(n: number): number {
		const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
		return s - Math.floor(s);
	}

	// Wrapper rim position is at y = -topH * 0.78 = -117 relative to root.
	// Flower petals have radius ~50-65px, plus pitch tilts the flower head downward by z * sin(pitch) (~30-40px).
	// To guarantee that flower heads and all their petals always stay well above the wrapper rim
	// and never overlap or spill outside the paper cone, the lowest flower center is clamped to:
	// wrapperLimitY = -215.
	const apexY = bouquetCenterY - rootY - 54;
	const wrapperLimitY = Math.min(-215, bouquetCenterY - rootY + 25);
	const maxDrop = Math.max(20, wrapperLimitY - apexY); // Available vertical range

	// Tiered ring distribution with organic randomized stem heights (cradled safely above the wrapper, never taller than apex)
	function getFlowerSlot(idx: number, total: number): { x3D: number; y3D: number; z3D: number; scale: number; tier: number } {
		if (total === 1) {
			return { x3D: 0, y3D: apexY, z3D: 0, scale: 0.95, tier: 2 };
		}

		// Center apex crown flower (index 0 for total >= 5)
		if (total >= 5 && idx === 0) {
			return { x3D: 0, y3D: apexY, z3D: 0, scale: baseDensityScale * 1.08, tier: 2 };
		}

		if (total <= 4) {
			const a = (idx * Math.PI * 2) / total;
			const r = innerRingR * 0.85;
			const hFrac = hash(idx + 1);
			const drop = 12 + hFrac * (maxDrop * 0.75);
			const flowerY = Math.min(wrapperLimitY, apexY + drop);
			return {
				x3D: Math.cos(a) * r,
				y3D: flowerY,
				z3D: Math.sin(a) * r,
				scale: baseDensityScale * (1.05 - hFrac * 0.08),
				tier: 1
			};
		}

		if (total <= 12) {
			const innerCount = total <= 7 ? 3 : 4;
			if (idx <= innerCount) {
				const ringIdx = idx - 1;
				const a = (ringIdx * Math.PI * 2) / innerCount + 0.2;
				const hFrac = hash(idx * 7 + 3);
				const drop = 14 + hFrac * (maxDrop * 0.55);
				const flowerY = Math.min(wrapperLimitY, apexY + drop);
				return {
					x3D: Math.cos(a) * (innerRingR * 0.95),
					y3D: flowerY,
					z3D: Math.sin(a) * (innerRingR * 0.95),
					scale: baseDensityScale * (1.02 - hFrac * 0.06),
					tier: 1
				};
			}

			// Outer ring: remaining flowers with randomized heights cradled safely above the wrapper rim
			const outerCount = total - 1 - innerCount;
			const ringIdx = idx - 1 - innerCount;
			const a = (ringIdx * Math.PI * 2) / outerCount + (Math.PI / outerCount) * 0.5;
			const hFrac = hash(idx * 13 + 5);
			const drop = 22 + hFrac * (maxDrop - 24);
			const flowerY = Math.min(wrapperLimitY, apexY + drop);
			// For flowers closest to the collar, pull radius slightly inward so petals don't spill out sideways
			const radialPull = 0.96 - (hFrac * 0.12);
			return {
				x3D: Math.cos(a) * (outerRingR * radialPull),
				y3D: flowerY,
				z3D: Math.sin(a) * (outerRingR * radialPull),
				scale: baseDensityScale * (0.94 - hFrac * 0.08),
				tier: 0
			};
		}

		// 13+ flowers: 3 concentric tiers
		const c1 = 4;
		const c2 = Math.min(8, Math.floor((total - 1 - c1) * 0.45));
		const c3 = total - 1 - c1 - c2;

		if (idx <= c1) {
			const ringIdx = idx - 1;
			const a = (ringIdx * Math.PI * 2) / c1;
			const hFrac = hash(idx * 11 + 2);
			const drop = 14 + hFrac * (maxDrop * 0.45);
			return {
				x3D: Math.cos(a) * (innerRingR * 0.8),
				y3D: Math.min(wrapperLimitY, apexY + drop),
				z3D: Math.sin(a) * (innerRingR * 0.8),
				scale: baseDensityScale * 1.02,
				tier: 2
			};
		} else if (idx <= c1 + c2) {
			const ringIdx = idx - 1 - c1;
			const a = (ringIdx * Math.PI * 2) / c2 + 0.25;
			const hFrac = hash(idx * 17 + 4);
			const drop = 24 + hFrac * (maxDrop * 0.70);
			return {
				x3D: Math.cos(a) * (outerRingR * 0.68),
				y3D: Math.min(wrapperLimitY, apexY + drop),
				z3D: Math.sin(a) * (outerRingR * 0.68),
				scale: baseDensityScale * 0.96,
				tier: 1
			};
		} else {
			const ringIdx = idx - 1 - c1 - c2;
			const a = (ringIdx * Math.PI * 2) / c3 + 0.5;
			const hFrac = hash(idx * 23 + 7);
			const drop = 32 + hFrac * (maxDrop - 34);
			const radialPull = 0.96 - (hFrac * 0.12);
			return {
				x3D: Math.cos(a) * (outerRingR * 1.02 * radialPull),
				y3D: Math.min(wrapperLimitY, apexY + drop),
				z3D: Math.sin(a) * (outerRingR * 1.02 * radialPull),
				scale: baseDensityScale * 0.90,
				tier: 0
			};
		}
	}

	for (let i = 0; i < count; i++) {
		const item = items[i];
		const slot = getFlowerSlot(i, count);
		const { x3D, y3D, z3D, scale, tier } = slot;

		// 3D Bézier stem control points (world space centered at root base X=0, Z=0)
		const p0_3D: [number, number, number] = [0, 0, 0];
		const midHeight = y3D * (tier === 0 ? 0.45 : 0.58);
		const p1_3D: [number, number, number] = [x3D * 0.20, y3D * 0.20, z3D * 0.20];
		const p2_3D: [number, number, number] = [x3D * 0.82, midHeight, z3D * 0.82];
		const p3_3D: [number, number, number] = [x3D, y3D, z3D];

		// Outward and upward tilted 3D normal vector following the hemispherical dome
		const normDist = Math.hypot(x3D, z3D);
		const tiltAmount = 0.12 + Math.min(0.55, (normDist / outerRingR) * 0.42);
		let normal3D: [number, number, number];
		let tangentU: [number, number, number];
		let tangentV: [number, number, number];

		if (normDist < 1e-4) {
			// Center crown flower (facing upward / toward camera)
			normal3D = [0, -1, 0];
			tangentU = [1, 0, 0];
			tangentV = [0, 0, 1];
		} else {
			const nx = (x3D / normDist) * Math.sin(tiltAmount);
			const ny = -Math.cos(tiltAmount); // pointing upwards
			const nz = (z3D / normDist) * Math.sin(tiltAmount);
			normal3D = [nx, ny, nz];

			const up: [number, number, number] = [0, -1, 0];
			const tx = up[1] * nz - up[2] * ny;
			const ty = up[2] * nx - up[0] * nz;
			const tz = up[0] * ny - up[1] * nx;
			const tLen = Math.hypot(tx, ty, tz);
			if (tLen < 1e-4) {
				tangentU = [1, 0, 0];
				tangentV = [0, 0, 1];
			} else {
				tangentU = [tx / tLen, ty / tLen, tz / tLen];
				const vx = ny * tangentU[2] - nz * tangentU[1];
				const vy = nz * tangentU[0] - nx * tangentU[2];
				const vz = nx * tangentU[1] - ny * tangentU[0];
				const vLen = Math.hypot(vx, vy, vz) || 1;
				tangentV = [vx / vLen, vy / vLen, vz / vLen];
			}
		}

		// 2D fallback positions for default rendering
		const targetX = rootX + x3D;
		const targetY = rootY + y3D;

		const leafCount = tier === 0 ? 2 : 3;
		const leaves: Array<{ t: number; side: 1 | -1; length: number; angle: number }> = [];
		for (let l = 0; l < leafCount; l++) {
			const t = 0.22 + l * 0.26 + Math.sin(i + l) * 0.03;
			const side: 1 | -1 = (l % 2 === 0 ? 1 : -1) * (x3D >= 0 ? 1 : -1) as 1 | -1;
			const length = 36 + Math.cos(i * 2 + l) * 8;
			const angle = side * 0.55 + (x3D / outerRingR) * 0.20;
			leaves.push({ t, side, length, angle });
		}

		const colors = COLOR_PROFILES[item.color] ?? COLOR_PROFILES.red;
		// Snappy, lively bloom: stems emerge immediately, petals burst open into full glory quickly
		const bloomDelay = 0.06 + (2 - tier) * 0.03 + (normDist / outerRingR) * 0.03;
		const bloomDuration = 0.26 + (i % 2) * 0.04;

		flowers.push({
			id: i,
			type: item.type,
			colorName: item.color,
			x: rootX,
			y: rootY,
			targetX,
			targetY,
			stemP0: [rootX, rootY],
			stemP1: [rootX + x3D * 0.20, rootY + y3D * 0.20],
			stemP2: [rootX + x3D * 0.82, rootY + midHeight],
			stemP3: [targetX, targetY],
			stemP0_3D: p0_3D,
			stemP1_3D: p1_3D,
			stemP2_3D: p2_3D,
			stemP3_3D: p3_3D,
			normal3D,
			tangentU,
			tangentV,
			leaves,
			baseColor: colors.base,
			shadowColor: colors.shadow,
			highlightColor: colors.highlight,
			stamenColor: colors.stamen,
			scale,
			tiltAngle: (x3D / outerRingR) * 0.22 + Math.sin(i) * 0.03,
			bloomDelay,
			bloomDuration,
			depth: tier
		});
	}

	// 3D Foliage leaves at the base
	const foliageLeaves: FoliageLeaf[] = [];
	const baseLeafCount = 20;
	for (let f = 0; f < baseLeafCount; f++) {
		const fAngle = (f / baseLeafCount) * Math.PI * 2;
		const fLen = 75 + Math.sin(f * 2.3) * 30;
		const lx = Math.cos(fAngle) * fLen;
		const lz = Math.sin(fAngle) * fLen * 0.7;
		const ly = -fLen * 0.35;

		const leafP0_3D: [number, number, number] = [0, 0, 0];
		const leafP1_3D: [number, number, number] = [lx * 0.38, ly * 0.35, lz * 0.38];
		const leafP2_3D: [number, number, number] = [lx * 0.78, ly * 0.75, lz * 0.78];
		const leafP3_3D: [number, number, number] = [lx, ly, lz];

		foliageLeaves.push({
			p0: [rootX, rootY],
			p1: [rootX + lx * 0.38, rootY + ly * 0.35],
			p2: [rootX + lx * 0.78, rootY + ly * 0.75],
			p3: [rootX + lx, rootY + ly],
			p0_3D: leafP0_3D,
			p1_3D: leafP1_3D,
			p2_3D: leafP2_3D,
			p3_3D: leafP3_3D,
			growthDelay: 0.04 + (f % 5) * 0.02,
			color: f % 2 === 0 ? '#1b5e20' : '#2e7d32'
		});
	}

	// Sparkle particles
	const particleCount = options.sparklesCount ?? 65;
	const particles: SparkleParticle[] = [];
	const sparkleChars = ['*', '·', '+', '✧', '✦', '°', '•'];
	for (let p = 0; p < particleCount; p++) {
		particles.push({
			x: Math.random() * width,
			y: Math.random() * (height * 0.88),
			size: 1 + Math.random() * 2,
			color: Math.random() > 0.4 ? '#fffde7' : '#ffd54f',
			phase: Math.random() * Math.PI * 2,
			twinkleSpeed: 1.6 + Math.random() * 3.2,
			char: sparkleChars[Math.floor(Math.random() * sparkleChars.length)]
		});
	}

	// Butterflies with organic individual flight characteristics
	const bCount = options.butterfliesCount ?? 10;
	const butterflyColors = ['#00e5ff', '#ff4081', '#ffd700', '#76ff03', '#ea80fc', '#ffab40', '#40c4ff'];
	const butterflies: Butterfly[] = [];
	for (let b = 0; b < bCount; b++) {
		// Individual center anchor across the screen
		const baseXFrac = 0.15 + (b / Math.max(1, bCount)) * 0.70 + (hash(b * 3 + 1) - 0.5) * 0.20;
		const baseYFrac = 0.18 + (hash(b * 5 + 2)) * 0.52;
		// Wide, varied wandering radii
		const radiusX = 140 + hash(b * 7 + 3) * 220;
		const radiusY = 70 + hash(b * 9 + 4) * 110;
		// Uncorrelated Lissajous harmonic frequencies for non-repeating wandering paths
		const freqX = 0.35 + hash(b * 11 + 5) * 0.55;
		const freqY = 0.45 + hash(b * 13 + 6) * 0.65;
		const freqZ = 0.25 + hash(b * 17 + 7) * 0.40;
		const phaseX = b * 1.618033 + hash(b * 19);
		const phaseY = b * 2.718281 + hash(b * 23);

		butterflies.push({
			x: width * baseXFrac,
			y: height * baseYFrac,
			scale: 0.75 + hash(b * 29) * 0.45,
			color: butterflyColors[b % butterflyColors.length],
			speed: 0.6 + hash(b * 31) * 0.7,
			pathOffset: b * Math.PI * 0.4,
			wingAngle: 1.0,
			baseXFrac,
			baseYFrac,
			radiusX,
			radiusY,
			freqX,
			freqY,
			freqZ,
			phaseX,
			phaseY
		});
	}

	return {
		flowers,
		foliageLeaves,
		particles,
		butterflies,
		totalBloomProgress: 0
	};
}

export function updateBouquetSimulation(
	state: BouquetState,
	time: number,
	progress: number,
	width: number,
	height: number
) {
	state.totalBloomProgress = 1.0;

	// Organic, multi-frequency random wandering flight paths across the full canvas
	for (let i = 0; i < state.butterflies.length; i++) {
		const b = state.butterflies[i];
		const sp = b.speed;
		const fX = b.freqX ?? 0.5;
		const fY = b.freqY ?? 0.6;
		const fZ = b.freqZ ?? 0.3;
		const rX = b.radiusX ?? 180;
		const rY = b.radiusY ?? 90;
		const pX = b.phaseX ?? i;
		const pY = b.phaseY ?? i * 2;
		const anchorX = width * (b.baseXFrac ?? 0.5);
		const anchorY = height * (b.baseYFrac ?? 0.4);

		// Natural drifting figure-8 / Lissajous wandering trajectory with low-frequency drift
		const wanderDriftX = Math.sin(time * 0.12 * sp + i) * (width * 0.22);
		const wanderDriftY = Math.cos(time * 0.10 * sp + i * 1.5) * (height * 0.15);

		const posX = anchorX + wanderDriftX +
			Math.cos(time * fX * sp + pX) * rX +
			Math.sin(time * 1.4 * fX * sp + pY) * (rX * 0.35);

		const posY = anchorY + wanderDriftY +
			Math.sin(time * fY * sp + pY) * rY +
			Math.cos(time * 0.9 * fZ * sp + pX) * (rY * 0.4) +
			Math.sin(time * 3.8 + i) * 6; // Quick flutters

		// Wrap or clamp smoothly within viewport borders with generous margins
		b.x = ((posX % (width + 120)) + (width + 120)) % (width + 120) - 60;
		b.y = Math.max(25, Math.min(height - 40, posY));

		// Lively wing flapping correlated with movement
		b.wingAngle = Math.abs(Math.cos(time * (14 + (i % 5) * 2) * sp));
	}
}
