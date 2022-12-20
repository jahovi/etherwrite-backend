import {ConstructorOf} from "../constructor-of.interface";
import ActivityProcessor from "./activity-processor";
import PadRegistry from "../pads";
import {ActivityDataEntry} from "./activity-data-entry.interface";
import {OperationsAggregatedEntry} from "./operations-aggregated-entry";
import {ActivitiesAggregatedEntry} from "./activities-aggregated-entry";
import {AggregatedEntry} from "./abstract-aggregated-entry";
import {MoodleUser} from "../core/middleware/moodle-user.middleware";

class ActivityService {

	private static readonly AGGREGATION_THRESHOLD = 1000 * 60 * 60 * 24 * 3; // 3 days in ms.

	/**
	 * Returns an aggregated list of distinct operations or activities that happened in the given pad.
	 * Requires "padName" as query parameter.
	 *
	 * @param padName The name of the pad to get the data for.
	 * @param user The user requesting the list.
	 * @param clazz The class of objects to handle, either {@link ActivitiesAggregatedEntry} or {@link OperationsAggregatedEntry}.
	 */
	public async getList<TYPE extends AggregatedEntry<TYPE>>(padName: string, user: MoodleUser, clazz: ConstructorOf<TYPE>): Promise<any[]> {
		// Get activity data.
		let activityProcessor = ActivityProcessor.instances[padName];
		if (!activityProcessor) {
			await PadRegistry.initAndUpdate();
			activityProcessor = ActivityProcessor.instances[padName];
		}

		const blockList: ActivityDataEntry[] = activityProcessor.blockList;

		// Aggregate to hours.
		let result: TYPE[] = this.aggregateToHours(blockList, user, clazz);

		result = this.fillGaps(result, clazz);

		if (result.length < 2) {
			return result.map(e => e.toJSON(user, true));
		}

		// If the project is shorted than 3 days, return the data aggregated to hours.
		const projectTime = result[result.length - 1].timestamp.getTime() - result[0].timestamp.getTime();
		if (projectTime < ActivityService.AGGREGATION_THRESHOLD) {
			return result.map(e => e.toJSON(user, true));
		} else {
			// else aggregate once more, to days.
			return this.aggregateToDays(result as TYPE[], clazz)
				.map(e => e.toJSON(user, false));
		}
	}

	/**
	 * Fills the hourly gaps in the data where no data was produced to have a gapless ordinal scale
	 * of hours.
	 *
	 * @param list The original list.
	 * @param clazz
	 * @return a new list with new entries where none were before.
	 */
	private fillGaps<TYPE extends AggregatedEntry<TYPE>>(list: TYPE[], clazz: ConstructorOf<TYPE>): TYPE[] {
		const earliest: AggregatedEntry<TYPE> = list[0];
		const latest: AggregatedEntry<TYPE> = list[list.length - 1];

		if (!earliest || !latest) {
			return list;
		}

		const result: TYPE[] = [];

		const date = new Date(earliest.timestamp.getTime());
		while (date.getTime() <= latest.timestamp.getTime()) {
			const entry = list.find(e => e.timestamp.getTime() === date.getTime());

			if (entry) {
				result.push(entry);
			} else {
				result.push(new clazz(new Date(date.getTime())));
			}
			date.setTime(date.getTime() + (60 * 60 * 1000));
		}

		return result;
	}

	/**
	 * Aggregates the given list of activity entries to only produce one entry per distinct hour.
	 *
	 * @param blockList The unaggregated list of {@link ActivityDataEntry}s.
	 * @param user The user requesting the list. If they are not a moderator, the data will be
	 * @param clazz
	 * @return a list of aggregated entries where one entry represents one hour.
	 */
	private aggregateToHours<TYPE extends AggregatedEntry<TYPE>>(blockList: ActivityDataEntry[], user: MoodleUser, clazz: ConstructorOf<TYPE>): TYPE[] {
		const aggregation: Record<number, TYPE> = {};

		blockList.forEach(entry => {
			const entryHour = new Date(entry.timestamp.getFullYear(), entry.timestamp.getMonth(), entry.timestamp.getDate(), entry.timestamp.getHours());
			const key = entryHour.getTime();
			let aggregatedEntry: TYPE = aggregation[key];
			if (!aggregatedEntry) {
				aggregation[key] = new clazz(entryHour);
				aggregatedEntry = aggregation[key];
			}

			aggregatedEntry.addEntry(entry);
		});

		return Object.values(aggregation)
			.sort((entryA, entryB) => entryA.timestamp.getTime() - entryB.timestamp.getTime());
	}

	/**
	 * Aggregates the given list of already aggregated activity entries per hour to only produce one entry per distinct date.
	 *
	 * @param aggregatedToHours The already aggregated list of {@link OperationsAggregatedEntry}s per hour.
	 * @param clazz
	 * @return a list of aggregated entries where one entry represents one day.
	 */
	private aggregateToDays<TYPE extends AggregatedEntry<TYPE>>(aggregatedToHours: TYPE[], clazz: ConstructorOf<TYPE>): TYPE[] {
		const aggregation: Record<number, TYPE> = {};

		aggregatedToHours.forEach(entry => {
			const entryHour = new Date(entry.timestamp.getFullYear(), entry.timestamp.getMonth(), entry.timestamp.getDate());
			const key = entryHour.getTime();
			let aggregatedEntry: TYPE = aggregation[key];
			if (!aggregatedEntry) {
				aggregation[key] = new clazz(entryHour);
				aggregatedEntry = aggregation[key];
			}

			aggregatedEntry.addAggregatedEntry(entry);
		});

		return Object.values(aggregation)
			.sort((entryA, entryB) => entryA.timestamp.getTime() - entryB.timestamp.getTime());
	}
}

export const activityService: ActivityService = new ActivityService();
