import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection, RemoteConsole } from 'vscode-languageserver';
import type winston from 'winston';

import { createWinstonLoggingService } from '../winston-logging.service.js';
import { LanguageServerTransport } from '../../../utils/logging/language-server-transport.js';

type WinstonStub = Pick<typeof winston, 'createLogger' | 'format' | 'transports'>;

function createConnection(): Connection {
	const remoteConsole = {
		connection: {} as Connection,
		info: vi.fn(),
		log: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		initialize: vi.fn(),
		fillServerCapabilities: vi.fn(),
	} as unknown as RemoteConsole;

	return {
		console: remoteConsole,
	} as unknown as Connection;
}

describe('createWinstonLoggerFactory', () => {
	let connection: Connection;
	let winstonStub: WinstonStub & {
		transports: { File: ReturnType<typeof vi.fn> };
		createLogger: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		connection = createConnection();
		const child = vi.fn().mockImplementation((metadata) => ({ ...metadata }));
		const logger = { child };
		const createLogger = vi.fn().mockReturnValue(logger);
		const formatFactory = () =>
			({
				transform: vi.fn((info: winston.Logform.TransformableInfo) => info),
				options: {},
			}) as winston.Logform.Format;
		const combine = vi.fn((..._formats: winston.Logform.Format[]) => formatFactory());
		const timestamp = vi.fn(() => formatFactory());
		const json = vi.fn(() => formatFactory());
		const File = vi.fn(
			class FileMock {
				options: winston.transport.TransportStreamOptions;
				constructor(options: winston.transport.TransportStreamOptions) {
					this.options = options;
				}
			},
		);

		winstonStub = {
			createLogger,
			format: { combine, timestamp, json },
			transports: { File },
		} as unknown as WinstonStub & {
			createLogger: typeof createLogger;
			transports: { File: typeof File };
		};
	});

	it('should create logging service with language server transport', () => {
		const factory = createWinstonLoggingService('debug');
		const loggingService = factory.useFactory(connection, winstonStub as unknown as typeof winston);

		expect(winstonStub.createLogger).toHaveBeenCalledWith(
			expect.objectContaining({
				level: 'debug',
				transports: [expect.any(LanguageServerTransport)],
			}),
		);

		const logger = loggingService.createLogger(class ExampleService {});

		expect(logger).toEqual({ service: 'ExampleService' });
		expect(winstonStub.createLogger.mock.results[0]?.value.child).toHaveBeenCalledWith({
			service: 'ExampleService',
		});
	});

	it('should include file transport when log path provided', () => {
		const factory = createWinstonLoggingService('info', '/tmp/stylelint.log');

		factory.useFactory(connection, winstonStub as unknown as typeof winston);

		const transports = winstonStub.createLogger.mock.calls[0][0].transports;

		expect(transports).toHaveLength(2);
		expect(transports[0]).toBeInstanceOf(LanguageServerTransport);
		expect(transports[1]).toMatchObject({
			options: expect.objectContaining({ filename: '/tmp/stylelint.log' }),
		});
		expect(winstonStub.transports.File).toHaveBeenCalledWith(
			expect.objectContaining({ filename: '/tmp/stylelint.log' }),
		);
	});
});
