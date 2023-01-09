import AbstractChangesetSubscriber from "../core/changeset-service/abstract-changeset-subscriber";
import CohList from "./coh-list";
import Changeset, { Op } from "../changeset/Changeset";
import CSRaw from "../core/changeset-service/csraw.interface";
import { Paragraph, Node, NodeDistance, NodeConnection, CohDiagramData } from "./coh-interfaces";
import { LoginData, ScrollEvent } from "../core/tracking-service/coh-interfaces";
import TrackingService from "../core/tracking-service/tracking-service";
import { InteractionCounter, LoginDataHandler } from "./coh-service-helpers";
import AuthorRegistry from "../core/authors/author-registry";
import { DateService } from "../core/util/date.service";


/**A Service class that gathers data from the ChangesetProcessor and the 
 * TrackingService in order to provide the backend data required for the
 * cohesion diagram. 
 */
export default class CohesionDiagramService extends AbstractChangesetSubscriber {

	/**
	 * Contains all instances of 
	 */
	public static instances: Record<string, CohesionDiagramService> = {};

	/**
	 * The linked list that stores the content of the Etherpad Editor. 
	 */
	private list: CohList = new CohList();

	/**
	 * Stores the index of the latest 
	 */
	private listRevStatus = 0;

	/**Contains the timestamps that are considered stable, 
	 * so that these timestamps are used for evaluation. 
	 */
	private stableTimeStamps: number[] = [];
	private readonly stableTimeStampInterval = 60000; // milliseconds 

	/**A helper object that consumes interaction events and
	 * will return the number of content related interactions 
	 * of each pair of authors. This includes: 
	 * - Writing text in a paragraph that was largely written by someone else
	 * - Applying text format operations that affect text written by someone else
	 * - Deleting text that was written by someone else
	 */
	private contribCounter: InteractionCounter = new InteractionCounter();

	/**A helper object that consumes text perception events and will return the 
	 * number of such events that happened between each pair of authors. 
	 */
	private perceptionCounter: InteractionCounter = new InteractionCounter();

	/**A helper object that consumes objects that represent the online
	 * timespan of users. It will return the amount of milliseconds that 
	 * each pair of authors has spent simultaneously in the text editor. 
	 */
	private loginDataHandler: LoginDataHandler = new LoginDataHandler();

	/**Is set to false, as long as the TrackingService hasn´t called back
	 * at least once. 
	  */
	private trackingDataInitComplete = false;
	private scrollData: ScrollEvent[] = [];


	constructor(padName: string) {
		super(padName);
		CohesionDiagramService.instances[padName] = this;
	}

	/**
	 * @returns The data object that contains the information
	 *  that is necessary for drawing the cohesion diagram. 
	 */
	public getCohesionData(): CohDiagramData {
		// Make sure we used the latest data we could possibly acquire. 
		this.findStableTimeStamps();
		this.buildList();

		// Retrieve the data from the helper objects. 
		const loginData = this.loginDataHandler.getScores();
		const perceptionData = this.perceptionCounter.getCounters();
		const contribData = this.contribCounter.getCounters();

		// Define, to which degree the distance properties are
		// derived from either the perception score or the 
		// login/logout data. 
		const perceptionDataWeight = 0.5; // Can be adjusted to any decimal number between 0 and 1. 
		const loginDataWeight = 1 - perceptionDataWeight;


		// We retrieve the IDs of all authors that have left their 
		// footprints in this pad according to the CouchDB
		const authors = this.dataSource.authorKeys.map(key => this.dataSource.attrToAuthorMapping[key]).sort();
		if (authors.length < 2) {
			// Return an empty object if there are not enough authors for 
			// meaningful interactions. 
			return { nodes: [], distances: [], connections: [] };
		}

		// These author IDs are the basis for creating a Node object
		// for each author. 
		const nodes: Node[] = [];
		authors.forEach(author => {
			const authorData = AuthorRegistry.knownAuthors[author];
			nodes.push({
				id: author,
				name: authorData.epalias,
				color: authorData.color,
			})
		});

		// Generate keys for each possible pair of authors,
		// matching the key convention of the helper class object. 
		const keys: string[] = [];
		authors.forEach(author => {
			authors.forEach(otherAuthor => {
				if (author < otherAuthor) {
					keys.push(author + "#" + otherAuthor);
				}
			})
		});

		// Prepare arrays for each kind of data
		const loginRawData: number[] = [];
		const perceptionRawData: number[] = [];
		const contribRawData: number[] = [];
		
		// Store the data in these lists. 
		// The indexes of the data-content are corresponding to
		// the order in which the author IDs are stored in the 
		// keys-array. 
		keys.forEach(key => {
			loginRawData.push(loginData[key] ? loginData[key] : 0);
			perceptionRawData.push(perceptionData[key] ? perceptionData[key] : 0);
			contribRawData.push(contribData[key] ? contribData[key] : 0);
		});

		// Transform the data into values in a range that fits the diagram. 
		const loginDiagramData = this.generateDistanceData(loginRawData);
		const perceptionDiagramData = this.generateDistanceData(perceptionRawData);
		const connDiagramData = this.generateConnectionData(contribRawData);
		
		
		const distances: NodeDistance[] = [];
		const connections: NodeConnection[] = [];
		for (let i = 0; i < keys.length; i++) {
			const involvedAuthors = keys[i].split("#");

			const d = loginDiagramData[i] * loginDataWeight + perceptionDiagramData[i] * perceptionDataWeight;
			distances.push({
				source: involvedAuthors[0],
				target: involvedAuthors[1],
				dist: d,
			});

			connections.push({
				source: involvedAuthors[0],
				target: involvedAuthors[1],
				intensity: connDiagramData[i],
			})
		}

		const out = { nodes: nodes, distances: distances, connections: connections };
		return out;
	}

