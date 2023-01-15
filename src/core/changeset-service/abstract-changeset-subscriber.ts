import logService from "../log/log.service";
import ChangesetService from "./changeset-service";
import {Subject} from "../subscriber/subject";


/**
 * Services that want to evaluate revision data from pads
 * should inherit from this class in order to get access
 * to the ChangesetService instance.
 *
 * IMPORTANT: Instances of all subclasses MUST add their class
 * names to the list in subscribers.ts in order to be instantiated
 * at startup.
 */
export default abstract class AbstractChangesetSubscriber<T> extends Subject<T> {

	/**
	 * This object provides access to the non-private methods
	 * and properties of the ChangesetService instance.
	 *
	 * IMPORTANT: Instances of AbstractChangesetSubscriber are
	 * NOT ALLOWED to perform write operations on
	 * properties of ChangesetService
	 *
	 */
	public readonly dataSource: ChangesetService;
	public readonly padName: string

	protected constructor(padName: string) {
		super();
		this.dataSource = ChangesetService.instanceRegistry[padName];
		if (!this.dataSource) {
			logService.error(AbstractChangesetSubscriber.name, "failed to connect to CSP for " + padName);
		}
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
	 * The ChangesetService will only call this,
	 * if there are any new revision datasets since
	 * the last call.
	 */
	abstract dataSourceCallback(): void;
}