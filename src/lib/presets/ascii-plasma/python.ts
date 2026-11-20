import { wrapPythonScript } from '../../engine/python.js';
import type { PresetParams } from '../../types/preset.js';

export function generatePython(params: PresetParams): string {
	const speed = Number(params.speed ?? 1.0);
	const scale = Number(params.scale ?? 2.5);
	const charSet = String(params.charSet ?? 'standard');
	const colorMode = String(params.colorMode ?? 'cyan-magenta');

	const charSets: Record<string, string> = {
		standard: ' .:-=+*#%@',
		blocks: ' ░▒▓█',
		minimal: ' .oO@',
		binary: ' 01',
		detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
	};

	const chars = charSets[charSet] || charSets.standard;

	const renderFunction = `
CHARS = ${JSON.stringify(chars)}
CHAR_LEN = len(CHARS)
SPEED = ${speed.toFixed(3)}
SCALE = ${scale.toFixed(3)}
COLOR_MODE = "${colorMode}"

def render_frame(cols, rows, t):
    lines = []
    t_scaled = t * SPEED

    for r in range(rows):
        line_chars = []
        y = (r / max(1, rows)) * 2.0 - 1.0

        for c in range(cols):
            x = ((c / max(1, cols)) * 2.0 - 1.0) * (cols / (rows * 2.0))

            # Multi-wave sine plasma calculation
            v1 = math.sin(x * SCALE + t_scaled)
            v2 = math.sin(y * SCALE + t_scaled * 0.8)
            v3 = math.sin((x + y) * SCALE + t_scaled * 1.2)
            cx = x + 0.5 * math.sin(t_scaled / 3.0)
            cy = y + 0.5 * math.cos(t_scaled / 2.0)
            v4 = math.sin(math.sqrt(cx*cx + cy*cy + 1.0) * SCALE * 1.5 - t_scaled)

            val = (v1 + v2 + v3 + v4) / 4.0
            norm = (val + 1.0) * 0.5
            norm = max(0.0, min(1.0, norm))

            idx = int(norm * (CHAR_LEN - 1))
            char = CHARS[idx]

            # ANSI 24-bit TrueColor or 256 color mapping
            if COLOR_MODE == "cyan-magenta":
                red = int(norm * 240 + 15)
                green = int((1.0 - norm) * 180 + 30)
                blue = 255
            elif COLOR_MODE == "green-phosphor":
                red = int(norm * 40)
                green = int(norm * 220 + 35)
                blue = int(norm * 60)
            elif COLOR_MODE == "amber-crt":
                red = int(norm * 230 + 25)
                green = int(norm * 140 + 15)
                blue = int(norm * 20)
            elif COLOR_MODE == "fire":
                red = int(min(255, norm * 2.5 * 255))
                green = int(max(0, (norm - 0.3) * 1.8 * 255))
                blue = int(max(0, (norm - 0.7) * 3.0 * 255))
            else: # monochrome
                red = green = blue = int(norm * 240 + 15)

            line_chars.append(f"\\033[38;2;{red};{green};{blue}m{char}")

        lines.append("".join(line_chars))

    return "\\n".join(lines) + "\\033[0m"
`;

	return wrapPythonScript(renderFunction, 30, 'ASCII Plasma');
}
