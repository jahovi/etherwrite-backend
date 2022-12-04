import { Application, Request, Response } from "express";
import AuthoringRatiosCalculator, { PadGroupedFormat } from "./core/authoring-ratios-service/authoring-ratios-calculator";
import Router from "./core/router/router.interface";

/**
 * This endpoint uses an instance of AuthoringRatiosCalculator to calculate and return authoring ratios for each pad.
 */
export default class AuthoringRatiosRouter implements Router {

	private ROUTE = "/authoring_ratios";

	init(app: Application): void {
		app.get(this.ROUTE, this.getAuthoringRatios);
	}

	/**
	 * Defines enpoint response to GET requests. Uses an AuthoringRatiosCalculator to retrieve authoring ratios for each author in each pad
	 * and sends them back to the client. If a pad is specified in the request, data for the given pad will be returned, either in full,
	 * if the current user is a moderator or aggregated if not. Else data for all pads will be returned, but only if the current user is a moderator.
	 * @param _req 
	 * @param res 
	 */
	getAuthoringRatios(_req: Request, res: Response): void {
		const pad = _req.query["pad"] ? _req.query["pad"].toString() : "";
		const authoringRatiosCalculator = new AuthoringRatiosCalculator();
		if (pad) {
			// return data for given pad
			authoringRatiosCalculator.calculateAuthoringRatios().then((authoringRatios) => {
				if (authoringRatios[pad]) {
					if (res.locals.user.isModerator) {
						// if current user is a moderator, return the full data set
						res.status(200).send(authoringRatios[pad])
					} else {
						// if current user is not a moderator: construct result object containing author, ID, ratio and color
						// data for the current user and aggregated data for other authors
						const usersMoodleId: string = res.locals.user.userId.toString();
						const result = aggregateRatiosOfOtherUsers(authoringRatios, pad, usersMoodleId);
						res.status(200).send(result)
					}
				} else {
					res.status(404).send("Pad not found.")
				}
			});
		} else {
			// return data for all pads only if user is a moderator
			if (res.locals.user.isModerator) {
				authoringRatiosCalculator.calculateAuthoringRatios().then((authoringRatios) => { res.status(200).send(authoringRatios) });
			} else {
				res.status(403).send("Not allowed for non moderators.")
			}
		}
	}
}

/**
 * Takes authoring ratios in pad grouped format and returns for a specific pad an object containing the current user's ratio
 * and an aggregate ratio equalling the sum of the ratios of the other users.
 * 
 * @param authoringRatios as returned by the calculateAuthoringRatios method of AuthoringRatios calculator
 * @param pad the pad for which to calculate aggregated ratios
 * @param usersMoodleId the moodle Id of the current user
 * @returns aggregated authoring ratios
 */
function aggregateRatiosOfOtherUsers(authoringRatios: PadGroupedFormat, pad: string, usersMoodleId: string) {
	const otherUsersColor = "#808080"; // gray
	const numberOfUsers = authoringRatios[pad].ratios.length;
	const userIndex = authoringRatios[pad].moodleIDs.indexOf(usersMoodleId); // index of the current users data in the authors, moodleIDs, ratios, colors arrays
	let aggregateRatioOfOtherUsers = 0;
	for (let i = 0; i < numberOfUsers; i++) {
		if (i !== userIndex) {
			// sum authoring ratios of other users
			aggregateRatioOfOtherUsers += authoringRatios[pad].ratios[i];
		}
	}
	const currentUserAuthor = authoringRatios[pad].authors[userIndex];
	const currentUserColor = authoringRatios[pad].colors[userIndex];
	const currentUserRatio = authoringRatios[pad].ratios[userIndex];
	const result = {
		authors: [currentUserAuthor, `${numberOfUsers - 1} Andere`],
		moodleIDs: [usersMoodleId, null],
		ratios: [currentUserRatio, aggregateRatioOfOtherUsers],
		colors: [currentUserColor, otherUsersColor],
	};
	return result;
}