	/**Maps the text interaction numbers to decimal numbers in
	 * the range between 0 and 1, with 1 representing the highest
	 * occurring value. All other values are calculated proportionally
	 * to the highest value. 
	 * 
	 * @param array containing one or more non negative numbers
	 * @returns an array of the same length, containing decimals between 0 and 1
	 */
	private generateConnectionData(array: number[]): number [] {
		let max = array.reduce((prev, curr) => prev > curr ? prev : curr, Number.MIN_VALUE);
		max = max <= 0 ? 1 : max;
		return array.map(n => n / max);
	}

	/**Maps the simulaneity-related scoring numbers to values 
	 * between 0.2 and 1, with 0.2 representing the highest occurring
	 * value in the input array. All other values are calculated proportionally
	 * to this. An input value of 0 will be mapped to 1. 
	 * 
	 * @param array containing one or more non negative numbers
	 * @returns an array of the same length, containing decimals between 0.2 and 1
	 */
	private generateDistanceData(array: number[]): number [] {
		let max = array.reduce((prev, curr) => prev > curr ? prev : curr, Number.MIN_VALUE);
		max = max <= 0 ? 1 : max;
		return array.map(x => 1 - (0.8 * x / max));
	}

	/**This method will be called by the TrackingService in order to
	 * unlock the initial build-up of the linked list. 
	 */
	public initTrackingData(): void {
		this.trackingDataInitComplete = true;
	}

	/**
	 * This method will be called by the TrackingService in order to
	 * hand over an array of recent scroll events. 
	 * @param scrollEvents ascendingly ordered by timestamps
	 */
	public receiveScrollData(scrollEvents: ScrollEvent[]): void {
		this.scrollData = [...this.scrollData, ...scrollEvents];
		const authorTime:Record<string,number> = {};
		const dropIndices:number[] = [];
		for(let i = this.scrollData.length-1;i>=0;i--){
			const author = this.scrollData[i].user;
			if(!authorTime[author]){
				authorTime[author] = this.scrollData[i].timestamp;
			} else {
				if(authorTime[author]-5000<this.scrollData[i].timestamp){
				// If the earlier timestamp was less than 5 seconds prior to
				// the later timestamp, then that earlier scroll event doesn´t 
				// seem meaningful enough. It is not plausible to assume that
				// the scrolling user was thouroughly reading something in
				// such a small timespan. 
					dropIndices.unshift(i);
				}
				authorTime[author] = this.scrollData[i].timestamp;
			}
		}

		for(let i = 0; i < dropIndices.length;i++){
			this.scrollData.splice(dropIndices[i]-i, 1);
		}

		// If there aren´t any revision datasets that are waiting to be
		// inserted in the linked list, then the scroll events must be
		// evaluated on the basis of the current status of the linked list.
		if(!this.dataSource.revData[this.listRevStatus+1]){
			while(this.scrollData.length > 0){
				this.handleScrollEvent();
			}
		}

	}

