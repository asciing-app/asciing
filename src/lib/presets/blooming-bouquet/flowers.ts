import type { FlowerInstance } from './types.js';

function easeOutCubic(x: number): number {
	return 1 - Math.pow(1 - x, 3);
}

function easeOutBack(x: number): number {
	const c1 = 1.4;
	const c3 = c1 + 1;
	return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function evalBezier(
	p0: [number, number],
	p1: [number, number],
	p2: [number, number],
	p3: [number, number],
	u: number
): [number, number] {
	const inv = 1 - u;
	const x = inv * inv * inv * p0[0] + 3 * inv * inv * u * p1[0] + 3 * inv * u * u * p2[0] + u * u * u * p3[0];
	const y = inv * inv * inv * p0[1] + 3 * inv * inv * u * p1[1] + 3 * inv * u * u * p2[1] + u * u * u * p3[1];
	return [x, y];
}

export function evalBezierDerivative(
	p0: [number, number],
	p1: [number, number],
	p2: [number, number],
	p3: [number, number],
	u: number
): [number, number] {
	const inv = 1 - u;
	const dx = 3 * inv * inv * (p1[0] - p0[0]) + 6 * inv * u * (p2[0] - p1[0]) + 3 * u * u * (p3[0] - p2[0]);
	const dy = 3 * inv * inv * (p1[1] - p0[1]) + 6 * inv * u * (p2[1] - p1[1]) + 3 * u * u * (p3[1] - p2[1]);
	return [dx, dy];
}

/**
 * Draws a thick, fully filled-in green stem along a cubic Bézier curve
 */
export function drawThickFilledStem(
	ctx: CanvasRenderingContext2D,
	p0: [number, number],
	p1: [number, number],
	p2: [number, number],
	p3: [number, number],
	tMax: number,
	baseWidth: number = 18,
	tipWidth: number = 11
): [number, number] {
	if (tMax <= 0.02) return [p0[0], p0[1]];

	const steps = Math.max(10, Math.floor(45 * tMax));
	const leftPts: [number, number][] = [];
	const rightPts: [number, number][] = [];

	let lastTip: [number, number] = [p0[0], p0[1]];

	for (let i = 0; i <= steps; i++) {
		const u = (i / steps) * tMax;
		const [cx, cy] = evalBezier(p0, p1, p2, p3, u);
		const [dx, dy] = evalBezierDerivative(p0, p1, p2, p3, u);
		const len = Math.hypot(dx, dy) || 1;
		const nx = -dy / len;
		const ny = dx / len;

		const halfW = (baseWidth + (tipWidth - baseWidth) * u) * 0.5;

		leftPts.push([cx + nx * halfW, cy + ny * halfW]);
		rightPts.push([cx - nx * halfW, cy - ny * halfW]);

		if (i === steps) {
			lastTip = [cx, cy];
		}
	}

	ctx.beginPath();
	ctx.moveTo(leftPts[0][0], leftPts[0][1]);
	for (let i = 1; i < leftPts.length; i++) {
		ctx.lineTo(leftPts[i][0], leftPts[i][1]);
	}
	for (let i = rightPts.length - 1; i >= 0; i--) {
		ctx.lineTo(rightPts[i][0], rightPts[i][1]);
	}
	ctx.closePath();

	const grad = ctx.createLinearGradient(p0[0] - 20, p0[1], p3[0] + 20, p3[1]);
	grad.addColorStop(0, '#1b5e20');
	grad.addColorStop(0.35, '#2e7d32');
	grad.addColorStop(0.7, '#43a047');
	grad.addColorStop(1, '#81c784');
	ctx.fillStyle = grad;
	ctx.fill();

	ctx.beginPath();
	for (let i = 0; i <= steps; i++) {
		const u = (i / steps) * tMax;
		const [cx, cy] = evalBezier(p0, p1, p2, p3, u);
		if (i === 0) ctx.moveTo(cx, cy);
		else ctx.lineTo(cx, cy);
	}
	ctx.strokeStyle = '#a5d6a7';
	ctx.lineWidth = 2.5;
	ctx.stroke();

	return lastTip;
}

/**
 * Draws thick foliage leaves curling out from the stem
 */
export function drawThickLeaf(
	ctx: CanvasRenderingContext2D,
	origin: [number, number],
	growth: number,
	side: 1 | -1,
	baseLength: number,
	baseAngle: number
) {
	if (growth <= 0.05) return;
	const len = baseLength * easeOutCubic(growth);
	const width = len * 0.38;

	ctx.save();
	ctx.translate(origin[0], origin[1]);
	ctx.rotate(baseAngle);

	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.bezierCurveTo(side * width * 1.35, -len * 0.32, side * width * 1.1, -len * 0.78, 0, -len);
	ctx.bezierCurveTo(-side * width * 0.35, -len * 0.68, -side * width * 0.25, -len * 0.28, 0, 0);
	ctx.closePath();

	const grad = ctx.createLinearGradient(0, 0, 0, -len);
	grad.addColorStop(0, '#1b5e20');
	grad.addColorStop(0.3, '#2e7d32');
	grad.addColorStop(0.75, '#43a047');
	grad.addColorStop(1, '#a5d6a7');
	ctx.fillStyle = grad;
	ctx.fill();

	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.quadraticCurveTo(side * width * 0.25, -len * 0.5, 0, -len * 0.95);
	ctx.strokeStyle = '#c8e6c9';
	ctx.lineWidth = 2;
	ctx.stroke();

	ctx.restore();
}

/**
 * Beautiful, natural star Lily matching the viral video:
 * 6 long recurved pointed petals with deep throat glow, center rib seams, and prominent pollen stamens
 */
export function drawDetailedLily(
	ctx: CanvasRenderingContext2D,
	flower: FlowerInstance,
	bloom: number,
	breezeAngle: number
) {
	const scale = flower.scale;
	const maxR = 92 * scale; // Large, expansive blossom

	ctx.save();
	ctx.translate(flower.targetX, flower.targetY);
	ctx.rotate(flower.tiltAngle + breezeAngle);

	// Closed bud phase (0.0 to 0.08)
	if (bloom < 0.08) {
		const budProg = bloom / 0.08;
		const budH = maxR * 0.8 * (0.4 + 0.6 * budProg);
		const budW = budH * 0.28;

		ctx.beginPath();
		ctx.ellipse(0, -budH * 0.48, budW, budH * 0.48, 0, 0, Math.PI * 2);
		const bGrad = ctx.createLinearGradient(0, 0, 0, -budH);
		bGrad.addColorStop(0, '#1b5e20');
		bGrad.addColorStop(0.35, flower.shadowColor);
		bGrad.addColorStop(0.85, flower.baseColor);
		bGrad.addColorStop(1, flower.highlightColor);
		ctx.fillStyle = bGrad;
		ctx.fill();

		ctx.restore();
		return;
	}

	const open = easeOutCubic(Math.min(1.0, (bloom - 0.08) / 0.92));
	const currentRadius = maxR * (0.35 + 0.65 * open);

	// 6 petals in 2 layers: outer 3 sepals first (deeper), inner 3 petals on top
	const layers = [
		{ angles: [0, 2, 4], rMult: 0.96, wMult: 0.48, reflex: 1.0 },
		{ angles: [1, 3, 5], rMult: 1.06, wMult: 0.54, reflex: 1.05 }
	];

	for (const layer of layers) {
		for (const i of layer.angles) {
			const angle = (i * Math.PI * 2) / 6 - Math.PI / 2;
			const pLen = currentRadius * layer.rMult;
			const pW = pLen * layer.wMult * (0.35 + 0.65 * open);

			ctx.save();
			ctx.rotate(angle);

			// Natural petal curve: narrow base -> wide belly -> tapered pointed tip
			ctx.beginPath();
			ctx.moveTo(0, 0);
			// Left side
			ctx.bezierCurveTo(pW * 0.5, pLen * 0.15, pW * 0.95, pLen * 0.55, 0, pLen);
			// Right side
			ctx.bezierCurveTo(-pW * 0.95, pLen * 0.55, -pW * 0.5, pLen * 0.15, 0, 0);
			ctx.closePath();

			// Rich multi-stop gradient for luminous depth
			const grad = ctx.createLinearGradient(0, 0, 0, pLen);
			grad.addColorStop(0, '#0f0205');
			grad.addColorStop(0.12, flower.shadowColor);
			grad.addColorStop(0.48, flower.baseColor);
			grad.addColorStop(0.88, flower.highlightColor);
			grad.addColorStop(1, '#ffffff');
			ctx.fillStyle = grad;
			ctx.fill();

			// Center mid-vein seam (adds realistic cross-stitch texture)
			ctx.beginPath();
			ctx.moveTo(0, 2);
			ctx.lineTo(0, pLen * 0.92);
			ctx.strokeStyle = flower.shadowColor;
			ctx.lineWidth = 2.4 * scale;
			ctx.stroke();

			// Soft highlight on petal ridges
			ctx.beginPath();
			ctx.moveTo(0, pLen * 0.2);
			ctx.lineTo(0, pLen * 0.85);
			ctx.strokeStyle = flower.highlightColor;
			ctx.lineWidth = 1.0;
			ctx.stroke();

			// Petal freckles/speckles near base (classic lily feature)
			if (open > 0.4) {
				ctx.fillStyle = flower.shadowColor;
				for (let f = 1; f <= 5; f++) {
					const fy = pLen * (0.2 + f * 0.07);
					const fx = (Math.sin(f * 3.7) * pW * 0.25);
					ctx.beginPath();
					ctx.arc(fx, fy, 1.2 * scale, 0, Math.PI * 2);
					ctx.fill();
				}
			}

			ctx.restore();
		}
	}

	// Golden green throat glow
	ctx.beginPath();
	ctx.arc(0, 0, currentRadius * 0.14, 0, Math.PI * 2);
	ctx.fillStyle = '#eeff41';
	ctx.fill();

	// 6 radiating stamens with golden-brown anthers
	if (open > 0.3) {
		const sProg = (open - 0.3) / 0.7;
		const sLen = currentRadius * 0.46 * easeOutCubic(sProg);

		for (let s = 0; s < 6; s++) {
			const sAngle = (s * Math.PI * 2) / 6 + 0.52;
			const sx = Math.cos(sAngle) * sLen;
			const sy = Math.sin(sAngle) * sLen;

			// Slender filament
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.quadraticCurveTo(sx * 0.55, sy * 0.55 - 4, sx, sy);
			ctx.strokeStyle = '#fffde7';
			ctx.lineWidth = 2.0 * scale;
			ctx.stroke();

			// T-shaped pollen anther
			ctx.save();
			ctx.translate(sx, sy);
			ctx.rotate(sAngle + Math.PI / 2);
			ctx.beginPath();
			ctx.ellipse(0, 0, 4.8 * scale, 2.2 * scale, 0, 0, Math.PI * 2);
			ctx.fillStyle = flower.stamenColor;
			ctx.fill();
			ctx.restore();
		}

		// Central pistil/stigma
		ctx.beginPath();
		ctx.arc(0, 0, 5.5 * scale, 0, Math.PI * 2);
		ctx.fillStyle = '#76ff03';
		ctx.fill();
	}

	ctx.restore();
}

/**
 * Beautiful, romantic spiraling Rose with natural overlapping petals
 */
export function drawDetailedRose(
	ctx: CanvasRenderingContext2D,
	flower: FlowerInstance,
	bloom: number,
	breezeAngle: number
) {
	const scale = flower.scale;
	const maxR = 84 * scale;

	ctx.save();
	ctx.translate(flower.targetX, flower.targetY);
	ctx.rotate(flower.tiltAngle + breezeAngle);

	const open = easeOutCubic(bloom);
	const radius = maxR * (0.35 + 0.65 * open);

	// Overlapping spiral petal whorls (Fibonacci-spaced arcs)
	const whorlRings = [
		{ count: 7, r: radius * 0.95, w: radius * 0.52, color: flower.shadowColor, depth: 0.9 },
		{ count: 6, r: radius * 0.78, w: radius * 0.48, color: flower.baseColor, depth: 1.0 },
		{ count: 5, r: radius * 0.60, w: radius * 0.42, color: flower.baseColor, depth: 1.1 },
		{ count: 4, r: radius * 0.42, w: radius * 0.35, color: flower.highlightColor, depth: 1.2 },
		{ count: 3, r: radius * 0.25, w: radius * 0.26, color: flower.highlightColor, depth: 1.3 }
	];

	for (const ring of whorlRings) {
		for (let p = 0; p < ring.count; p++) {
			const angle = (p * Math.PI * 2) / ring.count + ring.r * 0.08;
			const px = Math.cos(angle) * (ring.r * 0.5 * open);
			const py = Math.sin(angle) * (ring.r * 0.5 * open);

			ctx.save();
			ctx.translate(px, py);
			ctx.rotate(angle + Math.PI / 2);

			// Scalloped cupped petal curve
			ctx.beginPath();
			ctx.moveTo(-ring.w * 0.5, 0);
			ctx.bezierCurveTo(-ring.w * 0.6, -ring.w * 0.45, ring.w * 0.6, -ring.w * 0.45, ring.w * 0.5, 0);
			ctx.bezierCurveTo(ring.w * 0.3, ring.w * 0.35, -ring.w * 0.3, ring.w * 0.35, -ring.w * 0.5, 0);
			ctx.closePath();

			const pGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, ring.w * 0.6);
			pGrad.addColorStop(0, flower.shadowColor);
			pGrad.addColorStop(0.65, ring.color);
			pGrad.addColorStop(1, flower.highlightColor);
			ctx.fillStyle = pGrad;
			ctx.fill();

			// Delicate curled petal rim
			ctx.beginPath();
			ctx.arc(0, -ring.w * 0.3, ring.w * 0.45, Math.PI * 0.8, Math.PI * 2.2);
			ctx.strokeStyle = flower.highlightColor;
			ctx.lineWidth = 1.4 * scale;
			ctx.stroke();

			ctx.restore();
		}
	}

	// Tight velvet center whorl
	ctx.beginPath();
	ctx.arc(0, 0, radius * 0.18, 0, Math.PI * 2);
	ctx.fillStyle = '#1a0004';
	ctx.fill();

	ctx.restore();
}

