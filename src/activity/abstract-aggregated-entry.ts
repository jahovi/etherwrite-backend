import {ActivityDataEntry} from "./activity-data-entry.interface";
import {MoodleUser} from "../core/middleware/moodle-user.middleware";

export abstract class AggregatedEntry<TYPE> {
	public timestamp: Date;

	protected constructor(timestamp: Date) {
		this.timestamp = timestamp;
	}

	/**
	 * Adds the given raw data entry to the already aggregated data in this object.
	 * @param entry The entry to add.
	 */
	public abstract addEntry(entry: ActivityDataEntry): void;

	/**
	 * Adds the given aggregated data entry to the already aggregated data in this object.
	 * @param entry The entry to add.
	 */
	public abstract addAggregatedEntry(entry: TYPE): void;

	/**
	 * Creates a JSON object from the data in this object.
	 * @param includeHours
	 */
	public toJSON(user: MoodleUser, includeHours = false) {
		const timestamp = includeHours ? this.timestamp.toLocaleString("de") : this.timestamp.toLocaleDateString("de")
		return {
			timestamp: timestamp,
		}
	}
}
