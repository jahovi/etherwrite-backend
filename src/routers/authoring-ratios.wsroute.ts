import { Socket } from "socket.io";
import AuthoringRatiosCalculator from "../authoring-ratios-service/authoring-ratios-calculator";
import { AuthoringRatios } from "../authoring-ratios-service/authoring-ratios.type";
import logService from "../core/log/log.service";
import MinimapService from "../minimap-service/minimap-service";
import PadRegistry from "../pads";
import AbstractWsRoute from "../websocket/wsroute-service/abstract-wsroute";
import { aggregateRatiosOfOtherUsers } from "./authoring-ratios.router";

export default class AuthoringRatiosWsRoute extends AbstractWsRoute {
	public readonly ROUTE = "/authoring_ratios_ws";

	private padNameToMinimapService: Record<string, MinimapService> = {};

	/**
	 * Handles a new socket connecting. Initializes its subscriptions for {@link MinimapService} and {@link TrackingService} for the given pad if needed
	 * and sends a first initial data package.
	 * @param socket The socket that initializes the connection.
	 */
	public async connectionHandler(socket: Socket): Promise<void> {
		const padName: string = socket.handshake.query.padName as string;
		if (!padName) {
			throw new Error("Query parameter \"padName\" is required.");
		}

		this.addSocket(padName, socket);

		if (!this.padNameToMinimapService[padName]) {
			await this.initializeMinimapServiceSubscription(padName);
		}

		const authoringRatios = AuthoringRatiosCalculator.calculateFromBlocks(this.padNameToMinimapService[padName].getSubjectData());

		// Emit initial data.
		this.emitData(socket, authoringRatios);
	}

	/**
	 * Creates a new subscription to the {@link MinimapService} to receive updates about the pad text.
	 * @param padName The name of the pad to start the subscription for.
	 */
	private async initializeMinimapServiceSubscription(padName: string): Promise<void> {

		const minimapService: MinimapService = await PadRegistry.getServiceInstance(MinimapService.instances, padName);
		this.padNameToMinimapService[padName] = minimapService;
		
		minimapService.subscribe(data => {
			const sockets = this.padNameToSockets[padName] || [];
			logService.debug(this.constructor.name, `Delivering data for pad "${padName}" to ${sockets.length} socket(s)`);
			if (data) {
				const authoringRatios = AuthoringRatiosCalculator.calculateFromBlocks(data);

				sockets.forEach(socket => {
					this.emitData(socket, authoringRatios);
				})
			}
		});
	}

	/**
	 * Emits the given ratios either plainly if the socket connects to a moderator or in aggregated form
	 * if not.
	 * 
	 * @param socket The socket to emit data into
	 * @param authoringRatios The ratios to emit 
	 */
	private emitData(socket: Socket, authoringRatios: AuthoringRatios) {
		if (socket.data.isModerator) {
			socket.emit("update", authoringRatios);
		} else {
			const usersMoodleId = socket.data.userId.toString();
			const aggregatedRatios = aggregateRatiosOfOtherUsers(authoringRatios, usersMoodleId);
			socket.emit("update", aggregatedRatios);
		}
	}
}