	/**
	 * This method will be called by the TrackingService in order to
	 * hand over an array of recent login/logout events. 
	 * Note, that no login is reported without a corresponding logout. 
	 * @param loginEvents 
	 */
	public receiveLoginData(loginEvents: LoginData[]) {
		this.loginDataHandler.receiveData(loginEvents);
	}

	dataSourceCallback(): void {
		if (!this.trackingDataInitComplete) {
			setTimeout(this.dataSourceCallback, 100);
			return;
		}
		this.findStableTimeStamps();


		// Give TrackingService the opportunity to catch up:
		setTimeout(() => {
			this.buildList();
		}, TrackingService.getUpdateDelay() + 100);
	}

	/**
	 * Iterates the linked list and looks for seenBy-entries
	 * that haven´t been counted yet. These entries will get 
	 * counted and then marked accordingly. 
	 */
	private evaluateSeenBy(): void {
		let runner = this.list.head.next;
		while (runner && runner.next) {
			if (runner.meta.seenBy.length > runner.meta.seenByEvaluated) {
				for (let i = runner.meta.seenByEvaluated; i < runner.meta.seenBy.length; i++) {
					this.perceptionCounter.notifyInteraction(runner.author, runner.meta.seenBy[i]);
				}
				runner.meta.seenByEvaluated = runner.meta.seenBy.length;
			}
			runner = runner.next;
		}
	}

	/**
	 * Scans the linked list and detects paragraphs of text. 
	 * Each paragraph is stored to a list. List objects contain
	 * the start and end indices as well as the information, to 
	 * what extent authors have contributed to a paragraph. 
	 * If one author owns more than half of all characters in a
	 * paragraph at a given time, he is considered the main contributor. 
	 * @returns a list of paragraph objects
	 */
	private detectParagraphs(): Paragraph[] {
		const out: Paragraph[] = [];
		let runner = this.list.head.next;
		if (runner === this.list.tail) {
			return [];
		}
		let index = 0;
		let author = runner?.author as string;
		let currentParagraph: Paragraph = {
			startIndex: -1,
			endIndex: -1,
			contributors: {},
			mainContributor: "",
		}

		while (runner && runner.next) {
			if (runner.content !== "\n") {
				if (currentParagraph.startIndex === -1) {
					currentParagraph.startIndex = index;
				}
				author = runner.author;
				if (currentParagraph.contributors[author]) {
					currentParagraph.contributors[author]++;
				} else {
					currentParagraph.contributors[author] = 1;
				}
			} else {
				// close current paragraph
				currentParagraph.endIndex = index;
				if (Object.keys(currentParagraph.contributors).length > 0) {
					out.push(currentParagraph);
				}
				currentParagraph = {
					startIndex: -1,
					endIndex: -1,
					contributors: {},
					mainContributor: "",
				}
			}
			runner = runner.next;
			index++;
		}
		// Close final paragraph
		if (Object.keys(currentParagraph.contributors).length > 0) {
			currentParagraph.endIndex = index;
			out.push(currentParagraph);
		}
		// Initialise main contributors
		out.forEach(paragraph => {
			const paragraphLength = paragraph.endIndex - paragraph.startIndex;
			const mininumContribution = paragraphLength * 0.50;
			Object.keys(paragraph.contributors).forEach(author => {
				const authorsContribution = paragraph.contributors[author];
				if (authorsContribution > mininumContribution) {
					paragraph.mainContributor = author;
				}
			})
		})

		return out;
	}

