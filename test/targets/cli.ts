import { spawnSync } from 'child_process';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';

import { join } from 'path';
import type { CLIOptions } from '../../src/optionUtils';
import { optionsToCLIArgs } from '../../src/optionsToCLIArgs';

export const TMP_DIR = join(__dirname, '..', '..', '.tmp');
export const BIN_PATH =
	process.env.BIBTEX_TIDY_BIN ??
	join(__dirname, '..', '..', 'bin', 'bibtex-tidy');

mkdirSync(TMP_DIR, { recursive: true });

function getTmpPath(i: number = 0): string {
	return join(TMP_DIR, `tmp${i}.bib`);
}

export type CLIResult = {
	bibtexs: string[];
	warnings: string[];
	stdout: string;
};

/**
 * Run bibtex-tidy through command line. Unlike API, this accepts multiple
 * bibtex files.
 */
export function testCLI(
	bibtexs: string[] | { stdin: string },
	options: CLIOptions = {}
): CLIResult {
	const args: string[] = [];
	const files: string[] = [];
	if (Array.isArray(bibtexs)) {
		for (const [i, bibtex] of bibtexs.entries()) {
			const tmpFile = getTmpPath(i);
			writeFileSync(tmpFile, bibtex, 'utf8');
			args.push(tmpFile);
			files.push(tmpFile);
		}
	} else {
		args.push('-'); // stdin
	}

	args.push(...optionsToCLIArgs(options));

	const proc = spawnSync(BIN_PATH, args, {
		timeout: 100000,
		encoding: 'utf8',
		input: 'stdin' in bibtexs ? bibtexs.stdin : undefined,
		stdio: ['stdin' in bibtexs ? 'pipe' : 'inherit', 'pipe', 'pipe'],
	});

	if (proc.status !== 0) {
		console.log(`> bibtex-tidy ${args.join(' ')}`);
		throw new Error('CLI error: ' + proc.stderr);
	}

	const tidiedOutputs = files.map((file) => readFileSync(file, 'utf8'));

	const warnings = proc.stderr
		.split('\n')
		.filter((line) => line.includes(': '))
		.map((line) => line.split(':')[0]!);

	files.forEach((tmpFile) => unlinkSync(tmpFile));

	return { bibtexs: tidiedOutputs, warnings, stdout: proc.stdout };
}
