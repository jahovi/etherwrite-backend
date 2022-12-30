import { DocumentScope } from "nano";
import { Socket } from "socket.io";
import couchDbService from "../../core/couch/couch-db.service";
import dbChangeCallback from "../dbchange-callback.interface";
import DbChange from "../dbchange.interface";
import DbDocs from "../dbdocs";
import SocketData from "../socket-data.interface";
import AbstractWsRoute from "../wsroute-service/abstract-wsroute";
import CharsAndWordsInPadCalculator from "./charsinpad-calculator";

/**
 * Clients connected to this route will receive up to date numbers of chars and words in the pad they relate to.
 */
export default class WsTestRoute extends AbstractWsRoute {
	public readonly ROUTE = "/wstest";

	private dbChangeCallback!: dbChangeCallback;
	private dbConnection!: DocumentScope<any>;

	/**
	 * Upon connection of a client to the route, initialize a calculator for the desired data,
	 * push an initial update and define a callback pushing further updated upon changes to the db
	 * pertaining to the interests of the client connected to the socket.
	 * 
	 * @param socket The socket to the client. The data property contain client information.
	 */
	public connectionHandler(socket: Socket): void {
		this.dbConnection = couchDbService.getConnection("etherpad");
		const charsInPadCalculator = new CharsAndWordsInPadCalculator()
		const socketData = socket.data as SocketData;

		charsInPadCalculator.getNumCharsAndWordsInPadEventually(socketData.padName).then((numChars) => {
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
		this.dbChangeCallback = function dbChangesCallback (change: DbChange) {
			if (DbDocs.padDoc.test(change.id) && change.id.includes(socketData.padName)) {
				charsInPadCalculator.update();
				charsInPadCalculator.getNumCharsAndWordsInPadEventually(socketData.padName).then((numChars) => {
					socket.emit("update", numChars);
				})
			}
		}

		couchDbService.subscribeChanges(this.dbConnection, this.dbChangeCallback);
	}

	/**
	 * Unsubscribe the callback 
	 */
	public disconnectionHandler(): void {
		couchDbService.unsubscribeChanges(this.dbConnection, this.dbChangeCallback);
	}

}
