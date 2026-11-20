import { wrapPythonScript } from '../../engine/python.js';
import type { PresetParams } from '../../types/preset.js';

export function generatePython(params: PresetParams): string {
	const rotSpeedA = Number(params.speedX ?? 0.8);
	const rotSpeedB = Number(params.speedY ?? 0.5);
	const r1 = Number(params.innerRadius ?? 1.0);
	const r2 = Number(params.outerRadius ?? 2.0);
	const colorMode = String(params.colorMode ?? 'emerald');

	const renderFunction = `
CHARS = ".,-~:;=!*#$@"
CHAR_LEN = len(CHARS)
SPEED_A = ${rotSpeedA.toFixed(3)}
SPEED_B = ${rotSpeedB.toFixed(3)}
R1 = ${r1.toFixed(3)}
R2 = ${r2.toFixed(3)}
K2 = 5.0
COLOR_MODE = "${colorMode}"

def render_frame(cols, rows, t):
    A = t * SPEED_A
    B = t * SPEED_B

    cosA, sinA = math.cos(A), math.sin(A)
    cosB, sinB = math.cos(B), math.sin(B)

    # Screen buffers
    output = [[' ' for _ in range(cols)] for _ in range(rows)]
    zbuffer = [[0.0 for _ in range(cols)] for _ in range(rows)]
    color_buf = [[0.0 for _ in range(cols)] for _ in range(rows)]

    K1 = cols * K2 * 3.0 / (8.0 * (R1 + R2))

    # Theta and Phi steps
    theta_step = 0.07
    phi_step = 0.02

    phi = 0.0
    while phi < 6.28318:
        cosphi = math.cos(phi)
        sinphi = math.sin(phi)

        theta = 0.0
        while theta < 6.28318:
            costheta = math.cos(theta)
            sintheta = math.sin(theta)

            # 3D coordinates before rotation
            circlex = R2 + R1 * costheta
            circley = R1 * sintheta

            # 3D coordinates after rotation around X and Z axes
            x = circlex * (cosB * cosphi + sinA * sinB * sinphi) - circley * cosA * sinB
            y = circlex * (sinB * cosphi - sinA * cosB * sinphi) + circley * cosA * cosB
            z = K2 + cosA * circlex * sinphi + circley * sinA
            ooz = 1.0 / z if z != 0 else 0.0

            # 2D projection
            xp = int(cols / 2 + K1 * ooz * x)
            yp = int(rows / 2 - K1 * ooz * y * 0.5)

            # Surface normal luminance calculation
            L = (cosphi * costheta * sinB - cosA * costheta * sinphi -
                 sinA * sintheta + cosB * (cosA * sintheta - costheta * sinA * sinphi))

            if 0 <= xp < cols and 0 <= yp < rows:
                if ooz > zbuffer[yp][xp]:
                    zbuffer[yp][xp] = ooz
                    luminance_index = int(max(0.0, min(1.0, (L + 1.414) / 2.828)) * (CHAR_LEN - 1))
                    output[yp][xp] = CHARS[luminance_index]
                    color_buf[yp][xp] = (L + 1.414) / 2.828

            theta += theta_step
        phi += phi_step

    # Build colored ANSI frame
    lines = []
    for r in range(rows):
        line_chars = []
        for c in range(cols):
            ch = output[r][c]
            lum = color_buf[r][c]
            if ch == ' ':
                line_chars.append(' ')
            else:
                if COLOR_MODE == 'emerald':
                    red = int(lum * 60)
                    green = int(lum * 220 + 35)
                    blue = int(lum * 140 + 20)
                elif COLOR_MODE == 'amber':
                    red = int(lum * 240 + 15)
                    green = int(lum * 150 + 10)
                    blue = int(lum * 30)
                elif COLOR_MODE == 'electric-blue':
                    red = int(lum * 50)
                    green = int(lum * 160 + 30)
                    blue = int(lum * 230 + 25)
                else: # monochrome
                    val = int(lum * 240 + 15)
                    red = green = blue = val

                line_chars.append(f"\\033[38;2;{red};{green};{blue}m{ch}")

        lines.append("".join(line_chars))

    return "\\n".join(lines) + "\\033[0m"
`;

	return wrapPythonScript(renderFunction, 30, '3D ASCII Torus Field');
}
