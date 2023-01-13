import {DocumentViewResponse} from "nano";
import couchDbService from "../../core/couch/couch-db.service";
import LogService from "../../core/log/log.service";

export default class CharsAndWordsInPadCalculator {
	private readonly dbConnection;

	/**
	 * Init db connection and trigger update of num chars and words in pads.
	 */
	public constructor() {
		this.dbConnection = couchDbService.getConnection("etherpad");
	}

	/**
	 * @param pad The pad for which to retrieve the number of chars and words.
	 * @returns A promise to eventually return the data when they come in from the db.
	 */
	public async getNumCharsAndWordsInPadEventually(pad: string): Promise<number[]> {
		const charsAndWordsPerPadResponse: DocumentViewResponse<any, any> = await couchDbService.readView(this.dbConnection, "authoring_ratios", "chars_and_words_per_pad");
		let numChars: number;
		let numWords: number;
		const rowOfPad = charsAndWordsPerPadResponse.rows.find(({key}) => key === pad);
		if (rowOfPad === undefined) {
			LogService.error(CharsAndWordsInPadCalculator.name, `Could not get number of chars and words for ${pad}`);
			return [0, 0];
		} else {
			[numChars, numWords] = rowOfPad.value;
			return [numChars, numWords]
		}
	}
}
