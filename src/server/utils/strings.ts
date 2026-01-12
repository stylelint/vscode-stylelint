/**
 * Upper-cases the first letter of a string.
 */
export const upperCaseFirstChar = (str: string): string => {
	return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Pads a string to a certain length with spaces.
 */
export const padString = (str: string, length: number): string => {
	return str + ' '.repeat(length - str.length);
};

/**
 * Pads a number to a certain length with zeros.
 */
export const padNumber = (number: number, length: number): string => {
	const str = String(number);

	return '0'.repeat(length - str.length) + str;
};
