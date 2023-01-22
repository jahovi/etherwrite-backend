import AuthorRegistry from "../core/authors/author-registry";
import PadRegistry from "../pads";
import MinimapService from "../minimap-service/minimap-service";
import { AuthoringRatios } from "./authoring-ratios.type";
import { MiniMapDataUnit } from "../minimap-service/mini-map-data-unit.type";

/**
 * Class to retrieve data about number of characters by each author and total characters in each pad from the db,
 * calculate ratios from these numbers and pack the data in a convenient format to be processed and visualized
 * in the frontend.
 */
export default class AuthoringRatiosCalculator {

	/**
	 * Calculates authoring ratios for the given pad. An authoring ratio is defined as the number of characters written
	 * by the user that currently exist in the pad, divided by the total number of characters currently existing in the pad.
	 * The number is converted to a percentage and rounded to two decimals.
	 * 
	 * @param padName pad for which to calculate ratios
	 * @returns an object containing corresponding arrays of usernames, moodleIDs, ratios, colors
	 */
	public async calculate(padName: string): Promise<AuthoringRatios> {
		let minimapService = MinimapService.instances[padName];
		if (!minimapService) {
			try {
				minimapService = await PadRegistry.getServiceInstance(MinimapService.instances, padName);
			} catch {
				return { authors: [], moodleIDs: [], ratios: [], colors: [] };
			}
		}
		const blocks = minimapService.getSubjectData();
		const authors = [...new Set(blocks.map(block => block.author))];
		const colors = authors.map(author => AuthorRegistry.knownAuthors[author].color);
		const moodleIDs = authors.map(author => AuthorRegistry.knownAuthors[author].mapper2author)
		const usernames = authors.map(author => AuthorRegistry.knownAuthors[author].epalias)

		// calculate authoring ratios
		const totalNumChars = blocks
			.map(block => block.blockLength)
			.reduce((acc, curr) => acc + curr, 0);

		const ratios = []
		for (let i = 0; i < authors.length; i++) {
			let numChars = 0;
			for (const block of blocks) {
				if (block.author === authors[i]) {
					numChars += block.blockLength;
				}
			}
			ratios[i] = 0;
			if (totalNumChars !== 0) {
				ratios[i] = Number((numChars / totalNumChars * 100).toFixed(2));
			}
		}

		return { authors: usernames, moodleIDs: moodleIDs, ratios: ratios, colors: colors };
	}

	/**
	 * Calculates authoring ratios from minimap block data.
	 * 
	 * @param blocks Minimap block data
	 * @returns Authoring ratios calculated from block data
	 */
	public static calculateFromBlocks(blocks: MiniMapDataUnit[]): AuthoringRatios {
		const authors = [...new Set(blocks.map(block => block.author))];
		const colors = authors.map(author => AuthorRegistry.knownAuthors[author].color);
		const moodleIDs = authors.map(author => AuthorRegistry.knownAuthors[author].mapper2author)
		const usernames = authors.map(author => AuthorRegistry.knownAuthors[author].epalias) // epalias is in fact the moodle username

		// calculate authoring ratios
		const totalNumChars = blocks
			.map(block => block.blockLength)
			.reduce((acc, curr) => acc + curr);

		const ratios = []
		for (let i = 0; i < authors.length; i++) {
			let numChars = 0;
			for (const block of blocks) {
				if (block.author === authors[i]) {
					numChars += block.blockLength;
				}
			}
			ratios[i] = 0;
			if (totalNumChars !== 0) {
				ratios[i] = Number((numChars / totalNumChars * 100).toFixed(2));
			}
		}

		return { authors: usernames, moodleIDs: moodleIDs, ratios: ratios, colors: colors };
	}
}
