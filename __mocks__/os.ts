const os = jest.requireActual('os');

/**
 * Mock platform.
 */
let mockPlatform: NodeJS.Platform = 'linux';

/**
 * Mock EOL.
 */
let mockEOL = '\n';

/**
 * Sets the mock platform.
 */
os.__mockPlatform = (platform: NodeJS.Platform): void => {
	mockPlatform = platform;
	mockEOL = platform === 'win32' ? '\r\n' : '\n';
};

os.platform = () => mockPlatform;

Object.defineProperty(os, 'EOL', {
	get: () => mockEOL,
});

export = os;
