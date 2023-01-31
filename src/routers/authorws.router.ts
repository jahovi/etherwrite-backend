import { Socket } from "socket.io";
import AbstractWsRoute from "../websocket/wsroute-service/abstract-wsroute";
import AuthorRegistry from "../core/authors/author-registry";
import { Author } from "../core/authors/author.interface";

export default class AuthorWSRouter extends AbstractWsRoute {
	public readonly ROUTE = "/wsauthors";

	private socketCounter = 0;

	private readonly callback = (data: Record<string, Author> | undefined) => {
		if (data) {
			this.emitToAllSockets("AuthorRegistry", data);
		}
	};

	public async connectionHandler(socket: Socket): Promise<void> {		
		this.addSocket("AuthorRegistry", socket);
		if (this.socketCounter === 0) {
			AuthorRegistry.getInstance().subscribe(this.callback);
		}
		this.socketCounter++;
		socket.emit("update",
			AuthorRegistry.getInstance().getSubjectData(),
		);
	}

	public disconnectionHandler(socket: Socket, reason: string): void {
		super.disconnectionHandler(socket, reason);
		this.socketCounter--;
		if (this.socketCounter < 1) {
			AuthorRegistry.getInstance().unsubscribe(this.callback);
			this.socketCounter = 0;
		}
	}

}