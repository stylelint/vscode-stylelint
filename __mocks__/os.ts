const os = jest.requireActual('os');

/**
 * Mock platform.
 */
let mockPlatform: NodeJS.Platform = 'linux';

/**
 * Sets the mock platform.
 */
os.__mockPlatform = (platform: NodeJS.Platform): void => {
	mockPlatform = platform;
};

os.platform = () => mockPlatform;

export = os;
