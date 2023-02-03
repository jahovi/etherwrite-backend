/* eslint-disable no-mixed-spaces-and-tabs */
import Changeset from "../../changeset/Changeset";
import CouchDbService from "../couch/couch-db.service";
import PadInfo from "./padinfo.interface";
import PadRev from "./pad-rev.interface";
import logService from "../log/log.service";
import {RevData} from "./rev-data.type";
import {Subject} from "../subscriber/subject";
import DbChange from "../../websocket/dbchange.interface";
import DbDocs from "../../websocket/dbdocs";

/**
 * A Service that gathers the changesets and other information in
 * regard to a specific pad from the CouchDB.
 * Instances of this class are meant to support subclasses of the
 * AbstractChangesetSubscriber class. These will be automatically be registered
 * as subscribers to ChangesetService and will receive a callback
 * every time when new revision data was found in CouchDB.
 */
export default class ChangesetService extends Subject<Record<number, RevData>> {

	/**Grants access to every created instance of this class*/
	public static readonly instanceRegistry: Record<string, ChangesetService> = {};

	/** The name of the etherpad, that this instance provides services for*/
	public readonly padName: string;

	/**Contains the most recent version of basic information regarding that etherpad */
	public padInfo?: PadInfo;

	/**Contains all known changesets, that could be retrieved from the database */
	public revData: Record<number, RevData> = {};

	/** The keys of authors in the numToAttrib of the pad */
	public authorKeys: string[] = [];
	/** Contains the attribute key if an anonymous author is used by etherpad
		to designate a char as colorless  */
	public blankKey = "";
	/** Contains the timestamp from the last Changeset that was caused by this author */
	public lastActivityTimeStamp: Record<string, number> = {};

	public attrToAuthorMapping: Record<string, string> = {};
	public attrToHeadingMapping: Record<string, string> = {};

	private docScope = CouchDbService.getConnection("etherpad");
	private padHead = 0; // indicates the newest pad:[name]:revs:[padHead]

	private lastSubscriberRevUpdate = -1;

	/**
	 * Returns the data that subscribers should receive.
	 */
	public getSubjectData(): Record<number, RevData> {
		return this.revData;
	}

	/**
	 * @param padName the name of the etherpad that this instance will provide services for
	 */
	public constructor(padName: string) {
		super();
		this.padName = padName;
		ChangesetService.instanceRegistry[padName] = this;

		// First initial update.
		this.prepareUpdate();
		// After this, only update on new database changes.
		CouchDbService.subscribeChanges(this.docScope, (change: DbChange) => {
			if (DbDocs.padDoc.test(change.id) && change.id.includes(padName)) {
				this.prepareUpdate();
			}
		})
	}

	/**
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
			if (entry[0] === "author") {
				if (entry[1] !== "") {
					if (!this.authorKeys.includes(String(i))) {
						this.authorKeys.push(String(i));
					}
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
	 * we haven't loaded from the database yet
	 * will be retrieved and saved to
	 * 'this.revData' under their index number as the key.
	 */
	private async getRevs() {
		let startKey = (this.lastSubscriberRevUpdate + 1).toString(36);
		while (startKey.length < 6) {
			startKey = "0" + startKey;
		}
		startKey = this.padName + ":" + startKey;
		const endKey = this.padName + ":zzzzzz";
		const data = await CouchDbService.readView(this.docScope, "evahelpers", "fetchrevdata", {start_key: startKey, end_key: endKey});
		data.rows.forEach(row => {
			const revData = row.value as PadRev;
			const cs = Changeset.unpack(revData.value.changeset);
			const revNumber = parseInt(row.key.split(":")[1], 36);
			this.revData[revNumber] = {cset: cs, author: revData.value.meta.author, timestamp: revData.value.meta.timestamp};
		})
	}

	/**Transforms the attribs string from
	 * an op into a list. Should be obtained
	 * after performing a {@link Changeset.deserialize} operation.
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
		while (list[0] === "NaN")
			list.shift();
		return list;
	}

	/** The attribs-input data should be obtained
	 * after performing a {@link Changeset.deserialize} operation
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

	/** The attribs-input data should be obtained
	 * after performing a {@link Changeset.deserialize} operation
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
		if (!this.padInfo) {
			logService.warn(ChangesetService.name + " " + this.padName, "padInfo not initialised");
			throw new Error(`Pad value for ${key} not found.`);
		}

		const attrs = this.padInfo.value.pool.numToAttrib;
		const entry = attrs[key];
		const value = entry[index];
		if (value == "") {
			throw new Error(`Pad value for ${key} not found.`);
		}
		return value;
	}
}