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
		const padName = _req.query["padName"];
		if (!padName) {
			res.status(400).send("Query parameter \"padName\" is required.");
			return;
		}
		let evproc = EtherVizService.instances[padName.toString()];
		if (!evproc) {
			await PadRegistry.initAndUpdate();
			evproc = EtherVizService.instances[padName.toString()];
		}
		if(!evproc){
			res.status(404).send([]);
			return;
		}
		logService.debug(EtherVizRouter.name, "delivered data for '" + padName + "' to " + _req.ip);
		res.status(200).send(evproc.getEtherVizDataSet());
	}
}