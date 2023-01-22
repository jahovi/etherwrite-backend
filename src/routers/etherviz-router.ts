import {Application, Request, Response} from "express";
import Router from "../core/router/router.interface";
import logService from "../core/log/log.service";
import EtherVizService from "../etherviz-service/etherviz-service";
import PadRegistry from "../pads";

export default class EtherVizRouter implements Router {

	private ROUTE = "/getEtherVizData";

	init(app: Application): void {
		app.get(this.ROUTE, this.getData);
	}

	async getData(_req: Request, res: Response): Promise<void> {
		const padName: string = _req.query.pad as string;
		if (!padName) {
			res.status(400).send("Query parameter \"padName\" is required.");
			return;
		}
		let evService = EtherVizService.instances[padName];
		if (!evService) {
			try {
				evService = await PadRegistry.getServiceInstance(EtherVizService.instances, padName);
			} catch {
				res.status(404).send([]);
			}
		}

		logService.debug(EtherVizRouter.name, "delivered data for '" + padName + "' to " + _req.ip);
		res.status(200).send(evService.getEtherVizDataSet());
	}
}