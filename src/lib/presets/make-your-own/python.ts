import { wrapPythonScript } from '../../engine/python.js';
import type { PresetParams, RuntimeAssets } from '../../types/preset.js';
import { exportPythonScript } from '../../ascii-studio/pyExporter.js';
import type { DecodedMediaFrame, AsciiSettings } from '../../ascii-studio/types.js';

export function generatePython(params: PresetParams, assets?: RuntimeAssets): string {
	const charsetKey = String(params.charset ?? 'standard');
	const customCharset = String(params.customCharset ?? '').trim();
	const colorMode = String(params.colorMode ?? 'truecolor');
	const brightness = Number(params.brightness ?? 0);
	const contrast = Number(params.contrast ?? 0);
	const dither = Boolean(params.dither ?? false);
	const invert = Boolean(params.invert ?? false);

	const charSets: Record<string, string> = {
		standard: ' .:-=+*#%@',
		blocks: ' ░▒▓█',
		minimal: ' .oO@',
		binary: ' 01',
		detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
	};

	const chars = customCharset.length > 0 ? customCharset : charSets[charsetKey] || charSets.standard;

	// Check if multi-frame GIF or video frames are available in assets
	const frames = (assets?.['gifFrames'] || assets?.['videoFrames']) as DecodedMediaFrame[] | undefined;
	if (frames && frames.length > 0) {
		const settings: AsciiSettings = {
			cols: Number(params.cols ?? 90),
			aspectCorrection: 0.55,
			charset: chars,
			colorMode: (colorMode as any) || 'truecolor',
			brightness,
			contrast,
			invert,
			dither
		};
		return exportPythonScript(frames, settings);
	}

	// Check if static image is available in assets
	const imageAsset = assets?.['image'] as HTMLCanvasElement | ImageBitmap | undefined;
	if (imageAsset) {
		const settings: AsciiSettings = {
			cols: Number(params.cols ?? 90),
			aspectCorrection: 0.55,
			charset: chars,
			colorMode: (colorMode as any) || 'truecolor',
			brightness,
			contrast,
			invert,
			dither
		};
		return exportPythonScript([{ bitmap: imageAsset as any, delayMs: 100 }], settings);
	}

	const renderFunction = `
CHARS = ${JSON.stringify(chars)}
CHAR_LEN = len(CHARS)
COLOR_MODE = "${colorMode}"
BRIGHTNESS = ${brightness}
CONTRAST = ${contrast}
DITHER = ${dither ? 'True' : 'False'}
INVERT = ${invert ? 'True' : 'False'}

contrast_factor = (259.0 * (CONTRAST + 255.0)) / (255.0 * (259.0 - CONTRAST)) if CONTRAST != 259 else 1.0

def render_frame(cols, rows, t):
    lines = []
    aspect = cols / max(1.0, rows)

    # 2D luminance buffer for Floyd-Steinberg error diffusion
    lum_grid = [0.0] * (cols * rows)

    for r in range(rows):
        y = (r / max(1.0, rows)) * 2.0 - 1.0
        for c in range(cols):
            x = ((c / max(1.0, cols)) * 2.0 - 1.0) * aspect

            # Procedural generative media pattern
            v1 = math.sin(x * 2.5 + t * 0.8)
            v2 = math.sin(y * 2.5 + t * 0.6)
            dist = math.sqrt(x * x + y * y + 0.1)
            v3 = math.sin(dist * 4.0 - t * 1.2)
            val = (v1 + v2 + v3) / 3.0

            raw_lum = (val + 1.0) * 0.5 * 255.0
            adjusted = contrast_factor * (raw_lum - 128.0) + 128.0 + BRIGHTNESS * 1.28
            if INVERT:
                adjusted = 255.0 - adjusted
            lum_grid[r * cols + c] = max(0.0, min(255.0, adjusted))

    if DITHER:
        step = 255.0 / max(1.0, CHAR_LEN - 1)
        for y in range(rows):
            for x in range(cols):
                idx = y * cols + x
                old_val = lum_grid[idx]
                new_val = round(old_val / step) * step
                lum_grid[idx] = new_val
                err = old_val - new_val

                if x + 1 < cols:
                    lum_grid[idx + 1] += err * (7.0 / 16.0)
                if y + 1 < rows:
                    if x - 1 >= 0:
                        lum_grid[(y + 1) * cols + (x - 1)] += err * (3.0 / 16.0)
                    lum_grid[(y + 1) * cols + x] += err * (5.0 / 16.0)
                    if x + 1 < cols:
                        lum_grid[(y + 1) * cols + (x + 1)] += err * (1.0 / 16.0)

    for r in range(rows):
        line_chars = []
        last_color = None

        for c in range(cols):
            cell_idx = r * cols + c
            norm = max(0.0, min(1.0, lum_grid[cell_idx] / 255.0))
            char_idx = int(norm * (CHAR_LEN - 1))
            char = CHARS[min(CHAR_LEN - 1, max(0, char_idx))]

            if COLOR_MODE == "green":
                red, green, blue = 34, int(120 + norm * 135), 94
            elif COLOR_MODE == "mono":
                v = int(180 + norm * 75)
                red, green, blue = v, v, v
            else:
                x = ((c / max(1.0, cols)) * 2.0 - 1.0) * aspect
                y = (r / max(1.0, rows)) * 2.0 - 1.0
                red = int(math.sin(norm * math.pi + t) * 127 + 128)
                green = int(math.cos(norm * math.pi * 0.7 + t) * 127 + 128)
                blue = int(math.sin((x + y + t) * 2.0) * 127 + 128)

            color = (red, green, blue)
            if color != last_color:
                line_chars.append(f"\\033[38;2;{red};{green};{blue}m")
                last_color = color

            line_chars.append(char)

        line_chars.append("\\033[0m")
        lines.append("".join(line_chars))

    return "\\n".join(lines) + "\\n"
`;

	return wrapPythonScript(renderFunction, 25, 'Make Your Own — asciing.app');
}
