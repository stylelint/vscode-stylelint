import type { Connection } from 'vscode-languageserver';
import { NotificationService } from '../notification.service.js';
import { vi, describe, it, expect, beforeEach, Mocked } from 'vitest';
import type { LoggingService } from '../logging.service.js';
import { createTestLogger } from '../../../../../test/helpers/test-logger.js';

const mockConnectionBase = {
	onNotification: vi.fn(),
};

const mockConnection = mockConnectionBase as unknown as Mocked<Connection>;

const mockLogger = createTestLogger();

const mockLoggingService: LoggingService = {
	createLogger: vi.fn(() => mockLogger),
};

describe('NotificationManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should be constructable', () => {
		expect(new NotificationService(mockConnection, mockLoggingService)).toBeDefined();
	});

	it('should accept handlers', () => {
		const manager = new NotificationService(mockConnection, mockLoggingService);
		const handler = vi.fn();

		expect(() => manager.on('test', handler)).not.toThrow();
	});

	it('should accept star handlers', () => {
		const manager = new NotificationService(mockConnection, mockLoggingService);
		const handler = vi.fn();

		expect(() => manager.on(handler)).not.toThrow();
	});

	it('should register a handler with the connection', () => {
		const manager = new NotificationService(mockConnection, mockLoggingService);
		const handler1 = vi.fn();
		const handler2 = vi.fn();

		manager.on('test', handler1);
		manager.on('test', handler2);

		expect(mockConnection.onNotification).toHaveBeenCalledTimes(1);
		expect(mockConnection.onNotification).toHaveBeenCalledWith('test', expect.any(Function));
	});

	it('should register a star handler with the connection', () => {
		const manager = new NotificationService(mockConnection, mockLoggingService);
		const handler1 = vi.fn();
		const handler2 = vi.fn();

		manager.on(handler1);
		manager.on(handler2);

		expect(mockConnection.onNotification).toHaveBeenCalledTimes(1);
		expect(mockConnection.onNotification).toHaveBeenCalledWith(expect.any(Function));
	});

	it('should call registered handlers with the correct parameters', async () => {
		const manager = new NotificationService(mockConnection, mockLoggingService);
		const handler1 = vi.fn();
		const handler2 = vi.fn();

		manager.on('test', handler1);
		manager.on('test', handler2);

		const onNotificationHandler = mockConnectionBase.onNotification.mock.calls[0][1];

		await onNotificationHandler({ prop: 'test' }, 'test');

		expect(mockConnection.onNotification).toHaveBeenCalledTimes(1);
		expect(mockConnection.onNotification).toHaveBeenCalledWith('test', expect.any(Function));
		expect(handler1).toHaveBeenCalledTimes(1);
		expect(handler1).toHaveBeenCalledWith({ prop: 'test' }, 'test');
		expect(handler2).toHaveBeenCalledTimes(1);
		expect(handler2).toHaveBeenCalledWith({ prop: 'test' }, 'test');
	});

	it('should call registered star handlers with the correct parameters', async () => {
		const manager = new NotificationService(mockConnection, mockLoggingService);
		const handler1 = vi.fn();
		const handler2 = vi.fn();

		manager.on(handler1);
		manager.on(handler2);

		const onNotificationHandler = mockConnectionBase.onNotification.mock.calls[0][0];

		await onNotificationHandler({ prop: 'test' }, 'test');

		expect(mockConnection.onNotification).toHaveBeenCalledTimes(1);
		expect(mockConnection.onNotification).toHaveBeenCalledWith(expect.any(Function));
		expect(handler1).toHaveBeenCalledTimes(1);
		expect(handler1).toHaveBeenCalledWith({ prop: 'test' }, 'test');
		expect(handler2).toHaveBeenCalledTimes(1);
		expect(handler2).toHaveBeenCalledWith({ prop: 'test' }, 'test');
	});

	it('should throw if no handler is provided', () => {
		const manager = new NotificationService(mockConnection, mockLoggingService);

		expect(() => manager.on('test' as never)).toThrow('Handler must be defined');
		expect(() => manager.on(undefined as never)).toThrow('Handler must be defined');
	});

	it('should log an error if any handler throws', async () => {
		const manager = new NotificationService(mockConnection, mockLoggingService);
		const error = new Error('test');
		const handler = vi.fn().mockImplementation(() => {
			throw error;
		});

		manager.on(handler);
		manager.on('test', handler);

		const onStarNotificationHandler = mockConnectionBase.onNotification.mock.calls[0][0];

		await onStarNotificationHandler({ prop: 'test' }, 'test');

		const onNotificationHandler = mockConnectionBase.onNotification.mock.calls[1][1];

		await onNotificationHandler({ prop: 'test' }, 'test');

		expect(mockLogger.error).toHaveBeenCalledTimes(2);
		expect(mockLogger.error).toHaveBeenCalledWith('Error handling notification', {
			notificationType: '<all>',
			error,
		});
		expect(mockLogger.error).toHaveBeenCalledWith('Error handling notification', {
			notificationType: 'test',
			error,
		});
	});

	it('should return disposables when registering notifications', () => {
		const manager = new NotificationService(mockConnection, mockLoggingService);
		const disposable = manager.on('test', () => undefined);

		expect(disposable).toHaveProperty('dispose');
		expect(disposable.dispose).toBeInstanceOf(Function);
	});

	it("should deregister the notification handler when disposing a notification's disposable", () => {
		const manager = new NotificationService(mockConnection, mockLoggingService);
		const handler = vi.fn();

		manager.on('test', handler).dispose();

		const onNotificationHandler = mockConnectionBase.onNotification.mock.calls[0][1];

		onNotificationHandler({ prop: 'test' }, 'test');

		expect(handler).not.toHaveBeenCalled();
	});

	it('should be disposable', () => {
		const manager = new NotificationService(mockConnection, mockLoggingService);

		expect(manager).toHaveProperty('dispose');
		expect(manager.dispose).toBeInstanceOf(Function);
	});

	it('should dispose of all notification handlers when disposed', () => {
		const manager = new NotificationService(mockConnection, mockLoggingService);
		const handler1 = vi.fn();
		const handler2 = vi.fn();

		manager.on('test', handler1);
		manager.on(handler2);

		manager.dispose();

		const onNotificationHandler =
			mockConnectionBase.onNotification.mock.calls[
				mockConnectionBase.onNotification.mock.calls.length - 2
			][1];
		const onStarNotificationHandler =
			mockConnectionBase.onNotification.mock.calls[
				mockConnectionBase.onNotification.mock.calls.length - 1
			][0];

		onNotificationHandler({ prop: 'test' }, 'test');
		onStarNotificationHandler({ prop: 'test' }, 'test');

		expect(handler1).not.toHaveBeenCalled();
		expect(handler2).not.toHaveBeenCalled();
	});
});
