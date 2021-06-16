namespace Cookie {
	/**
	 * Gibt Wert eines Cookies zurück
	 * @param name Name des Cookies
	 * @param json Ob in JSON geparsed werden soll
	 */
	export function get<T>(name: string, json = true): T {
		const matches = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)'),
			wert = matches ? matches[2] : null;
		if (wert === null) return null;
		if (wert === "") return undefined;
		return (json ? JSON.parse(wert) : wert) as T;
	}

	/**
	 * Setzt einen Cookie
	 * @param name Name des Cookies
	 * @param wert Wert des Cookies
	 * @param json Ob Wert in json konvertiert werden soll
	 * @param maxAge Standard: 1 Jahr
	 */
	export function set(name: string, wert: any, json = true, maxAge = 31536000) {
		wert = json ? JSON.stringify(wert) : wert;
		document.cookie = `${name}=${wert}; max-age=${maxAge}`;
	}

	/**
	 * Löscht einen Cookie
	 * @param name Name des Cookies
	 */
	export function kill(name) {
		document.cookie = `${name}=; expires=Sun, 24 Dec 0000 18:42:00 GMT`;
	}
}

export default Cookie
