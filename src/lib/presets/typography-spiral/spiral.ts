export interface SpiralGeometry {
	count: number;
	r: Float32Array;
	cosTheta: Float32Array;
	sinTheta: Float32Array;
	cosTan: Float32Array;
	sinTan: Float32Array;
	arcIndex: Uint32Array;
	b: number;
	maxRadius: number;
}

const MAX_NODES = 4500;

export class SpiralGeometryCache {
	private lastKey = '';
	private cached: SpiralGeometry = {
		count: 0,
		r: new Float32Array(0),
		cosTheta: new Float32Array(0),
		sinTheta: new Float32Array(0),
		cosTan: new Float32Array(0),
		sinTan: new Float32Array(0),
		arcIndex: new Uint32Array(0),
		b: 0,
		maxRadius: 0
	};

	/**
	 * Precomputes constant arc-length Archimedean spiral nodes and static trig values.
	 * Rebuilds strictly when width, height, ringSpacing, or charSpacing change.
	 */
	public getGeometry(
		width: number,
		height: number,
		ringSpacing: number,
		nominalCharSpacing: number
	): SpiralGeometry {
		const key = `${Math.round(width)}_${Math.round(height)}_${ringSpacing.toFixed(1)}_${nominalCharSpacing.toFixed(1)}`;
		if (key === this.lastKey) {
			return this.cached;
		}

		this.lastKey = key;

		const b = ringSpacing / (2.0 * Math.PI);
		const rMin = Math.max(14.0, ringSpacing * 1.4);
		const maxRadius = Math.min(width, height) * 0.46;

		if (maxRadius <= rMin || ringSpacing <= 0 || nominalCharSpacing <= 0) {
			this.cached = {
				count: 0,
				r: new Float32Array(0),
				cosTheta: new Float32Array(0),
				sinTheta: new Float32Array(0),
				cosTan: new Float32Array(0),
				sinTan: new Float32Array(0),
				arcIndex: new Uint32Array(0),
				b,
				maxRadius
			};
			return this.cached;
		}

		// Estimate total spiral arc length: L ≈ π * (R^2 - rMin^2) / ringSpacing
		const totalArcLength = (Math.PI * (maxRadius * maxRadius - rMin * rMin)) / ringSpacing;
		const estimatedNodes = totalArcLength / nominalCharSpacing;

		// Soft node-count safety guard: widen char spacing if needed so node count <= MAX_NODES
		let effectiveCharSpacing = nominalCharSpacing;
		if (estimatedNodes > MAX_NODES) {
			effectiveCharSpacing = totalArcLength / MAX_NODES;
		}

		// First pass: count nodes precisely
		let nodeCount = 0;
		let currTheta = 0.0;
		let currR = rMin;

		while (currR <= maxRadius) {
			nodeCount++;
			const deltaTheta = effectiveCharSpacing / Math.sqrt(currR * currR + b * b);
			currTheta += deltaTheta;
			currR = rMin + b * currTheta;
		}

		// Allocate flat typed arrays
		const rArr = new Float32Array(nodeCount);
		const cosThetaArr = new Float32Array(nodeCount);
		const sinThetaArr = new Float32Array(nodeCount);
		const cosTanArr = new Float32Array(nodeCount);
		const sinTanArr = new Float32Array(nodeCount);
		const arcIndexArr = new Uint32Array(nodeCount);

		// Second pass: fill arrays with precomputed radius, theta trig, and tangent offsets
		currTheta = 0.0;
		currR = rMin;

		for (let i = 0; i < nodeCount; i++) {
			rArr[i] = currR;
			cosThetaArr[i] = Math.cos(currTheta);
			sinThetaArr[i] = Math.sin(currTheta);

			// Static tangent angle: alpha_tan = currTheta + PI/2 - atan2(b, currR)
			const alphaTan = currTheta + Math.PI / 2.0 - Math.atan2(b, currR);
			cosTanArr[i] = Math.cos(alphaTan);
			sinTanArr[i] = Math.sin(alphaTan);

			arcIndexArr[i] = i;

			const deltaTheta = effectiveCharSpacing / Math.sqrt(currR * currR + b * b);
			currTheta += deltaTheta;
			currR = rMin + b * currTheta;
		}

		this.cached = {
			count: nodeCount,
			r: rArr,
			cosTheta: cosThetaArr,
			sinTheta: sinThetaArr,
			cosTan: cosTanArr,
			sinTan: sinTanArr,
			arcIndex: arcIndexArr,
			b,
			maxRadius
		};

		return this.cached;
	}
}
