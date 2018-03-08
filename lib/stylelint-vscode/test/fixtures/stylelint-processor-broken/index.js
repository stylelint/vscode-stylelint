module.exports = function brokenProcessor() {
	return {
		code() {
			throw new Error('Error for stylelint-vscode test');
		}
	};
};
