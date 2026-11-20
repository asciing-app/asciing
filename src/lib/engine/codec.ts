import LZString from 'lz-string';
import type { ControlSchema, PresetParams } from '../types/preset.js';

export interface DecodedState {
	slug: string;
	version: number;
	params: PresetParams;
}

interface WirePayload {
	s: string;
	v: number;
	p: PresetParams;
}

export function getDefaultParams(controls: ControlSchema[]): PresetParams {
	const params: PresetParams = {};
	for (const ctrl of controls) {
		if (ctrl.type !== 'image') {
			params[ctrl.key] = ctrl.default;
		}
	}
	return params;
}

export function cleanSerializableParams(params: PresetParams): PresetParams {
	const serializable: PresetParams = {};
	for (const [k, v] of Object.entries(params)) {
		// Ignore any transient/image or non-primitive values
		if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
			// Skip very long base64 or file strings if any
			if (typeof v === 'string' && v.length > 512) {
				continue;
			}
			serializable[k] = v;
		}
	}
	return serializable;
}

export function encodePresetState(slug: string, version: number, params: PresetParams): string {
	const payload: WirePayload = {
		s: slug,
		v: version,
		p: cleanSerializableParams(params)
	};
	const json = JSON.stringify(payload);
	return LZString.compressToEncodedURIComponent(json);
}

export function decodePresetState(rawInput: string): DecodedState | null {
	if (!rawInput || typeof rawInput !== 'string') return null;

	let code = rawInput.trim();

	// Check if full URL or contains hash
	const hashIdx = code.indexOf('#');
	if (hashIdx !== -1) {
		code = code.slice(hashIdx + 1);
	}

	// Remove leading 'v=' if present
	if (code.startsWith('v=')) {
		code = code.slice(2);
	}

	if (!code) return null;

	try {
		const json = LZString.decompressFromEncodedURIComponent(code);
		if (!json) return null;

		const parsed = JSON.parse(json) as Partial<WirePayload>;
		if (typeof parsed?.s === 'string' && typeof parsed?.v === 'number' && parsed.p) {
			return {
				slug: parsed.s,
				version: parsed.v,
				params: parsed.p
			};
		}
	} catch {
		return null;
	}

	return null;
}
