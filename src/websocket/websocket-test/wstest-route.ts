import {DocumentScope} from "nano";
import {Socket} from "socket.io";
import couchDbService from "../../core/couch/couch-db.service";
import DbChangeCallback from "../dbchange-callback.interface";
import DbChange from "../dbchange.interface";
import DbDocs from "../dbdocs";
import AbstractWsRoute from "../wsroute-service/abstract-wsroute";
import CharsAndWordsInPadCalculator from "./charsinpad-calculator";

/**
 * Clients connected to this route will receive up to date numbers of chars and words in the pad they relate to.
 */
export default class WsTestRoute extends AbstractWsRoute {
	public readonly ROUTE = "/wstest";

	private dbChangeCallback!: DbChangeCallback;
	private dbConnection!: DocumentScope<any>;

	/**
	 * Upon connection of a client to the route, initialize a calculator for the desired data,
	 * push an initial update and define a callback pushing further updated upon changes to the db
	 * pertaining to the interests of the client connected to the socket.
	 *
	 * @param socket The socket to the client. The data property contain client information.
	 */
	public async connectionHandler(socket: Socket): Promise<void> {

		// The frontend is expected to emit a "padName" event at 
		// the beginning of the connection. 
		let padName = "";
		socket.on("padName", pName => {
			padName = pName;
		});

		let attempts = 0
		while (attempts < 50 && padName === "") {
			await new Promise(resolve => setTimeout(resolve, 10));
			attempts++;
		}

		if (padName === "") {
			throw new Error("\"padName\" event is missing.");
		}
		const charsInPadCalculator = new CharsAndWordsInPadCalculator()
		
		charsInPadCalculator.getNumCharsAndWordsInPadEventually(padName).then((numChars) => {
			// push one update on connection
			socket.emit("update", numChars);
		})
		
		/**
		 * Since the callback function will be called on each db change, regardless of which client connected
		 * to the route caused the change, it is essential to properly filter the changes stream
		 * in order to only call out a change to a client when it actually pertains to that client.
		 * The data property of the socket object contains all the information derived from the jwt
		 * about the client connected to the socket. Its shape is described by the SocketData interface.
		 * This data can be used for filtering.
		*/
		this.dbChangeCallback = function dbChangesCallback(change: DbChange) {
			if (DbDocs.padDoc.test(change.id) && change.id.includes(padName)) {
				charsInPadCalculator.getNumCharsAndWordsInPadEventually(padName).then((numChars) => {
					socket.emit("update", numChars);
				})
			}
		}
		
		this.dbConnection = couchDbService.getConnection("etherpad");
		couchDbService.subscribeChanges(this.dbConnection, this.dbChangeCallback);
	}

	/**
	 * Unsubscribe the callback
	 */
	public disconnectionHandler(): void {
		couchDbService.unsubscribeChanges(this.dbConnection, this.dbChangeCallback);
	}

}
