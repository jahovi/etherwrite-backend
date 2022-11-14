import { DocumentViewResponse } from "nano";
import couchDbService from "../couch/couch-db.service";

/**
 * Class to retrieve data about number of characters by each author and total characters in each pad from the db,
 * calculate ratios from these numbers and pack the data in a convenient format to be processed and visualized 
 * in the frontend. Candidate for a static class?
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
	 * @returns Authors and corresponding moodle IDS, ratios and colors grouped by pad
	 */
	public async calculateAuthoringRatios() {
		// Might alter these requests to only return data on a specific pad to increase performance
		const charsPerAuthorAndPadResponse: DocumentViewResponse<number, unknown> = await this.dbConnection.view("authoring_ratios", "chars_per_author_and_pad", { group_level: 2 });
		const totalCharsPerPadResponse: DocumentViewResponse<number, unknown> = await this.dbConnection.view("authoring_ratios", "total_chars_per_pad");
		const authorColorRespone: DocumentViewResponse<string, unknown> = await this.dbConnection.view("authoring_ratios", "author_colors");
		const mapper2AuthorResponse: DocumentViewResponse<string, unknown> = await this.dbConnection.view("evahelpers", "fetchmapper2authordata");

		// Pack the data in a preliminary format that will be easier to repack into the various other formats that might be requested by the frontend devs. Ditch for performance?
		const result: TupleFormat[] = [];
		for (const row of charsPerAuthorAndPadResponse.rows) {
			const pad = row.key[0];
			const author = row.key[1];	// etherpad author
			let moodleID = mapper2AuthorResponse.rows.find(({key}) => key === author)?.value; // find the object in the rows array containing the mappint for the author in question
			if (!moodleID) moodleID = ""; // if no mapping is found, set an empty id
			const authoredChars = row.value;
			const totalCharsInPad = totalCharsPerPadResponse.rows.find(({ key }) => key === pad)?.value; // the find expression finds the object in the array containing the total num of chars for the pad in question
			const color = authorColorRespone.rows.find(({ key }) => key === author)?.value;
			if (!totalCharsInPad) {
				throw new Error(`Total number of chars not found for pad ${pad}`);
			} else if (!color) {
				throw new Error(`Color not found for author ${author}`)
			} else {
				let authoringRatio = 0;
				if (totalCharsInPad !== 0) { // else all ratios will be 0
					authoringRatio = authoredChars / totalCharsInPad;
				}
				result.push(new TupleFormat(pad, author, moodleID, authoringRatio, color));
			}
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
	private tupleToPadGroupedFormat(tupleFormatArray: TupleFormat[]) {
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
			result[pad] = { authors: authors, moodleIDs: moodleIDs, ratios: ratios, colors: colors };
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

/**
 * Example of an Object in this format:
 * {
 * 		nameOfFirstPad: { 
			authors: [nameAuthor1, nameAuthor2, ...],
			ratios: [ratioAutor1, ratioAutor2, ...],
			colors: [colorAutor1, colorAutor2, ...]
  		}
  		nameOfSecondPad: {
			authors: [nameAuthor1, nameAuthor2, ...],
			ratios: [ratioAutor1, ratioAutor2, ...],
			colors: [colorAutor1, colorAutor2, ...]
  		}
  ...
	}
 */
interface PadGroupedFormat {
	[pad: string]: { authors: string[], moodleIDs: string[], ratios: number[], colors: string[] };
}