	/**Iterates the text of the Etherpad in order to find situations, 
	 * where several authors are working in one paragraph. 
	 * If one author owns more than half of the characters in a paragraph,
	 * then that author is considered the main contributor. 
	 * All characters from other authors are counted as interaction towards
	 * the main author. Once such characters have been counted as support to
	 * the main contributor, these will be flagged "countedAsSupport". 
	 * This flag ensures that contributions are counted not more than once. 
	 */
	private evaluateSupportActions() {
		const paragraphs = this.detectParagraphs();
		let runner = this.list.head.next;
		let charIndex = 0;
		let parIndex = 0;
		let currentParagraph = paragraphs[parIndex];
		while (runner && runner.next) {

			if (currentParagraph && charIndex >= currentParagraph.startIndex && charIndex <= currentParagraph.endIndex) {
				// "runner" is part of a paragraph that contains meaningful text. 
				if (currentParagraph.mainContributor !== "" && currentParagraph.mainContributor !== runner.author
					&& !runner.meta.countedAsSupport) {
					this.contribCounter.notifyInteraction(runner.author, currentParagraph.mainContributor);
					runner.meta.countedAsSupport = true;
				}
			} else {
				// "runner" contains a linebreak somewhere between 
				// the paragraphs. So we have to check, if we have to move
				// to the next paragraph. 
				while (currentParagraph && charIndex > currentParagraph.endIndex) {
					currentParagraph = paragraphs[++parIndex];
				}
			}

			charIndex++;
			runner = runner.next;
		}
	}

	/**
	 * Selects timestamps of Etherpad revision documents from the CouchDB and
	 * stores them in the stableTimeStamps attribute. 
	 * Timestamps will be selected if there were no changes in the Etherpad text
	 * for at least the timespan defined in the stableTimeStampInterval attribute. 
	 */
	private findStableTimeStamps() {
		let nextIndex = this.listRevStatus + 1;
		let currentRevData = this.dataSource.revData[nextIndex];

		while (currentRevData) {
			const nextRevData = this.dataSource.revData[nextIndex + 1];
			if (nextRevData && currentRevData.timestamp < nextRevData.timestamp - this.stableTimeStampInterval) {
				if(!this.stableTimeStamps.includes(currentRevData.timestamp)){
					this.stableTimeStamps.push(currentRevData.timestamp);
				}
			}
			nextIndex++;
			currentRevData = this.dataSource.revData[nextIndex];
		}

		currentRevData = this.dataSource.revData[nextIndex - 1];
		if (currentRevData.timestamp + this.stableTimeStampInterval < Date.now()) {
			this.stableTimeStamps.push(currentRevData.timestamp);
		}
	}

	/**
	 * This method removes the oldest scroll event from the scrollData 
	 * attribute and checks the characters of paragraphs in this scroll 
	 * event. All characters from other authors, that hadn´t been seen
	 * by the user of that scroll event before, will be counted and then
	 * flagged as seen by this user. 
	 */
	private handleScrollEvent() {
		const scrollEvent = this.scrollData.shift() as ScrollEvent;
		// Find starting paragraph
		let startingRunner = this.list.head.next;
		let paragraphCounter = 1;
		while (startingRunner && startingRunner.next && paragraphCounter < scrollEvent.startParagraph) {
			if (startingRunner.content === "\n") {
				paragraphCounter++;
			}
			startingRunner = startingRunner.next;
		}

		let runner = startingRunner;
		while (runner && runner.next && runner.content === "\n") {
			runner = runner.next;
		}

		// runner is now pointing at the first character of the first visible paragraph
		while (paragraphCounter <= scrollEvent.endParagraph && runner && runner.next) {
			if (runner.content === "\n") {
				paragraphCounter++;
			} else {
				if (runner.author !== scrollEvent.user) {
					if (!runner.meta.seenBy.includes(scrollEvent.user)) {
						runner.meta.seenBy.push(scrollEvent.user);
					}
				}
			}
			runner = runner.next;
		}

	}