/**
 * Beautiful, graceful chalice Tulip
 */
export function drawDetailedTulip(
	ctx: CanvasRenderingContext2D,
	flower: FlowerInstance,
	bloom: number,
	breezeAngle: number
) {
	const scale = flower.scale;
	const open = easeOutCubic(bloom);
	const h = 88 * scale * (0.42 + 0.58 * open);
	const w = 58 * scale * (0.42 + 0.58 * open);

	ctx.save();
	ctx.translate(flower.targetX, flower.targetY);
	ctx.rotate(flower.tiltAngle + breezeAngle);

	// Rear 2 curved petals
	ctx.beginPath();
	ctx.ellipse(-w * 0.32 * open, -h * 0.52, w * 0.42, h * 0.5, -0.2 * open, 0, Math.PI * 2);
	ctx.fillStyle = flower.shadowColor;
	ctx.fill();

	ctx.beginPath();
	ctx.ellipse(w * 0.32 * open, -h * 0.52, w * 0.42, h * 0.5, 0.2 * open, 0, Math.PI * 2);
	ctx.fillStyle = flower.shadowColor;
	ctx.fill();

	// Front chalice with scalloped rim
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.bezierCurveTo(-w * 0.98, -h * 0.32, -w * 0.88, -h * 0.94, 0, -h);
	ctx.bezierCurveTo(w * 0.88, -h * 0.94, w * 0.98, -h * 0.32, 0, 0);
	ctx.closePath();

	const grad = ctx.createLinearGradient(0, 0, 0, -h);
	grad.addColorStop(0, '#1b5e20');
	grad.addColorStop(0.2, flower.shadowColor);
	grad.addColorStop(0.65, flower.baseColor);
	grad.addColorStop(1, flower.highlightColor);
	ctx.fillStyle = grad;
	ctx.fill();

	// Center seam & vertical fluting
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(0, -h * 0.9);
	ctx.strokeStyle = flower.shadowColor;
	ctx.lineWidth = 2.2 * scale;
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(-w * 0.3, -h * 0.2);
	ctx.quadraticCurveTo(-w * 0.4, -h * 0.6, -w * 0.2, -h * 0.85);
	ctx.strokeStyle = flower.highlightColor;
	ctx.lineWidth = 1.0;
	ctx.stroke();

	ctx.restore();
}

