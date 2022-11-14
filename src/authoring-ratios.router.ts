import { Application, Request, Response } from "express";
import AuthoringRatiosCalculator from "./core/authoring-ratios-service/authoring-ratios-calculator";
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
	 * and sends them back to the client. 
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
					res.status(200).send(authoringRatios[pad])
				} else {
					res.status(404).send("Pad not found.")
				}
			});
		} else {
			// return data for all pads
			authoringRatiosCalculator.calculateAuthoringRatios().then((authoringRatios) => { res.status(200).send(authoringRatios) });
		}
	}
}