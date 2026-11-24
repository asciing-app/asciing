import { wrapPythonScript } from '../../engine/python.js';
import type { PresetParams } from '../../types/preset.js';

export function generatePython(params: PresetParams): string {
	const lilies = Math.max(0, Number(params.lilies ?? 5));
	const roses = Math.max(0, Number(params.roses ?? 2));
	const tulips = Math.max(0, Number(params.tulips ?? 1));
	const daisies = Math.max(0, Number(params.daisies ?? 0));
	const orchids = Math.max(0, Number(params.orchids ?? 0));
	const totalCount = Math.max(1, lilies + roses + tulips + daisies + orchids);

	const speed = Number(params.bloomSpeed ?? 1.0);
	const text = String(params.overlayText ?? 'Who needs flowers when you can code them?').replace(/"/g, '\\"');

	const renderFunction = `
import math

FLOWER_COUNT = ${totalCount}
SPEED = ${speed.toFixed(2)}
OVERLAY_TEXT = "${text}"

RAMP = " .:-=+*#%@"
RAMP_LEN = len(RAMP)

def render_frame(cols, rows, t):
    grid = [[" " for _ in range(cols)] for _ in range(rows)]
    color_grid = [[None for _ in range(cols)] for _ in range(rows)]

    cycle = 8.5 / SPEED
    progress = min(1.0, ((t * SPEED) % cycle) / (cycle * 0.78))

    root_x = cols // 2
    root_y = int(rows * 0.88)
    stem_prog = min(1.0, progress / 0.42)

    for i in range(FLOWER_COUNT):
        norm_idx = (i / max(1, FLOWER_COUNT - 1)) * 2.0 - 1.0
        target_x = root_x + int(norm_idx * (cols * 0.38))
        target_y = int(rows * 0.44 + abs(norm_idx) * (rows * 0.12))

        cur_tip_y = int(root_y - (root_y - target_y) * stem_prog)
        steps = max(6, root_y - cur_tip_y)
        for s in range(steps):
            u = s / float(steps)
            sx = int(root_x + (target_x - root_x) * u)
            sy = int(root_y - (root_y - cur_tip_y) * u)
            for dx in (-1, 0, 1):
                fx = sx + dx
                if 0 <= fx < cols and 0 <= sy < rows:
                    grid[sy][fx] = "#" if dx == 0 else "|"
                    color_grid[sy][fx] = (46, 125, 50)

        b_start = 0.25 + abs(norm_idx) * 0.15
        if progress > b_start:
            bloom_local = min(1.0, (progress - b_start) / 0.42)
            r = int(6 * bloom_local)
            for dy in range(-r, r + 1):
                for dx in range(-r * 2, r * 2 + 1):
                    dist = math.sqrt((dx / 2.0)**2 + dy**2)
                    if dist <= r:
                        fx = target_x + dx
                        fy = target_y + dy
                        if 0 <= fx < cols and 0 <= fy < rows:
                            char_idx = int((1.0 - dist / max(1, r)) * (RAMP_LEN - 1))
                            grid[fy][fx] = RAMP[max(0, min(RAMP_LEN - 1, char_idx))]
                            if i % 3 == 0:
                                color_grid[fy][fx] = (255, 60, 80)
                            elif i % 3 == 1:
                                color_grid[fy][fx] = (255, 200, 40)
                            else:
                                color_grid[fy][fx] = (245, 245, 245)

    if OVERLAY_TEXT and rows > 6:
        start_c = max(0, (cols - len(OVERLAY_TEXT)) // 2)
        for c_idx, ch in enumerate(OVERLAY_TEXT):
            if start_c + c_idx < cols:
                grid[2][start_c + c_idx] = ch
                color_grid[2][start_c + c_idx] = (255, 255, 255)

    lines = []
    for r in range(rows):
        line_chars = []
        for c in range(cols):
            ch = grid[r][c]
            rgb = color_grid[r][c]
            if rgb:
                line_chars.append(f"\\033[38;2;{rgb[0]};{rgb[1]};{rgb[2]}m{ch}")
            else:
                line_chars.append(" ")
        lines.append("".join(line_chars))

    return "\\n".join(lines) + "\\033[0m"
`;

	return wrapPythonScript(renderFunction, 30, 'ASCII Blooming Bouquet');
}
