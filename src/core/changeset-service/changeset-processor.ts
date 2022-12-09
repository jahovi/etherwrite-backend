/* eslint-disable no-mixed-spaces-and-tabs */
import Changeset from "../../changeset/Changeset";
import CouchDbService from "../couch/couch-db.service";
import PadInfo from "./padinfo.interface";
import PadRev from "./pad-rev.interface";
import AuthorRegistry from "../../author-registry";
import logService from "../log/log.service";
import RevData from "./rev-data-interface";

/**
 * A Service that gathers the changesets and other information in 
 * regard to a specific pad from the CouchDB.
 * Instances of this class are meant to support subclasses of the
 * CS_Subscriber class. These will be automatically be registered
 * as subscribers to ChangesetProcessor and will receive a callback
 * every time when new revision data was found in CouchDB.
 */
export default class ChangesetProcessor {

	/**Grants access to every created instance of this class*/
	public static readonly instanceRegistry: { [padName: string]: ChangesetProcessor } = {};
	public static readonly unknownAuthor = "-unknown-";

	/** The minimum timespan in milliseconds, before a check for newer 
	data from CouchDB is made*/
	public static readonly blocksUpdateDelay = Number(process.env.CSP_UPDATE_DELAY) || 5000;

	/** The name of the etherpad, that this instance provides services for*/
	public readonly padName: string;
	/** The number of the newest rev dataset, that has been acquired from CouchDB*/
	public listRevStatus = -1; // 

	/**Contains the most recent version of basic information regarding that etherpad */
	public padInfo?: PadInfo;

	/**Contains all known changesets, that could be retrieved from the database */
	public revData: RevData = {};

	/** The keys of authors in the numToAttrib of the pad */
	public authorKeys: string[] = [];
	/** Contains the attribute key if an anonymous author is used by etherpad
		to designate a char as colorless  */
	public blankKey = "";
	/** Contains the timestamp from the last Changeset that was caused by this author */
	public lastActivityTimeStamp: { [key: string]: number } = {};

	public attrToAuthorMapping: { [key: string]: string } = {};
	public attrToHeadingMapping: { [key: string]: string } = {};

	private docScope = CouchDbService.getConnection("etherpad");
	private padHead = 0; // indicates the newest pad:[name]:revs:[padHead]

	private subscriberCallbacks: Function[] = [];
	private lastSubscriberRevUpdate = 0;


	/**
	 * @param padName the name of the etherpad that this instance will provide services for
	 */
	public constructor(padName: string) {
		this.padName = padName;
		if (!ChangesetProcessor.instanceRegistry[padName]) {
			ChangesetProcessor.instanceRegistry[padName] = this;
		}
		this.initialise();
	}

	/**Only called once in the constructor.
	 */
	private async initialise() {
		await this.checkNewInfoInDataBase();
		await this.getRevs();
		setInterval(() =>
			this.prepareUpdate(), ChangesetProcessor.blocksUpdateDelay);
	}


	/**
	 * Call this once on the corresponding instance
	 * from ChangesetProcessor.instanceRegisty[padName]
	 * @param instance 
	 */
	public subscribe(callback: Function) {
		this.subscriberCallbacks.push(callback);
	}

	private notifySubscribers() {
		this.subscriberCallbacks.forEach(call => call());
	}

	/**Call this only after the timespan set in
	 * the 'blocksUpdateDelay' attribute has passed.
	 *
	 * This will cause requests for new information
	 * from the database and then build an expansion
	 * of the linked list.
	 */
	private async prepareUpdate() {
		await this.checkNewInfoInDataBase();
		await this.getRevs();

		/* Subscribers will receive a callback only if 
		there is any new Rev-Dataset*/
		if (this.padHead > this.lastSubscriberRevUpdate) {
			this.notifySubscribers();
			this.lastSubscriberRevUpdate = this.padHead;
		}
	}

