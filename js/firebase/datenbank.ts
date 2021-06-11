import {getAnalytics} from "firebase/analytics";
import {getDatabase, ref, Reference} from "firebase/database";

export let refs: {
	fahrer: Reference;
	strecken: Reference;
	bestimmt: {
		fahrer: (name: string) => Reference;
		strecken: (nummer: number) => Reference;
		routen: (nummer: number) => Reference
	};
	strecke: Reference,
	bestenliste: Reference
}

export default function datenbank() {
	const analytics = getAnalytics()
	const datenbank = getDatabase()
	refs = {
		strecke: ref(datenbank, "strecke"),
		fahrer: ref(datenbank, "fahrer"),
		strecken: ref(datenbank, "strecken"),
		bestenliste: ref(datenbank, "bestenliste"),

		bestimmt: {
			fahrer: (name: string) => ref(datenbank, "fahrer/" + name),
			strecken: (nummer: number) => ref(datenbank, "strecken/" + nummer),
			routen: (nummer: number) => ref(datenbank, "routen/" + nummer)
		}
	}

	return datenbank
}
