import type { Connection } from 'vscode-languageserver';
import type winston from 'winston';
import { NotificationManager } from '../notification-manager';

const mockConnectionBase = {
	onNotification: jest.fn(),
};

const mockConnection = mockConnectionBase as unknown as jest.Mocked<Connection>;

const mockLogger = {
	error: jest.fn(),
	debug: jest.fn(),
} as unknown as winston.Logger;

describe('NotificationManager', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should be constructable', () => {
		expect(new NotificationManager(mockConnection)).toBeDefined();
		expect(new NotificationManager(mockConnection, mockLogger)).toBeDefined();
	});

	it('should accept handlers', () => {
		const manager = new NotificationManager(mockConnection);
		const handler = jest.fn();

		expect(() => manager.on('test', handler)).not.toThrow();
	});

	it('should accept star handlers', () => {
		const manager = new NotificationManager(mockConnection);
		const handler = jest.fn();

		expect(() => manager.on(handler)).not.toThrow();
	});

	it('should register a handler with the connection', () => {
		const manager = new NotificationManager(mockConnection);
		const handler1 = jest.fn();
		const handler2 = jest.fn();

		manager.on('test', handler1);
		manager.on('test', handler2);

		expect(mockConnection.onNotification).toHaveBeenCalledTimes(1);
		expect(mockConnection.onNotification).toHaveBeenCalledWith('test', expect.any(Function));
	});

	it('should register a star handler with the connection', () => {
		const manager = new NotificationManager(mockConnection);
		const handler1 = jest.fn();
		const handler2 = jest.fn();

		manager.on(handler1);
		manager.on(handler2);

		expect(mockConnection.onNotification).toHaveBeenCalledTimes(1);
		expect(mockConnection.onNotification).toHaveBeenCalledWith(expect.any(Function));
	});

	it('should call registered handlers with the correct parameters', async () => {
		const manager = new NotificationManager(mockConnection);
		const handler1 = jest.fn();
		const handler2 = jest.fn();

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
		const manager = new NotificationManager(mockConnection);
		const handler1 = jest.fn();
		const handler2 = jest.fn();

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
		const manager = new NotificationManager(mockConnection);

		expect(() => manager.on('test' as never)).toThrowErrorMatchingInlineSnapshot(
			`"Handler must be defined"`,
		);
		expect(() => manager.on(undefined as never)).toThrowErrorMatchingInlineSnapshot(
			`"Handler must be defined"`,
		);
	});

	it('should log an error if any handler throws', async () => {
		const manager = new NotificationManager(mockConnection, mockLogger);
		const error = new Error('test');
		const handler = jest.fn().mockImplementation(() => {
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
		const manager = new NotificationManager(mockConnection);
		const disposable = manager.on('test', () => undefined);

		expect(disposable).toHaveProperty('dispose');
		expect(disposable.dispose).toBeInstanceOf(Function);
	});

	it("should deregister the notification handler when disposing a notification's disposable", () => {
		const manager = new NotificationManager(mockConnection);
		const handler = jest.fn();

		manager.on('test', handler).dispose();

		const onNotificationHandler = mockConnectionBase.onNotification.mock.calls[0][1];

		onNotificationHandler({ prop: 'test' }, 'test');

		expect(handler).not.toHaveBeenCalled();
	});

	it('should be disposable', () => {
		const manager = new NotificationManager(mockConnection);

		expect(manager).toHaveProperty('dispose');
		expect(manager.dispose).toBeInstanceOf(Function);
	});

	it('should dispose of all notification handlers when disposed', () => {
		const manager = new NotificationManager(mockConnection);
		const handler1 = jest.fn();
		const handler2 = jest.fn();

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
