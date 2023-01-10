import Router from "../core/router/router.interface";
import {Application, Request, Response} from "express";
import AuthorRegistry from "../core/authors/author-registry";

export default class AuthorRouter implements Router {

	private ROUTE = "/authors";

	init(app: Application): void {
		app.get(this.ROUTE, this.getAuthorInfo);
	}

	/**
	 * Returns base info about all active authors.
	 */
	async getAuthorInfo(_req: Request, res: Response): Promise<void> {
		res.status(200).send(AuthorRegistry.knownAuthors);
	}
}