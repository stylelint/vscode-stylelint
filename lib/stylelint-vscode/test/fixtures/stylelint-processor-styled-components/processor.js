module.exports = function noopProcessor() {
	return {
		code(input) {
			return input;
		},
		result(result) {
			return result;
		}
	};
};
