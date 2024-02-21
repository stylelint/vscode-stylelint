jest.mock('winston', () => {
	const winston = jest.requireActual('winston');

	return {
		...winston,
		transports: {
			...winston.transports,
			File: jest.fn(),
		},
	};
});

// eslint-disable-next-line n/no-missing-import
import type transports from 'winston/lib/winston/transports';
import winston from 'winston';
import { createLogger } from '../create-logger';

type MockWinston = typeof winston & {
	transports: typeof winston.transports & {
		File: jest.Mock<typeof winston.transports.File>;
	};
};

const mockConnection = serverMocks.getConnection();
const mockWinston = winston as MockWinston;

describe('createLogger', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should return a logger', () => {
		const logger = createLogger(mockConnection);

		expect(logger).toHaveProperty('log');
		expect(logger.log).toBeInstanceOf(Function);
	});

	it('should return a logger that logs to the connection', () => {
		const logger = createLogger(mockConnection);

		logger.debug('test');
		logger.info('test');

		expect(mockConnection.console.log).not.toHaveBeenCalled();
		expect(mockConnection.console.info).toHaveBeenCalledTimes(1);
		expect(mockConnection.console.info).toHaveBeenCalledWith('test');
	});

	it('should return a logger that logs to the connection with the correct level', () => {
		const logger = createLogger(mockConnection, 'warn');

		logger.warn('test');
		logger.info('test');

		expect(logger.isInfoEnabled()).toBe(false);
		expect(mockConnection.console.info).not.toHaveBeenCalled();
		expect(mockConnection.console.warn).toHaveBeenCalledTimes(1);
		expect(mockConnection.console.warn).toHaveBeenCalledWith('test');
	});

	it('should add a file transport to the logger if a path is provided', () => {
		const mockTransport =
			new winston.transports.Console() as unknown as transports.FileTransportInstance;

		mockWinston.transports.File.mockImplementation(() => mockTransport);

		const logger = createLogger(mockConnection, 'info', 'test.log');

		expect(mockWinston.transports.File).toHaveBeenCalledTimes(1);
		expect(mockWinston.transports.File).toHaveBeenCalledWith({
			filename: 'test.log',
			format: expect.any(Object),
		});
		expect(logger.transports).toContain(mockTransport);
	});
});
