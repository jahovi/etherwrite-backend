import {DocumentViewResponse} from "nano";
import couchDbService from "../couch/couch-db.service";
import AuthorRegistry from "../../author-registry";
import LogService from "../log/log.service";
import {PadGroupedFormat} from "./pad-grouped-format.interface";

/**
 * Class to retrieve data about number of characters by each author and total characters in each pad from the db,
 * calculate ratios from these numbers and pack the data in a convenient format to be processed and visualized
 * in the frontend.
 */
export default class AuthoringRatiosCalculator {
	private dbConnection;

	public constructor() {
		this.dbConnection = couchDbService.getConnection("etherpad");
	}

	/**
	 * Queries the views defined in authoring-ratios-view.ts to calculate authoring ratios per author and pad,
	 * and packs the data in a convenient format. An authoring ratio is defined as the number of characters written
	 * by the user that currently exist in the pad, divided by the total number of characters currently existing in the pad.
	 * The number is convertet to a percentage and rounded to two decimals.
	 * @returns Authors and corresponding moodle IDS, ratios and colors grouped by pad
	 */
	public async calculateAuthoringRatios() {
		// Might alter these requests to only return data on a specific pad to increase performance
		const charsPerAuthorAndPadResponse: DocumentViewResponse<number, unknown> = await couchDbService.readView(this.dbConnection, "authoring_ratios", "chars_per_author_and_pad", {group_level: 2});
		const totalCharsPerPadResponse: DocumentViewResponse<number, unknown> = await couchDbService.readView(this.dbConnection, "authoring_ratios", "total_chars_per_pad");

		// Pack the data in a preliminary format that will be easier to repack into the various other formats that might be requested by the frontend devs. May ditch for performance
		const result: TupleFormat[] = [];
		for (const row of charsPerAuthorAndPadResponse.rows) {
			const pad = row.key[0];
			const authorId = row.key[1];	// etherpad author
			const author = AuthorRegistry.knownAuthors[authorId];
			if (!author) {
				LogService.error(AuthoringRatiosCalculator.name, `Color not found for author ${author}`);
			}
			const authoredChars = Math.max(row.value, 0);
			const totalCharsInPad = totalCharsPerPadResponse.rows.find(({key}) => key === pad)?.value; // the find expression finds the object in the array containing the total num of chars for the pad in question
			if (!totalCharsInPad) {
				throw new Error(`Total number of chars not found for pad ${pad}`);
			}
			let authoringRatio = 0;
			if (totalCharsInPad !== 0) { // else all ratios will be 0
				authoringRatio = Number((authoredChars / totalCharsInPad * 100).toFixed(2)); // convert ratio to percentage with two decimals
			}
			result.push(new TupleFormat(pad, author.epalias || "(kein Name)", author.mapper2author || "", authoringRatio, author.color));
		}
		// Repack into final format and return
		return this.tupleToPadGroupedFormat(result);
	}

	/**
	 * Helper function to extract an array of unique padnames
	 * @param tupleFormatArray Pad, Author, Ratio, Color Data in Tuple format
	 * @returns a set of unique pad names
	 */
	private getPadList(tupleFormatArray: TupleFormat[]): string[] {
		const padsArray = [];
		for (const element of tupleFormatArray) {
			padsArray.push(element.pad);
		}
		return [...new Set(padsArray)];
	}

	/**
	 * Repacks the tuple format into a format requested by the frontend dev.
	 * @param tupleFormatArray Pad, Author, moodleID, Ratio, Color Data in Tuple format
	 * @returns Same data converted to PadGroupedFormat (as defined in the interface of the same name)
	 */
	private tupleToPadGroupedFormat(tupleFormatArray: TupleFormat[]): PadGroupedFormat {
		const result: PadGroupedFormat = {};
		const padList = this.getPadList(tupleFormatArray);
		for (const pad of padList) {
			const tuplesForPad = tupleFormatArray.filter(elem => elem.pad === pad);
			const authors = [];
			const moodleIDs = [];
			const ratios = [];
			const colors = [];
			for (const elem of tuplesForPad) {
				authors.push(elem.author);
				moodleIDs.push(elem.moodleID);
				ratios.push(elem.ratio);
				colors.push(elem.color);
			}
			result[pad] = {authors: authors, moodleIDs: moodleIDs, ratios: ratios, colors: colors};
		}
		return result;
	}
}

class TupleFormat {
	pad: string;
	author: string;
	moodleID: string;
	ratio: number;
	color: string;

	constructor(pad: string, author: string, moodleID: string, ratio: number, color: string) {
		this.pad = pad;
		this.author = author;
		this.moodleID = moodleID;
		this.ratio = ratio;
		this.color = color;
	}
}
