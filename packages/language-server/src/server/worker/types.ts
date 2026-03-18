import type stylelint from 'stylelint';

import type { LinterResult, RuleMetadataSnapshot, RunnerOptions } from '../stylelint/types.js';

export const stylelintNotFoundError = 'STYLELINT_NOT_FOUND';

export type WorkerLintPayload = {
	options: stylelint.LinterOptions;
	stylelintPath?: string;
	runnerOptions?: RunnerOptions;
};

export type WorkerResolvePayload = {
	stylelintPath?: string;
	codeFilename?: string;
	runnerOptions?: RunnerOptions;
};

export type WorkerResolveConfigPayload = {
	filePath: string;
	stylelintPath?: string;
	runnerOptions?: RunnerOptions;
};

export type WorkerLintResult = {
	resolvedPath: string;
	linterResult: LinterResult;
	ruleMetadata?: RuleMetadataSnapshot;
};

export type WorkerResolveResult = {
	resolvedPath: string;
	entryPath: string;
	version?: string;
};

export type WorkerResolveConfigResult = {
	resolvedPath: string;
	config: stylelint.Config | undefined;
};

export type WorkerRequest =
	| {
			id: string;
			type: 'lint';
			payload: WorkerLintPayload;
	  }
	| {
			id: string;
			type: 'resolve';
			payload: WorkerResolvePayload;
	  }
	| {
			id: string;
			type: 'resolveConfig';
			payload: WorkerResolveConfigPayload;
	  }
	| {
			id: string;
			type: 'shutdown';
	  };

export type SerializedWorkerError = {
	name?: string;
	message: string;
	stack?: string;
	code?: string;
};

export type WorkerResponse =
	| {
			id: string;
			success: true;
			result?: WorkerLintResult | WorkerResolveResult | WorkerResolveConfigResult | undefined;
	  }
	| {
			id: string;
			success: false;
			error: SerializedWorkerError;
	  };