/**
 * Detailed Daisy / Sunflower with golden floret disk and radiating petals
 */
export function drawDetailedDaisy(
	ctx: CanvasRenderingContext2D,
	flower: FlowerInstance,
	bloom: number,
	breezeAngle: number
) {
	const scale = flower.scale;
	const open = easeOutCubic(bloom);
	const radius = 82 * scale * (0.3 + 0.7 * open);
	const discR = radius * 0.36;
	const petals = 24;

	ctx.save();
	ctx.translate(flower.targetX, flower.targetY);
	ctx.rotate(flower.tiltAngle + breezeAngle);

	// Radiant slender ray petals
	for (let i = 0; i < petals; i++) {
		const angle = (i * Math.PI * 2) / petals;
		const pLen = radius * open;
		const pW = (radius * 0.22) * open;

		ctx.save();
		ctx.rotate(angle);
		ctx.beginPath();
		ctx.ellipse(0, pLen * 0.55, pW * 0.5, pLen * 0.45, 0, 0, Math.PI * 2);

		const pGrad = ctx.createLinearGradient(0, 0, 0, pLen);
		pGrad.addColorStop(0, flower.shadowColor);
		pGrad.addColorStop(0.55, flower.baseColor);
		pGrad.addColorStop(1, flower.highlightColor);
		ctx.fillStyle = pGrad;
		ctx.fill();

		ctx.restore();
	}

	// Center floret disk
	ctx.beginPath();
	ctx.arc(0, 0, discR, 0, Math.PI * 2);
	ctx.fillStyle = flower.stamenColor;
	ctx.fill();

	// Textured honeycomb core
	ctx.beginPath();
	ctx.arc(0, 0, discR * 0.65, 0, Math.PI * 2);
	ctx.fillStyle = '#211202';
	ctx.fill();

	ctx.restore();
}

