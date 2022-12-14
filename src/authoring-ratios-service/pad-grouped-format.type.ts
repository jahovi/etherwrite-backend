/**
 * Example of an Object in this format:
 * {
 * 		nameOfFirstPad: {
			authors: [nameAuthor1, nameAuthor2, ...],
			moodleIDs: [moodleIDAuthor1, moodleIDAuthor2, ...],
			ratios: [ratioAutor1, ratioAutor2, ...],
			colors: [colorAutor1, colorAutor2, ...]
  		}
  		nameOfSecondPad: {
			authors: [nameAuthor1, nameAuthor2, ...],
			moodleIDs: [moodleIDAuthor1, moodleIDAuthor2, ...],
			ratios: [ratioAutor1, ratioAutor2, ...],
			colors: [colorAutor1, colorAutor2, ...]
  		}
  ...
	}
 */
export type PadGroupedFormat = Record<string, {
	authors: string[];
	moodleIDs: string[];
	ratios: number[];
	colors: string[];
}>;

