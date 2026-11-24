import { wrapPythonScript } from '../../engine/python.js';
import type { PresetParams } from '../../types/preset.js';

export function generatePython(params: PresetParams): string {
	const lilies = Math.max(0, Number(params.lilies ?? 2));
	const roses = Math.max(0, Number(params.roses ?? 2));
	const tulips = Math.max(0, Number(params.tulips ?? 2));
	const daisies = Math.max(0, Number(params.daisies ?? 2));
	const orchids = Math.max(0, Number(params.orchids ?? 2));
	const totalCount = Math.max(1, lilies + roses + tulips + daisies + orchids);

	const rotSpeed = Number(params.rotationSpeed ?? 0.25);
	const rotate3d = params.rotate3d !== false;
	const activeRot = rotate3d ? rotSpeed.toFixed(2) : '0.0';
	const text = String(params.overlayText ?? 'Who needs flowers when you can code them?').replace(/"/g, '\\"');

	const renderFunction = `
import math

FLOWER_COUNT = ${totalCount}
ROT_SPEED = ${activeRot}
OVERLAY_TEXT = "${text}"

RAMP = " .:-=+*#%@"
RAMP_LEN = len(RAMP)
GOLDEN_ANGLE = 2.39996323

def render_frame(cols, rows, t):
    grid = [[" " for _ in range(cols)] for _ in range(rows)]
    color_grid = [[None for _ in range(cols)] for _ in range(rows)]
    z_buffer = [[-999999.0 for _ in range(cols)] for _ in range(rows)]

    root_x = cols // 2
    root_y = int(rows * 0.78)

    current_rot = t * ROT_SPEED
    pitch = 0.26

    flower_list = []
    for i in range(FLOWER_COUNT):
        r_frac = 0.0 if FLOWER_COUNT == 1 else math.sqrt((i + 0.4) / FLOWER_COUNT)
        spread_r = r_frac * (cols * 0.22)
        phi = i * GOLDEN_ANGLE + current_rot

        x3d = math.cos(phi) * spread_r
        z3d = math.sin(phi) * spread_r * 0.75
        tier = 2 if r_frac < 0.35 else (1 if r_frac < 0.7 else 0)
        y_off = 4 if tier == 0 else (0 if tier == 1 else -7)
        y3d = -int(rows * 0.44) + y_off

        cos_p = math.cos(pitch)
        sin_p = math.sin(pitch)
        yr = y3d * cos_p - z3d * sin_p
        zr = y3d * sin_p + z3d * cos_p

        cam_d = 80.0
        sc = cam_d / max(20.0, zr + cam_d)

        screen_x = int(root_x + x3d * sc)
        screen_y = int(root_y + yr * sc)

        flower_list.append({
            'idx': i,
            'x': screen_x,
            'y': screen_y,
            'z': zr,
            'scale': sc,
            'tier': tier
        })

    flower_list.sort(key=lambda f: f['z'])

    for fl in flower_list:
        tx = fl['x']
        ty = fl['y']
        cur_tip_y = ty
        steps = max(6, abs(root_y - cur_tip_y))

        for s in range(steps):
            u = s / float(steps)
            sx = int(root_x + (tx - root_x) * u)
            sy = int(root_y - (root_y - cur_tip_y) * u)
            for dx in (-1, 0, 1):
                fx = sx + dx
                if 0 <= fx < cols and 0 <= sy < rows:
                    if fl['z'] >= z_buffer[sy][fx]:
                        z_buffer[sy][fx] = fl['z']
                        grid[sy][fx] = "#" if dx == 0 else "|"
                        color_grid[sy][fx] = (46, 125, 50)

    for fl in flower_list:
        i = fl['idx']
        tx = fl['x']
        ty = fl['y']
        sc = fl['scale']
        r = max(2, int(6 * sc))
        for dy in range(-r, r + 1):
            for dx in range(-r * 2, r * 2 + 1):
                dist = math.sqrt((dx / 2.0)**2 + dy**2)
                if dist <= r:
                    fx = tx + dx
                    fy = ty + dy
                    if 0 <= fx < cols and 0 <= fy < rows:
                        if fl['z'] + 1.0 >= z_buffer[fy][fx]:
                            z_buffer[fy][fx] = fl['z'] + 1.0
                            char_idx = int((1.0 - dist / max(1, r)) * (RAMP_LEN - 1))
                            grid[fy][fx] = RAMP[max(0, min(RAMP_LEN - 1, char_idx))]
                                if i % 4 == 0:
                                    color_grid[fy][fx] = (255, 60, 80)
                                elif i % 4 == 1:
                                    color_grid[fy][fx] = (255, 120, 170)
                                elif i % 4 == 2:
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

	return wrapPythonScript(renderFunction, 30, 'ASCII 3D Blooming Bouquet');
}
