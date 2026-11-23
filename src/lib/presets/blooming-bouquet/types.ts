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

export interface BouquetState {
	flowers: FlowerInstance[];
	foliageLeaves: Array<{
		p0: [number, number];
		p1: [number, number];
		p2: [number, number];
		p3: [number, number];
		growthDelay: number;
		color: string;
	}>;
	particles: SparkleParticle[];
	butterflies: Butterfly[];
	totalBloomProgress: number;
}
