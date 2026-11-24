export type FlowerSpecies = 'lily' | 'rose' | 'tulip' | 'daisy' | 'orchid';

export type FlowerColorName =
	| 'red'
	| 'pink'
	| 'yellow'
	| 'orange'
	| 'white'
	| 'purple'
	| 'coral';

export interface FlowerConfigItem {
	type: FlowerSpecies;
	color: FlowerColorName;
}

export interface FlowerInstance {
	id: number;
	type: FlowerSpecies;
	colorName: FlowerColorName;
	x: number;
	y: number;
	targetX: number;
	targetY: number;
	stemP0: [number, number];
	stemP1: [number, number];
	stemP2: [number, number];
	stemP3: [number, number];
	// 3D positioning coordinates relative to bouquet center
	stemP0_3D?: [number, number, number];
	stemP1_3D?: [number, number, number];
	stemP2_3D?: [number, number, number];
	stemP3_3D?: [number, number, number];
	normal3D?: [number, number, number];
	tangentU?: [number, number, number];
	tangentV?: [number, number, number];
	currentZ?: number;
	projectedX?: number;
	projectedY?: number;
	projectedScale?: number;
	leaves: Array<{
		t: number;
		side: 1 | -1;
		length: number;
		angle: number;
	}>;
	baseColor: string;
	shadowColor: string;
	highlightColor: string;
	stamenColor: string;
	scale: number;
	tiltAngle: number;
	bloomDelay: number;
	bloomDuration: number;
	depth: number;
}

export interface SparkleParticle {
	x: number;
	y: number;
	size: number;
	color: string;
	phase: number;
	twinkleSpeed: number;
	char: string;
}

export interface Butterfly {
	x: number;
	y: number;
	scale: number;
	color: string;
	speed: number;
	pathOffset: number;
	wingAngle: number;
}

export interface FoliageLeaf {
	p0: [number, number];
	p1: [number, number];
	p2: [number, number];
	p3: [number, number];
	p0_3D?: [number, number, number];
	p1_3D?: [number, number, number];
	p2_3D?: [number, number, number];
	p3_3D?: [number, number, number];
	currentZ?: number;
	growthDelay: number;
	color: string;
}

export interface BouquetState {
	flowers: FlowerInstance[];
	foliageLeaves: FoliageLeaf[];
	particles: SparkleParticle[];
	butterflies: Butterfly[];
	totalBloomProgress: number;
}
