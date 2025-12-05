// @no-unit-test -- Tightly coupled to worker process environment, covered by integration tests.

import process from 'node:process';
import winston from 'winston';

import { ErrorFormatter } from '../utils/index.js';
import type { LoggingService } from '../services/infrastructure/logging.service.js';

const workerLevels = {
	error: 0,
	warn: 1,
	info: 2,
	debug: 3,
} as const;

type WorkerLogLevel = keyof typeof workerLevels;

export type WorkerLoggingServiceOptions = {
	level?: WorkerLogLevel;
	logPath?: string;
	workspaceRoot?: string;
};

/**
 * Parses the provided log level string if it matches one of the supported worker levels.
 */
function parseLogLevel(value: string | undefined): WorkerLogLevel | undefined {
	if (!value) {
		return undefined;
	}

	if (value === 'error' || value === 'warn' || value === 'info' || value === 'debug') {
		return value;
	}

	return undefined;
}

const defaultLevel: WorkerLogLevel =
	parseLogLevel(process.env.STYLELINT_WORKER_LOG_LEVEL) ?? 'warn';

const defaultLogPath = process.env.STYLELINT_WORKER_LOG_PATH;

const createFormats = (): winston.Logform.Format =>
	winston.format.combine(new ErrorFormatter(), winston.format.timestamp(), winston.format.json());

/**
 * Creates a logging service that mirrors the server logger but targets the worker context.
 */
export function createWorkerLoggingService(
	options: WorkerLoggingServiceOptions = {},
): LoggingService {
	const level = options.level ?? defaultLevel;
	const transports: winston.transport[] = [
		new winston.transports.Console({
			format: createFormats(),
		}),
	];

	const logPath = options.logPath ?? defaultLogPath;

	if (logPath) {
		transports.push(
			new winston.transports.File({
				filename: logPath,
				format: createFormats(),
			}),
		);
	}

	const workspaceRoot = options.workspaceRoot ?? process.env.STYLELINT_WORKSPACE ?? process.cwd();

	const logger = winston.createLogger({
		level,
		levels: workerLevels,
		defaultMeta: {
			pid: process.pid,
			process: 'stylelint-worker',
			workspaceRoot,
		},
		transports,
	});

	return {
		createLogger: (component) => {
			const moduleName = component.name || 'WorkerComponent';

			return logger.child({ module: moduleName });
		},
	};
}
