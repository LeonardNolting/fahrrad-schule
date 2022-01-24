import {ref, set} from "firebase/database";
import Datenbank from "../../firebase/datenbank";
import Kontrolle from "./kontrolle";

export default class NeueSchuleKontrolle extends Kontrolle {
	constructor() {
		super("neue-schule");
	}

	async destroy(): Promise<void> {
	}

	protected async init(): Promise<void> {
		this.erlaubt = true
	}

	protected async submit(): Promise<string> {
		const name = this.element("name").value;
		return set(ref(Datenbank.datenbank, "allgemein/schulen/liste/" + name), true)
			.then(() => "Neue Schule erstellt 👍")
	}

	protected async vorbereiten(): Promise<void> {
	}
}