	/**Essentially quite similar to the template from the MinimapService.
	 * See the comments there for more details. 
	 * Aside from that, this method makes sure that all evaluation methods 
	 * will get called appropriately. 
	 */
	private buildList(): void {
		let nextRev = this.listRevStatus + 1;

		// We are only processing revision docs that were created until the
		// the newest entry in stableTimeStamps
		while (this.dataSource.revData[nextRev] &&
			this.dataSource.revData[nextRev].timestamp <= this.stableTimeStamps[this.stableTimeStamps.length - 1]) {

			// We want to evaluate a scroll event exactly in that moment, when the status of the linked list
			// matches the content of the text editor at the time of that scroll event. 

			// Is this rev´s timestamp the newest one that is newer than the timestamp of oldest scroll event?
			// If the answer is "yes", then we have to evaluate the list right now, .i.e before the list will 
			// be changed to the next revision. 
			// "while" is used instead of "if" because there may be several scroll events by different users 
			// within this timespan. 
			while (this.scrollData.length > 0 && this.dataSource.revData[nextRev].timestamp > this.scrollData[0].timestamp
				&& (!this.dataSource.revData[nextRev + 1] || this.dataSource.revData[nextRev + 1].timestamp > this.scrollData[0].timestamp)) {
				this.handleScrollEvent();
			}

			this.list.setToHead();
			const currentRevData = this.dataSource.revData[nextRev];
			const ops: Generator<Op> = Changeset.deserializeOps(currentRevData.cset.ops);
			let op = ops.next();
			let newChars = currentRevData.cset.charBank.split("");
			while (op.value) {
				const currentOp = op.value;
				switch (currentOp.opcode) {
				case "+":
					newChars = this.handleAdd(currentOp, nextRev, newChars);
					break;
				case "=":
					this.handleMove(currentOp, nextRev);
					break;
				case "-":
					this.handleRemove(currentOp, nextRev);
					break;
				}
				op = ops.next();
			}

			// If the timestamp of this revision was selected as stable timestamp
			// then the evaluation methods will be called. 
			if (this.stableTimeStamps.includes(currentRevData.timestamp)) {
				this.evaluateSupportActions();
				this.evaluateSeenBy();
			}
			nextRev++;
		}
		this.listRevStatus = nextRev - 1;
	}

	/**
	 * Inserts characters in the linked list according to the instructions of a changeset
	 * @param currentOp 
	 * @param currentRev 
	 * @param remainingCharbank 
	 * @returns the charminus minus the characters that were inserted
	 */
	private handleAdd(currentOp: Op, currentRev: number, remainingCharbank: string[]) {
		const author = this.dataSource.revData[currentRev].author;
		for (let i = 0; i < currentOp.chars; i++) {
			const char = remainingCharbank.shift();
			this.list.insertAfterCurrentAndMoveCurrent(char as string, author, { countedAsSupport: false, seenBy: [], seenByEvaluated: 0 });
		}
		return remainingCharbank;
	}

	/**
	 * Executes move instructions from a changeset as well in basic cases.
	 * Apart from that the method also tests, if a text formatting operation
	 * was performed. Then this method will also check, if the formatting 
	 * affected text that originated from other authors. If so, then this
	 * will be counted as text interaction. 
	 * @param currentOp 
	 * @param currentRev 
	 */
	private handleMove(currentOp: Op, currentRev: number) {
		if (this.dataSource.attribsToList(currentOp.attribs).length > 0) {
			// Move with attributes in this op means there is an edit
			const author = this.dataSource.revData[currentRev].author;
			for (let i = 0; i < currentOp.chars; i++) {
				this.list.moveFwd(1);

				if (this.list.current.author !== author) {
					// Count affected chars that originate from other authors
					this.contribCounter.notifyInteraction(author, this.list.current.author);
				}
			}
		} else {
			this.list.moveFwd(currentOp.chars);
		}

	}

	/**
	 * Executes a delete operation from a changeset. 
	 * If the deletion affects characters owned by other 
	 * authors, this will be counted as text interaction. 
	 * @param currentOp 
	 * @param currentRev 
	 */
	private handleRemove(currentOp: Op, currentRev: number) {
		const author = this.dataSource.revData[currentRev].author;
		let runner = this.list.current;
		let index = 0;
		while (runner && runner.next && index < currentOp.chars) {
			// Count deleted chars that originate from other authors
			if (runner.author !== author) {
				// Count affected chars from other authors
				this.contribCounter.notifyInteraction(author, runner.author);
			}
			runner = runner.next;
			index++;
		}
		const currentRevData = this.dataSource.revData[currentRev];
		const rawRevData = currentRevData.cset as CSRaw;
		if (rawRevData.newLen == 1) {
			this.list.eraseAllNodes();
		} else {
			for (let i = 0; i < currentOp.chars; i++) {
				this.list.removeAfterCurrent();
			}
		}
	}

}
