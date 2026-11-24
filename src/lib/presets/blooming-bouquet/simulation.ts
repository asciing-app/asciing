import type {
	FlowerSpecies,
	FlowerColorName,
	FlowerConfigItem,
	FlowerInstance,
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
 * Procedural layout slot generator for varied stem lengths and multi-tiered flower positioning
 */
interface StemSlot {
	normX: number;     // -1 (left) to 1 (right)
	tierY: number;     // 0 (front low short stem), 1 (mid tier), 2 (tall back stem)
	spreadOffset: number;
	tilt: number;
	depth: number;     // Depth for sorting (2 = background drawn first, 0 = foreground drawn on top)
}

function getTieredStemSlots(count: number): StemSlot[] {
	// Predefined organic bouquet arrangement slots to ensure full, gapless volume
	const slots: StemSlot[] = [
		// 1. Center crown (tall rear stem)
		{ normX: 0.0, tierY: 2, spreadOffset: 0, tilt: 0, depth: 2 },
		// 2. Lower center (short front stem right above foliage)
		{ normX: -0.05, tierY: 0, spreadOffset: 0.2, tilt: -0.05, depth: 0 },
		// 3. Mid left (medium stem)
		{ normX: -0.45, tierY: 1, spreadOffset: 0.6, tilt: -0.22, depth: 1 },
		// 4. Mid right (medium stem)
		{ normX: 0.45, tierY: 1, spreadOffset: 0.6, tilt: 0.22, depth: 1 },
		// 5. High upper left (tall stem)
		{ normX: -0.32, tierY: 2, spreadOffset: 0.45, tilt: -0.15, depth: 2 },
		// 6. High upper right (tall stem)
		{ normX: 0.32, tierY: 2, spreadOffset: 0.45, tilt: 0.15, depth: 2 },
		// 7. Low left flank (short stem)
		{ normX: -0.72, tierY: 0, spreadOffset: 0.85, tilt: -0.38, depth: 0 },
		// 8. Low right flank (short stem)
		{ normX: 0.72, tierY: 0, spreadOffset: 0.85, tilt: 0.38, depth: 0 },
		// 9. Mid center-left (medium stem)
		{ normX: -0.2, tierY: 1, spreadOffset: 0.3, tilt: -0.08, depth: 1 },
		// 10. Mid center-right (medium stem)
		{ normX: 0.2, tierY: 1, spreadOffset: 0.3, tilt: 0.08, depth: 1 },
		// 11. Far left wing (medium-low stem)
		{ normX: -0.88, tierY: 1, spreadOffset: 0.95, tilt: -0.45, depth: 1 },
		// 12. Far right wing (medium-low stem)
		{ normX: 0.88, tierY: 1, spreadOffset: 0.95, tilt: 0.45, depth: 1 }
	];

	return slots.slice(0, count);
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
	const items = options.flowerItems && options.flowerItems.length > 0
		? options.flowerItems
		: [{ type: 'lily' as const, color: 'red' as const }];

	const count = items.length;
	const rootX = width / 2;
	const rootY = height * 0.90; // Base where stems bunch together

	// Base center height for the bouquet dome
	const bouquetCenterY = height * 0.48;
	const maxSpreadW = Math.min(width * 0.46, 310);

	const slots = getTieredStemSlots(count);
	const flowers: FlowerInstance[] = [];

	for (let i = 0; i < count; i++) {
		const item = items[i];
		const slot = slots[i % slots.length];

		// Calculate varied target Y based on tier:
		// Tier 0 (short front stem): Y is lower (+55px to +75px)
		// Tier 1 (mid stem): Y is middle (-10px to +20px)
		// Tier 2 (tall back stem): Y is high (-65px to -90px)
		let tierYOffset = 0;
		if (slot.tierY === 0) {
			tierYOffset = 65; // Short stem, sits right above base leaves
		} else if (slot.tierY === 1) {
			tierYOffset = 5;  // Mid stem
		} else {
			tierYOffset = -75; // Tall stem, crowns the bouquet
		}

		const spreadX = slot.normX * maxSpreadW;
		const targetX = rootX + spreadX;
		const targetY = bouquetCenterY + tierYOffset + (Math.sin(i * 2.8) * 10);

		// Natural curve control points with varied curvature per tier
		const stemHeight = rootY - targetY;
		const midY = rootY - stemHeight * (slot.tierY === 0 ? 0.45 : 0.58);
		const curveBend = spreadX * 0.58;

		const p0: [number, number] = [rootX, rootY];
		const p1: [number, number] = [rootX + curveBend * 0.35, rootY - stemHeight * 0.2];
		const p2: [number, number] = [targetX - curveBend * 0.1, midY];
		const p3: [number, number] = [targetX, targetY];

		// Leaves along stem - short stems have 2 leaves, tall stems have 3 leaves
		const leafCount = slot.tierY === 0 ? 2 : 3;
		const leaves: Array<{ t: number; side: 1 | -1; length: number; angle: number }> = [];
		for (let l = 0; l < leafCount; l++) {
			const t = 0.22 + l * 0.26 + (Math.sin(i + l) * 0.03);
			const side: 1 | -1 = (l % 2 === 0 ? 1 : -1) * (spreadX >= 0 ? 1 : -1) as 1 | -1;
			const length = 42 + Math.cos(i * 2 + l) * 12;
			const angle = (side * 0.55) + (spreadX / maxSpreadW) * 0.25;
			leaves.push({ t, side, length, angle });
		}

		const colors = COLOR_PROFILES[item.color] ?? COLOR_PROFILES.red;
		// Staggered bloom: short front stems bloom first, tall back stems follow
		const bloomDelay = 0.22 + (2 - slot.tierY) * 0.08 + Math.abs(slot.normX) * 0.08;
		const bloomDuration = 0.42 + (i % 2) * 0.05;

		flowers.push({
			id: i,
			type: item.type,
			colorName: item.color,
			x: rootX,
			y: rootY,
			targetX,
			targetY,
			stemP0: p0,
			stemP1: p1,
			stemP2: p2,
			stemP3: p3,
			leaves,
			baseColor: colors.base,
			shadowColor: colors.shadow,
			highlightColor: colors.highlight,
			stamenColor: colors.stamen,
			scale: slot.tierY === 0 ? 0.92 : slot.tierY === 1 ? 0.98 : 1.04,
			tiltAngle: slot.tilt + Math.sin(i) * 0.05,
			bloomDelay,
			bloomDuration,
			depth: slot.depth
		});
	}

	// Sort flowers so Tier 2 (depth 2, background) renders first, Tier 0 (foreground) renders on top
	flowers.sort((a, b) => b.depth - a.depth);

	// Dense base foliage leaves hugging the base
	const foliageLeaves = [];
	const baseLeafCount = 20;
	for (let f = 0; f < baseLeafCount; f++) {
		const fNorm = (f / (baseLeafCount - 1)) * 2 - 1;
		const fAngle = fNorm * 1.15;
		const fLen = 75 + Math.sin(f * 2.3) * 30;
		const leafP0: [number, number] = [rootX + (Math.sin(f) * 22), rootY - 6];
		const leafP1: [number, number] = [rootX + Math.sin(fAngle) * (fLen * 0.38), rootY - (fLen * 0.32)];
		const leafP2: [number, number] = [rootX + Math.sin(fAngle) * (fLen * 0.78), rootY - (fLen * 0.72)];
		const leafP3: [number, number] = [rootX + Math.sin(fAngle) * fLen, rootY - (fLen * 0.94)];

		foliageLeaves.push({
			p0: leafP0,
			p1: leafP1,
			p2: leafP2,
			p3: leafP3,
			growthDelay: 0.04 + Math.abs(fNorm) * 0.08,
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
	state.totalBloomProgress = progress;

	const rootX = width / 2;
	const topY = height * 0.42;
	const radX = Math.min(width * 0.4, 240);
	const radY = Math.min(height * 0.2, 110);

	for (let i = 0; i < state.butterflies.length; i++) {
		const b = state.butterflies[i];
		const t = time * b.speed + b.pathOffset;
		b.x = rootX + Math.sin(t) * radX;
		b.y = topY + Math.sin(t * 2) * radY * 0.55;
		b.wingAngle = Math.abs(Math.cos(time * 18));
	}
}
