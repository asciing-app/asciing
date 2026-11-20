export interface FrameContext {
	ctx: CanvasRenderingContext2D;
	width: number;
	height: number;
	time: number;
	dt: number;
	dpr: number;
}

export type FrameCallback = (frame: FrameContext) => void;

export interface CanvasLoopHandle {
	destroy: () => void;
	pause: () => void;
	resume: () => void;
	isPaused: () => boolean;
}

export function createCanvasLoop(
	canvas: HTMLCanvasElement,
	container: HTMLElement,
	onFrame: FrameCallback
): CanvasLoopHandle {
	const ctx = canvas.getContext('2d', { alpha: false });
	if (!ctx) {
		throw new Error('Unable to obtain 2D canvas context');
	}

	let width = 0;
	let height = 0;
	let dpr = 1;
	let rafId: number | null = null;
	let lastTime = performance.now();
	let startTime = lastTime;
	let paused = false;

	function resize() {
		const rect = container.getBoundingClientRect();
		width = Math.max(1, Math.floor(rect.width));
		height = Math.max(1, Math.floor(rect.height));
		dpr = window.devicePixelRatio || 1;

		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;

		ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	const resizeObserver = new ResizeObserver(() => {
		resize();
	});
	resizeObserver.observe(container);
	resize();

	function render(now: number) {
		if (paused) return;

		const dt = Math.min((now - lastTime) / 1000, 0.1);
		const time = (now - startTime) / 1000;
		lastTime = now;

		ctx?.save();
		onFrame({
			ctx: ctx!,
			width,
			height,
			time,
			dt,
			dpr
		});
		ctx?.restore();

		rafId = requestAnimationFrame(render);
	}

	rafId = requestAnimationFrame(render);

	return {
		destroy() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			resizeObserver.disconnect();
		},
		pause() {
			paused = true;
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
		},
		resume() {
			if (!paused) return;
			paused = false;
			lastTime = performance.now();
			rafId = requestAnimationFrame(render);
		},
		isPaused() {
			return paused;
		}
	};
}
