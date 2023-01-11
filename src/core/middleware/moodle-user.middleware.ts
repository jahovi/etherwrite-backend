import {NextFunction, Request, Response} from "express";
import * as jwt from "jsonwebtoken";
import {JwtPayload} from "jsonwebtoken";
import LogService from "../log/log.service";

/**
 * Extracts the moodle user data from the JSON Web Token in the {@link Request}. If there is none or it cannot be decoded,
 * HTTP Error 401 will be returned.
 *
 * The decoded {@link MoodleUser} will be available in "res.locals.user".
 *
 * @param req The request.
 * @param res The response.
 * @param next The next-function of express.
 */
export const moodleUserMiddleware = (req: Request, res: Response, next: NextFunction) => {
	jwt.verify(req.query.jwt as string, "0c26bee8-f114-4a59-ad65-15092de45df9", (err, decoded: JwtPayload | string | undefined) => {
		if (err || !decoded) {
			LogService.error("Middleware", "Cannot decode token: " + err?.name);
			res.status(401).end();
		} else {
			res.locals.user = decoded as MoodleUser;
			next();
		}
	});
}

export interface MoodleUser {
	/**
	 * The moodle user id from the moodle database.
	 */
	userId: number,
	/**
	 * The author id from etherpad.
	 */
	epAuthorId: string,

	/**
	 * A flag determining if the user has moderation permissions.
	 */
	isModerator: boolean,

	/**
	 * The instances this user is allowed to see.
	 */
	editorInstances: MoodleUserEditor[]
}

export interface MoodleUserEditor {

	/**
	 * The name of the pad which is available.
	 */
	padName: string;

	/**
	 * The id of the group in etherpad.
	 */
	epGroup: string;

	/**
	 * The name of the group this editor belongs to.
	 */
	groupName: string;
}