/**
 * Beautiful, natural Phalaenopsis Orchid with graceful layered petals, ruffled labellum and column
 */
export function drawDetailedOrchid(
	ctx: CanvasRenderingContext2D,
	flower: FlowerInstance,
	bloom: number,
	breezeAngle: number
) {
	const scale = flower.scale;
	const open = easeOutCubic(bloom);
	const r = 88 * scale * (0.35 + 0.65 * open);

	ctx.save();
	ctx.translate(flower.targetX, flower.targetY);
	ctx.rotate(flower.tiltAngle + breezeAngle);

	// 1. Three Outer Sepals (dorsal top, lower left, lower right)
	const sepals = [
		{ angle: -Math.PI / 2, len: r * 0.95, w: r * 0.42 },
		{ angle: Math.PI * 0.28, len: r * 0.88, w: r * 0.38 },
		{ angle: Math.PI * 0.72, len: r * 0.88, w: r * 0.38 }
	];

	for (const s of sepals) {
		ctx.save();
		ctx.rotate(s.angle);

		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.bezierCurveTo(-s.w * 0.6, s.len * 0.3, -s.w * 0.5, s.len * 0.8, 0, s.len);
		ctx.bezierCurveTo(s.w * 0.5, s.len * 0.8, s.w * 0.6, s.len * 0.3, 0, 0);
		ctx.closePath();

		const sGrad = ctx.createLinearGradient(0, 0, 0, s.len);
		sGrad.addColorStop(0, flower.shadowColor);
		sGrad.addColorStop(0.35, flower.baseColor);
		sGrad.addColorStop(1, flower.highlightColor);
		ctx.fillStyle = sGrad;
		ctx.fill();

		ctx.restore();
	}

	// 2. Two Broad Lateral Petals (prominent round orchid wings)
	const wingAngles = [-0.15, Math.PI + 0.15];
	const wingW = r * 0.68;
	const wingH = r * 0.58;

	for (const wa of wingAngles) {
		ctx.save();
		ctx.rotate(wa);

		ctx.beginPath();
		ctx.ellipse(r * 0.52, 0, wingW * 0.55, wingH * 0.5, 0, 0, Math.PI * 2);

		const wGrad = ctx.createRadialGradient(r * 0.2, 0, 0, r * 0.5, 0, wingW * 0.6);
		wGrad.addColorStop(0, flower.shadowColor);
		wGrad.addColorStop(0.4, flower.baseColor);
		wGrad.addColorStop(0.9, flower.highlightColor);
		wGrad.addColorStop(1, '#ffffff');
		ctx.fillStyle = wGrad;
		ctx.fill();

		// Delicate petal edge highlight
		ctx.strokeStyle = flower.highlightColor;
		ctx.lineWidth = 1.2;
		ctx.stroke();

		ctx.restore();
	}

	// 3. Central Ruffled Labellum (Lip)
	ctx.save();
	ctx.translate(0, r * 0.32);

	// Labellum heart/lobe
	ctx.beginPath();
	ctx.moveTo(0, -r * 0.15);
	ctx.bezierCurveTo(-r * 0.42, -r * 0.05, -r * 0.38, r * 0.45, 0, r * 0.42);
	ctx.bezierCurveTo(r * 0.38, r * 0.45, r * 0.42, -r * 0.05, 0, -r * 0.15);
	ctx.closePath();

	const lipGrad = ctx.createRadialGradient(0, 0, 0, 0, r * 0.1, r * 0.42);
	lipGrad.addColorStop(0, '#ffd600');
	lipGrad.addColorStop(0.3, flower.shadowColor);
	lipGrad.addColorStop(0.85, flower.baseColor);
	lipGrad.addColorStop(1, flower.shadowColor);
	ctx.fillStyle = lipGrad;
	ctx.fill();

	// Speckles inside labellum
	ctx.fillStyle = '#4a0000';
	for (let sp = -2; sp <= 2; sp++) {
		ctx.beginPath();
		ctx.arc(sp * 4 * scale, (sp % 2) * 3 * scale, 1.2 * scale, 0, Math.PI * 2);
		ctx.fill();
	}

	ctx.restore();

	// 4. Center Golden Column / Anther Cap
	ctx.beginPath();
	ctx.ellipse(0, -r * 0.02, 6 * scale, 9 * scale, 0, 0, Math.PI * 2);
	ctx.fillStyle = '#fffde7';
	ctx.fill();

	ctx.beginPath();
	ctx.ellipse(0, r * 0.05, 4 * scale, 4 * scale, 0, 0, Math.PI * 2);
	ctx.fillStyle = '#ffd600';
	ctx.fill();

	ctx.restore();
}

