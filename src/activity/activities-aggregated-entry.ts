import {AggregatedEntry} from "./abstract-aggregated-entry";
import {ActivityDataEntry} from "./activity-data-entry.interface";
import {MoodleUser} from "../core/middleware/moodle-user.middleware";

export class ActivitiesAggregatedEntry extends AggregatedEntry<ActivitiesAggregatedEntry> {
	public authorToActivities: Record<string, number>;

	constructor(timestamp: Date) {
		super(timestamp);
		this.authorToActivities = {};
	}

	/**
	 * Adds the given raw data entry to the already aggregated data in this object.
	 * @param entry The entry to add.
	 */
	public addEntry(entry: ActivityDataEntry) {
		this.authorToActivities[entry.author] = (this.authorToActivities[entry.author] || 0) + 1;
	}

	/**
	 * Adds the given aggregated data entry to the already aggregated data in this object.
	 * @param entry The entry to add.
	 */
	public addAggregatedEntry(entry: ActivitiesAggregatedEntry): void {
		Object.entries(entry.authorToActivities)
			.forEach(([author, activities]) => {
				this.authorToActivities[author] = (this.authorToActivities[author] || 0) + activities;
			});
	}

	/**
	 * Creates a JSON object from the data in this object.
	 * @param user The user requesting the data.
	 * @param includeHours If true, the timestamp will include the hour, otherwise just the date.
	 */
	public toJSON(user: MoodleUser, includeHours = false) {
		let authorToActivities;
		if (user.isModerator) {
			authorToActivities = this.authorToActivities;
		} else {
			authorToActivities = Object.entries(this.authorToActivities)
				.reduce((result: any, current) => {
					if (current[0] === String(user.epAuthorId)) {
						result[current[0]] = current[1];
					} else {
						result["others"] = (result["others"] || 0) + (current[1] || 0);
					}

					return result;
				}, {});
		}
		return {
			...super.toJSON(user, includeHours),
			authorToActivities,
		}
	}
}