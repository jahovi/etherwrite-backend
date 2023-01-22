import { Application, Request, Response } from "express";
import AuthoringRatiosCalculator from "../authoring-ratios-service/authoring-ratios-calculator";
import Router from "../core/router/router.interface";
import aggregateRatiosOfOtherUsers from "../authoring-ratios-service/aggregate-ratios.function";

/**
 * This endpoint uses an instance of AuthoringRatiosCalculator to calculate and return authoring ratios for each pad.
 */
export default class AuthoringRatiosRouter implements Router {

	private ROUTE = "/authoring_ratios";

	init(app: Application): void {
		app.get(this.ROUTE, this.getAuthoringRatios);
	}

	/**
	 * Defines enpoint response to GET requests. Uses an AuthoringRatiosCalculator to retrieve authoring ratios for given pad
	 * and sends them back to the client.
	 * @param _req
	 * @param res
	 */
	getAuthoringRatios(_req: Request, res: Response): void {
		const pad = _req.query["pad"] ? _req.query["pad"].toString() : "";
		const authoringRatiosCalculator = new AuthoringRatiosCalculator();
		if (pad) {
			// return data for given pad
			authoringRatiosCalculator.calculate(pad).then((authoringRatios) => {
				if (authoringRatios) {
					if (res.locals.user.isModerator) {
						// if current user is a moderator, return the full data set
						res.status(200).send(authoringRatios)
					} else {
						// if current user is not a moderator: construct result object containing author, ID, ratio and color
						// data for the current user and aggregated data for other authors
						const usersMoodleId: string = res.locals.user.userId.toString();
						const result = aggregateRatiosOfOtherUsers(authoringRatios, usersMoodleId);
						res.status(200).send(result)
					}
				} else {
					// authoring ratios calculator returned nothing
					res.send({
						authors: [],
						moodleIDs: [],
						ratios: [],
						colors: [],
					})
				}
			});
		} else {
			// pad not specified
			res.status(400).send("Query parameter \"pad\" is required.");
		}
	}
}


