import TrackingService from "../core/tracking-service/tracking-service";
import MinimapService from "../minimap-service/minimap-service";
import {Socket} from "socket.io";
import AbstractWsRoute from "../websocket/wsroute-service/abstract-wsroute";
import PadRegistry from "../pads";


export default class MinimapRouter extends AbstractWsRoute {

	public ROUTE = "/minimap";

	private padNameToMinimapService: Record<string, MinimapService> = {};
	private padNameToTrackingService: Record<string, TrackingService> = {};

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

		if (!this.padNameToTrackingService[padName]) {
			await this.initializeTrackingServiceSubscription(padName);
		}

		// Emit initial data.
		socket.emit("update", {
			blocks: this.padNameToMinimapService[padName].getSubjectData(),
			scrollPos: this.padNameToTrackingService[padName].getSubjectData(),
		});
	}

	/**
	 * Creates a new subscription to the {@link MinimapService} to receive updates about the pad text.
	 * @param padName The name of the pad to start the subscription for.
	 */
	private async initializeMinimapServiceSubscription(padName: string): Promise<void> {

		const minimapService: MinimapService = await PadRegistry.getServiceInstance(MinimapService.instances, padName);
		this.padNameToMinimapService[padName] = minimapService;

		minimapService.subscribe(data => this.emitToAllSockets(padName, {
			blocks: data,
		}));
	}

	/**
	 * Creates a new subscription to the {@link TrackingService} to receive updates about the user scroll positions.
	 * @param padName The name of the pad to start the subscription for.
	 */
	private async initializeTrackingServiceSubscription(padName: string): Promise<void> {

		const trackingService: TrackingService = await PadRegistry.getServiceInstance(TrackingService.instanceRegistry, padName);
		this.padNameToTrackingService[padName] = trackingService;

		trackingService.subscribe(data => this.emitToAllSockets(padName, {
			scrollPos: data,
		}));
	}
}