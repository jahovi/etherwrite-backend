import {Application, Request, Response} from "express";
import Router from "../core/router/router.interface";
import logService from "../core/log/log.service";
import PadRegistry from "../pads";
import CohesionDiagramService from "../coh-service/coh-service";

export default class CohesionDiagramRouter implements Router {

	private ROUTE = "/getCohDiagData";

	init(app: Application): void {
		app.get(this.ROUTE, this.getData);
	}

	async getData(_req: Request, res: Response): Promise<void> {
		const padName: string = _req.query.padName as string;
		if (!padName) {
			res.status(400).send("Query parameter \"padName\" is required.");
			return;
		}
		let cohs = CohesionDiagramService.instances[padName];
		if (!cohs) {
			try{
				cohs = await PadRegistry.getServiceInstance(CohesionDiagramService.instances, padName);
			} catch {
				res.status(404).send({});
				return;
			}
		}

		const data = cohs.getCohesionData();
		logService.debug(CohesionDiagramRouter.name, "delivered data for '" + padName + "' to " + _req.ip);
		res.status(200).send(data);
	}
}