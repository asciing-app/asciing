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

	// Rotate around X (pitch)
	const cosX = Math.cos(pitchX);
	const sinX = Math.sin(pitchX);
	const y2 = y1 * cosX - z1 * sinX;
	const z2 = y1 * sinX + z1 * cosX;

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

	const flowers: FlowerInstance[] = [];

	// Tiered ring distribution ensuring clear visual separation during 360° rotation
	function getFlowerSlot(idx: number, total: number): { x3D: number; y3D: number; z3D: number; scale: number; tier: number } {
		if (total === 1) {
			return { x3D: 0, y3D: bouquetCenterY - rootY - 45, z3D: 0, scale: 0.95, tier: 2 };
		}
		if (total <= 4) {
			// Small bouquet: gentle ring around center
			const a = (idx * Math.PI * 2) / total;
			const r = innerRingR * 0.85;
			return {
				x3D: Math.cos(a) * r,
				y3D: bouquetCenterY - rootY - 35 + (idx % 2) * 10,
				z3D: Math.sin(a) * r,
				scale: 0.88,
				tier: 1
			};
		}

		// 5 to 12 flowers:
		// Index 0: Center crown flower (highest point)
		if (idx === 0) {
			return { x3D: 0, y3D: bouquetCenterY - rootY - 50, z3D: 0, scale: 0.86, tier: 2 };
		}

		// Inner ring: up to 3 flowers (indices 1, 2, 3)
		const innerCount = Math.min(3, Math.floor((total - 1) * 0.4));
		if (idx <= innerCount) {
			const ringIdx = idx - 1;
			const a = (ringIdx * Math.PI * 2) / innerCount;
			return {
				x3D: Math.cos(a) * innerRingR,
				y3D: bouquetCenterY - rootY - 32,
				z3D: Math.sin(a) * innerRingR,
				scale: 0.80,
				tier: 1
			};
		}

		// Outer ring: remaining flowers
		const outerCount = total - 1 - innerCount;
		const ringIdx = idx - 1 - innerCount;
		const a = (ringIdx * Math.PI * 2) / outerCount + (Math.PI / outerCount) * 0.5;
		return {
			x3D: Math.cos(a) * outerRingR,
			y3D: bouquetCenterY - rootY - 18,
			z3D: Math.sin(a) * outerRingR,
			scale: 0.74,
			tier: 0
		};
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

		// Outward and slightly upward tilted 3D normal vector
		const normDist = Math.hypot(x3D, z3D);
		const tiltAmount = 0.08 + (tier === 0 ? 0.15 : tier === 1 ? 0.08 : 0);
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

	// Butterflies
	const bCount = options.butterfliesCount ?? 2;
	const butterflyColors = ['#00e5ff', '#ff4081', '#ffd700'];
	const butterflies: Butterfly[] = [];
	for (let b = 0; b < bCount; b++) {
		butterflies.push({
			x: rootX + (b === 0 ? -120 : 120),
			y: bouquetCenterY - 60,
			scale: 0.9 + Math.random() * 0.3,
			color: butterflyColors[b % butterflyColors.length],
			speed: 0.7 + b * 0.2,
			pathOffset: b * Math.PI,
			wingAngle: 1.0
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

	// Flight paths flying across the entire screen
	for (let i = 0; i < state.butterflies.length; i++) {
		const b = state.butterflies[i];
		const speed = b.speed * 0.15; // smooth travel speed across viewport
		// Span wider than width so butterflies enter from off-screen and glide across
		const period = (width + 200);
		const rawX = ((time * 85 * speed + b.pathOffset * 100) % period) - 100;
		// Staggered direction: alternate butterflies fly left-to-right vs right-to-left
		b.x = i % 2 === 0 ? rawX : width - rawX;
		
		// Gentle fluttering vertical waves across screen
		const baseY = height * (0.18 + (i % 3) * 0.25);
		const waveY = Math.sin(time * 2.2 + b.pathOffset) * (height * 0.12) + Math.cos(time * 0.8 + i) * (height * 0.06);
		b.y = Math.max(30, Math.min(height - 40, baseY + waveY));

		// Rapid fluttering wings
		b.wingAngle = Math.abs(Math.cos(time * 16 + i));
	}
}