	/**Checks the 'root-document' of our database for
	 * new infos regarding updates in the text and
	 * new author data.
	 *
	 * The AuthorRegistry will be triggered
	 * by this method to look for updated
	 * info regarding the authors in this pad in the
	 * database.
	 */
	private async checkNewInfoInDataBase() {
		const padInfo = await this.docScope.get("pad:" + this.padName);
		this.padInfo = padInfo as PadInfo;
		this.padHead = this.padInfo.value.head;
		for (let i = 0; i < this.padInfo.value.pool.nextNum; i++) {
			const entry = this.padInfo.value.pool.numToAttrib[String(i)];
			if (entry[0] == "author") {
				if (entry[1] != "") {
					if (!this.authorKeys.includes(String(i))) {
						this.authorKeys.push(String(i));
					}
					AuthorRegistry.put(entry[1]);
					if (!this.lastActivityTimeStamp[entry[1]]) {
						this.lastActivityTimeStamp[entry[1]] = 0;
					}
				} else {
					this.blankKey = String(i);
				}
				if (!this.attrToAuthorMapping[String(i)]) {
					this.attrToAuthorMapping[String(i)] = entry[1];
				}
			}
			if (entry[0] == "heading") {
				if (!this.attrToHeadingMapping[String(i)]) {
					this.attrToHeadingMapping[String(i)] = entry[1];
				}
			}
		}
	}


	/**This will take care so that all new revs
	 * we haven´t loaded from the database yet
	 * will be retrieved and saved to
	 * 'this.revData' under their index number as key.
	 */
	private async getRevs() {
		const promises: Promise<void>[] = [];
		for (let i = this.listRevStatus + 1; i <= (this.padHead ? this.padHead : 0); i++) {
			promises.push(this.getRev(i));
		}

		await Promise.all(promises);
	}

	/**This method is only internally called
	 * by the 'getRevs()' method.
	 *
	 * @param revNumber
	 */
	private async getRev(revNumber: number) {
		const data = await this.docScope?.get("pad:" + this.padName + ":revs:" + revNumber);
		const revData = data as PadRev;
		const cs = Changeset.unpack(revData.value.changeset);
		this.revData[revNumber] = { cset: cs, author: revData.value.meta.author, timestamp: revData.value.meta.timestamp };
	}

	/**Transforms the attribs string from
	 * an op into a list. Should be obtained 
	 * after performing a Changeset.deserialize operation. 
	 * 
	 * This method contains an IMPORTANT bugfix. It is
	 * strongly advised to always use this methode before
	 * trying to access the numToAttribs-property of padInfo!
	 * 
	 * @param attribs 
	 * @returns a list of attributes
	 */
	public attribsToList(attribs: string): string[] {
		const list: string[] = [];
		attribs.substring(1, attribs.length).split("*").forEach(n => list.push(String(parseInt(n, 36))));
		return list;
	}

	/** The attribs-input data should be obtained 
	 * after performing a Changeset.deserialize operation
	 *
	 * @param attribs the attribs string from an op
	 * @returns the id of the first author attribute found, excluding the blank author.
	 * @throws error, if no author is found
	 */
	public extractAuthorKeyFromAttribs(attribs: string): string {
		if (attribs == "") {
			throw new Error("no author attrib");
		}
		let out = "";
		this.attribsToList(attribs).forEach(entry => {
			if (this.authorKeys.includes(entry) && out == "") {
				out = entry;
			}
		});
		if (out == "") {
			throw new Error("no author attrib");
		}
		return out;
	}

	/**The attribs-input data should be obtained 
	 * after performing a Changeset.deserialize operation
	 * 
	 * @param attribs the attribs string from an op
	 * @returns the attribute key of a heading or ""
	 */
	public extractHeadingKeyFromAttribs(attribs: string): string {
		let out = "";
		this.attribsToList(attribs).forEach(entry => {
			if (this.attrToHeadingMapping[entry]) {
				out = this.attrToHeadingMapping[entry];
			}
		})
		return out;
	}

	/**Allows convenient access to the numToAttrib
	 * section of padInfo
	 *
	 * @param key
	 * @param index
	 * @returns data
	 */
	public getFromNumToAttrib(key: string, index: number) {
		if (this.padInfo) {
			const attrs = this.padInfo.value.pool.numToAttrib;
			const entry = attrs[key];
			return entry[index];
		}
		logService.warn(ChangesetProcessor.name + " " + this.padName, "padInfo not initialised");
		return "";
	}

	/**
	 *
	 * @returns author data stored in the padInfo property
	 */
	public getAuthorAttribMapping() {
		const out = [];
		if (this.padInfo)
			for (const key in this.authorKeys) {
				const data = { [key]: this.padInfo.value.pool.numToAttrib[key] };
				out.push(data);

			}
		return out;
	}

}