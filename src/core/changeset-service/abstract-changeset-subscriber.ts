import logService from "../log/log.service";
import ChangesetProcessor from "./changeset-processor";


/**
 * Services that want to evaluate revision data from pads
 * should inherit from this class in order to get access
 * to the ChangesetProcessor instance.
 *
 * IMPORTANT: Instances of all subclasses MUST add their class
 * names to the list in subscribers.ts in order to be instantiated
 * at startup.
 */
export default abstract class AbstractChangesetSubscriber {

	/**
	 * This object provides access to the non-private methods
	 * and properties of the ChangesetProcessor instance.
	 *
	 * IMPORTANT: Instances of CS_Subscriber are
	 * NOT ALLOWED to perform write operations on
	 * properties of ChangesetProcessor
	 *
	 */
	public readonly dataSource: ChangesetProcessor;
	public readonly padName: string

	protected constructor(padName: string) {
		this.dataSource = ChangesetProcessor.instanceRegistry[padName];
		if (!this.dataSource)
			logService.error(AbstractChangesetSubscriber.name, "failed to connect to CSP for " + padName);
		this.padName = padName;
		this.connect();
	}

	connect() {
		this.dataSource.subscribe(this.dataSourceCallback.bind(this));
	}

	/**
	 * The implementation of this method should
	 * be filled with instructions in response to
	 * newly arrived revision-data for this pad.
	 *
	 * The ChangesetProcessor will only call this,
	 * if there are any new revision datasets since
	 * the last call.
	 */
	abstract dataSourceCallback(): void;


}