/**
 * Draws chic florist kraft wrapping paper around the base of the bouquet with 3D rotation, folded layers and a satin ribbon bow
 */
export function drawBouquetWrappingPaper(
	ctx: CanvasRenderingContext2D,
	rootX: number,
	rootY: number,
	angleY: number = 0,
	pitchX: number = 0.26,
	layer: 'back' | 'front' | 'all' = 'all'
) {
	ctx.save();
	ctx.translate(rootX, rootY);

	// Kraft paper geometry:
	// Elegant, tailored florist wrap cradling the bouquet dome
	const topW = 125; // Compact, proportionate flared wrap
	const topH = 150; // Balanced coverage wrapping shortened stems
	const botW = 26;
	const botH = 42;
	const waistW = 40;
	const waistH = 10;

	// Camera pitch foreshortening for the elliptical rims
	const pitchSin = Math.sin(pitchX);
	const rimY = -topH * 0.78;
	const rimHeight = topW * pitchSin * 0.45;

	// Rotation calculations
	const sinRot = Math.sin(angleY);
	const cosRot = Math.cos(angleY);

	// 1. Back Layer (drawn behind stems)
	if (layer === 'back' || layer === 'all') {
		// Inside dark shadow cavity of the rear kraft cone
		ctx.beginPath();
		ctx.ellipse(0, rimY, topW * 0.95, rimHeight, 0, Math.PI, Math.PI * 2);
		ctx.lineTo(botW * 0.6, botH * 0.2);
		ctx.lineTo(-botW * 0.6, botH * 0.2);
		ctx.closePath();

		const insideGrad = ctx.createLinearGradient(0, rimY - 20, 0, botH);
		insideGrad.addColorStop(0, '#2b1b17');
		insideGrad.addColorStop(0.5, '#3e2723');
		insideGrad.addColorStop(1, '#1b100d');
		ctx.fillStyle = insideGrad;
		ctx.fill();

		// Rear rim edge
		ctx.strokeStyle = '#4e342e';
		ctx.lineWidth = 1.8;
		ctx.beginPath();
		ctx.ellipse(0, rimY, topW * 0.95, rimHeight, 0, Math.PI, Math.PI * 2);
		ctx.stroke();

		if (layer === 'back') {
			ctx.restore();
			return;
		}
	}

	// 2. Front Layer (drawn over lower stems, wrapping tightly around the bunch)
	const foldShift = sinRot * 55; // Fold seam shifts left/right in 3D

	// Rotating lighting gradient that catches light as the bouquet spins
	const gradAngle = angleY + 0.6;
	const gx0 = -Math.cos(gradAngle) * topW;
	const gy0 = -topH * 0.5;
	const gx1 = Math.cos(gradAngle) * topW;
	const gy1 = botH * 0.5;
	const paperGrad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
	paperGrad.addColorStop(0, '#d7ccc8');   // Pale kraft highlight
	paperGrad.addColorStop(0.28, '#bcaaa4'); // Warm craft paper
	paperGrad.addColorStop(0.65, '#8d6e63'); // Medium craft fold
	paperGrad.addColorStop(1, '#4e342e');   // Deep shadow fold
	ctx.fillStyle = paperGrad;

	// Main front conical envelope
	ctx.beginPath();
	ctx.moveTo(-botW, botH);
	ctx.lineTo(-topW, rimY);
	// Front half of the flared elliptical rim
	ctx.ellipse(0, rimY, topW, rimHeight, 0, Math.PI, 0, true);
	ctx.lineTo(botW, botH);
	ctx.quadraticCurveTo(0, botH + 18, -botW, botH);
	ctx.closePath();
	ctx.fill();

	// Front origami flap 1 (diagonal fold that turns in 3D)
	ctx.beginPath();
	ctx.moveTo(-topW * 0.85 + foldShift * 0.3, rimY);
	ctx.lineTo(botW * 0.6, botH * 0.7);
	ctx.lineTo(-botW * 0.8, botH);
	ctx.closePath();
	const foldGrad1 = ctx.createLinearGradient(-topW * 0.6 + foldShift, rimY, 0, 0);
	foldGrad1.addColorStop(0, 'rgba(255, 248, 225, 0.42)');
	foldGrad1.addColorStop(1, 'rgba(62, 39, 35, 0.60)');
	ctx.fillStyle = foldGrad1;
	ctx.fill();

	// Front origami flap 2 (cross fold)
	ctx.beginPath();
	ctx.moveTo(topW * 0.85 + foldShift * 0.3, rimY);
	ctx.lineTo(-botW * 0.6, botH * 0.68);
	ctx.lineTo(botW * 0.8, botH);
	ctx.closePath();
	const foldGrad2 = ctx.createLinearGradient(topW * 0.6 + foldShift, rimY, 0, 0);
	foldGrad2.addColorStop(0, 'rgba(255, 236, 179, 0.45)');
	foldGrad2.addColorStop(1, 'rgba(46, 26, 21, 0.65)');
	ctx.fillStyle = foldGrad2;
	ctx.fill();

	// Crisp rim highlight on the front lip
	ctx.strokeStyle = '#efebe9';
	ctx.lineWidth = 2.4;
	ctx.beginPath();
	ctx.ellipse(0, rimY, topW, rimHeight, 0, 0, Math.PI, false);
	ctx.stroke();

	// 3. Luxurious Satin Ribbon around the gathered waist
	const waistY = 12;

	// Ribbon cinch band
	ctx.beginPath();
	ctx.ellipse(0, waistY, waistW, waistH, 0, 0, Math.PI * 2);
	const ribbonGrad = ctx.createLinearGradient(-waistW, waistY, waistW, waistY);
	ribbonGrad.addColorStop(0, '#f48fb1');
	ribbonGrad.addColorStop(0.3, '#ff4081');
	ribbonGrad.addColorStop(0.7, '#f50057');
	ribbonGrad.addColorStop(1, '#c51162');
	ctx.fillStyle = ribbonGrad;
	ctx.fill();

	// 3D Satin Ribbon Bow:
	// Rotates around the waist ellipse in 3D!
	const bowX = sinRot * (waistW * 0.85);
	const bowFacing = cosRot; // > 0 is front, < 0 is back

	if (bowFacing > -0.25) {
		const bowScale = 0.6 + 0.4 * Math.max(0, (bowFacing + 0.25) / 1.25);
		const knotY = waistY + waistH * 0.4 * Math.sin(angleY * 0.5);

		ctx.save();
		ctx.translate(bowX, knotY);
		ctx.scale(bowScale, 1.0);

		// Left loop
		ctx.beginPath();
		ctx.ellipse(-24, -6, 20, 11, -0.32, 0, Math.PI * 2);
		ctx.fillStyle = '#ff4081';
		ctx.fill();
		ctx.strokeStyle = '#ffe4ec';
		ctx.lineWidth = 1.5;
		ctx.stroke();

		// Right loop
		ctx.beginPath();
		ctx.ellipse(24, -6, 20, 11, 0.32, 0, Math.PI * 2);
		ctx.fillStyle = '#ff4081';
		ctx.fill();
		ctx.strokeStyle = '#ffe4ec';
		ctx.lineWidth = 1.5;
		ctx.stroke();

		// Center knot
		ctx.beginPath();
		ctx.ellipse(0, 0, 8, 8, 0, 0, Math.PI * 2);
		ctx.fillStyle = '#f50057';
		ctx.fill();
		ctx.stroke();

		// Trailing ribbon tails swaying with 3D rotation
		const tailSway = sinRot * 12;
		ctx.beginPath();
		ctx.moveTo(-4, 5);
		ctx.bezierCurveTo(-18 + tailSway, 26, -28 + tailSway, 50, -32 + tailSway, 72);
		ctx.strokeStyle = '#ff4081';
		ctx.lineWidth = 4.2;
		ctx.lineCap = 'round';
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(4, 5);
		ctx.bezierCurveTo(18 + tailSway, 26, 28 + tailSway, 50, 32 + tailSway, 72);
		ctx.strokeStyle = '#ff4081';
		ctx.lineWidth = 4.2;
		ctx.lineCap = 'round';
		ctx.stroke();

		ctx.restore();
	}

	ctx.restore();
}

