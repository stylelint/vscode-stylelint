'use strict';

/**
 * Returns the intersection of the given sets. If one of the sets is
 * `undefined`, the other set is returned. If both sets are `undefined`,
 * returns `undefined`.
 * @template T
 * @param {Set<T> | undefined} set1
 * @param {Set<T> | undefined} set2
 * @returns {Set<T> | undefined}
 */
function intersect(set1, set2) {
	if (!set1) {
		return set2;
	}

	if (!set2) {
		return set1;
	}

	const [smallerSet, largerSet] = set1.size < set2.size ? [set1, set2] : [set2, set1];

	const result = new Set();

	for (const item of smallerSet) {
		if (largerSet.has(item)) {
			result.add(item);
		}
	}

	return result;
}

module.exports = {
	intersect,
};
