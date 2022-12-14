import {Application, Request, Response} from "express";
import Router from "../core/router/router.interface";
import couchDbService from "../core/couch/couch-db.service";
import {DocumentScope, DocumentViewResponse} from "nano";
import {MoodleUser} from "../core/middleware/moodle-user.middleware";

export default class EtherpadRouter implements Router {
	private ROUTE = "/etherpad";

	init(app: Application): void {
		app.get(this.ROUTE + "/authorize", this.authorize.bind(this));
	}

	private async authorize(_req: Request, res: Response) {
		const user: MoodleUser = res.locals.user;

		const db: DocumentScope<any> = couchDbService.getConnection("etherpad");
		const author2token: DocumentViewResponse<any, any> = await couchDbService.readView(db, "evahelpers", "author2Token");
		const token = author2token.rows.find(row => row.key === user.epAuthorId);
		if (token) {
			return res.send({
				token: token.value,
			});
		}

		const newToken = `t.${this.randomString()}`;

		await couchDbService.insert(db, {
			_id: `token2author:${newToken}`,
			value: user.epAuthorId,
		});

		return res.send({token: newToken});
	}

	/**
	 * Produces a random string consisting of digits and lower and upper letters.
	 * (Taken from the token generation from etherpad-lite)
	 *
	 * @param length The length of the desired string.
	 */
	public randomString(length = 20) {
		const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
		let randomstring = "";
		for (let i = 0; i < length; i++) {
			const rnum = Math.floor(Math.random() * chars.length);
			randomstring += chars.substring(rnum, rnum + 1);
		}
		return randomstring;
	}
}