export function drawFlowerBloom(
	ctx: CanvasRenderingContext2D,
	flower: FlowerInstance,
	progress: number,
	breezeAngle: number,
	affineTransform?: [number, number, number, number],
	faceNormalZ?: number
) {
	const localBloom = Math.max(0, Math.min(1.0, (progress - flower.bloomDelay) / flower.bloomDuration));
	if (localBloom <= 0) return;

	if (affineTransform) {
		const [a, b, c, d] = affineTransform;
		ctx.save();
		// Origin is already at projected flower head
		const px = flower.projectedX ?? flower.targetX;
		const py = flower.projectedY ?? flower.targetY;
		ctx.translate(px, py);

		// Clamp affine foreshortening so flowers never collapse into thin sticks
		ctx.transform(a, b, c, d, 0, 0);

		// Temporarily zero target coords for relative drawing in transform
		const origTx = flower.targetX;
		const origTy = flower.targetY;
		flower.targetX = 0;
		flower.targetY = 0;

		switch (flower.type) {
			case 'lily':
				drawDetailedLily(ctx, flower, localBloom, breezeAngle);
				break;
			case 'rose':
				drawDetailedRose(ctx, flower, localBloom, breezeAngle);
				break;
			case 'tulip':
				drawDetailedTulip(ctx, flower, localBloom, breezeAngle);
				break;
			case 'daisy':
				drawDetailedDaisy(ctx, flower, localBloom, breezeAngle);
				break;
			case 'orchid':
				drawDetailedOrchid(ctx, flower, localBloom, breezeAngle);
				break;
			default:
				drawDetailedLily(ctx, flower, localBloom, breezeAngle);
		}

		flower.targetX = origTx;
		flower.targetY = origTy;
		ctx.restore();
		return;
	}

	switch (flower.type) {
		case 'lily':
			drawDetailedLily(ctx, flower, localBloom, breezeAngle);
			break;
		case 'rose':
			drawDetailedRose(ctx, flower, localBloom, breezeAngle);
			break;
		case 'tulip':
			drawDetailedTulip(ctx, flower, localBloom, breezeAngle);
			break;
		case 'daisy':
			drawDetailedDaisy(ctx, flower, localBloom, breezeAngle);
			break;
		case 'orchid':
			drawDetailedOrchid(ctx, flower, localBloom, breezeAngle);
			break;
		default:
			drawDetailedLily(ctx, flower, localBloom, breezeAngle);
	}
}
