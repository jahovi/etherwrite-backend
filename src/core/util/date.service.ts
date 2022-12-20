export class DateService {

	private static readonly DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
		second: undefined,
		minute: "2-digit",
		hour: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "2-digit",
	};

	private static readonly DATE_OPTIONS: Intl.DateTimeFormatOptions = {
		second: undefined,
		minute: undefined,
		hour: undefined,
		day: "2-digit",
		month: "2-digit",
		year: "2-digit",
	};

	public static formatDateTime(date: Date): string {
		return date.toLocaleString("de", this.DATETIME_OPTIONS);
	}

	public static formatDate(date: Date): string {
		return date.toLocaleString("de", this.DATE_OPTIONS);
	}
}