import Popup from "./popup";
import {Datenbank} from "./firebase/datenbank/datenbank";
import {get, onChildAdded, onValue, push, ref, serverTimestamp, set, Unsubscribe} from "firebase/database";
import Route from "./model/route";
import {onAuthStateChanged, signOut, User} from "firebase/auth";
import benachrichtigung from "./benachrichtigungen/benachrichtigung";
import {adminEmail} from "./konfiguration";
import {auth, authentifizieren} from "./firebase/authentifizierung";
import Cookie from "./cookie";
import load from "./load";
import Cookies from "./cookies";

const emailVonKlasse = (schule: string, klasse: string) => new Promise<string>(resolve => {
	onValue(ref(Datenbank.datenbank, "spezifisch/klassen/details/" + schule + "/" + klasse + "/email"), snap => {
		resolve(snap.val())
	}, {onlyOnce: true})
})

type PopupInfo = {
	element: HTMLFormElement,
	vorbereiten: (eintragung: Eintragung, element: HTMLFormElement) => void,
	vorbereitet: boolean
}

/**
 * Registriert ein bestehendes Popup des Eintragen-Prozesses mit der id "popup-eintragen-" + name
 * @param name
 * @param buttons Liste an Knöpfen; Key muss name-Attribut entsprechen; abbrechen ist optional und wir automatisch gehandled
 * @param vorbereiten
 */
const popup = (name: string, buttons: {
	abbrechen?: true,
	[button: string]: ((eintragung: Eintragung, element: HTMLFormElement) => Promise<void> | void) | true
}, vorbereiten: (eintragung: Eintragung, element: HTMLFormElement) => void = () => {
}): PopupInfo => {
	const element = document.getElementById("popup-eintragen-" + name) as HTMLFormElement;

	// Wenn dieses Popup geschlossen wird, beende die aktuelle Eintragung
	element.addEventListener("close", () => Eintragung.offen?.geschlossen())

	// Button-Klicks werden unten abgefangen
	element.addEventListener("submit", event => event.preventDefault());

	// Abbrechen-Button automatisch generieren
	if ("abbrechen" in buttons) {
		const button = document.createElement("input")
		button.type = "button"
		button.value = "Abbrechen"
		button.name = "abbrechen"
		button.classList.add("links", "leer")
		const buttons = element.querySelector("fieldset.buttons");
		buttons.insertBefore(button, buttons.firstChild)
	}

	Object.entries(buttons).forEach(([name, action]) =>
		element[name].addEventListener("click", () => {
			const eintragung = Eintragung.offen;
			if (name === "abbrechen")
				eintragung.schliessen()
			else if ((name === "zurueck" || element.reportValidity()) && action !== true)
				load(action(eintragung, element))
		}))

	return {
		element,
		vorbereiten,
		vorbereitet: false
	}
}
const popups = {
	authentifizierung: popup("authentifizierung", {
		weiter: async (eintragung, element) => {
			const data = Object.fromEntries(["schule", "klasse", "passwort"].map(it => [it, element[it].value])) as { schule: string, klasse: string, passwort: string }
			const email = await emailVonKlasse(data.schule, data.klasse)

			eintragung.angemeldetBleiben = Cookies.optional() && (element["angemeldet-bleiben"] as HTMLInputElement).checked
			await authentifizieren(email, data.passwort, eintragung.angemeldetBleiben)
				.then(() => eintragung.authentifizierungSetzen(data.schule, data.klasse))
		}
	}, (eintragung, element) => new Promise(resolve => {
		const schulen = element["schule"] as HTMLSelectElement
		const klassen = element["klasse"] as HTMLSelectElement & { listener: Unsubscribe }

		const probieren = () => {
			if (Eintragung.laufend !== undefined && Eintragung.leer !== undefined) resolve()
		}

		const klassenFuellen = (schule: string) => {
			klassen.innerHTML = ""
			klassen.listener?.()
			klassen.listener = onChildAdded(ref(Datenbank.datenbank, "spezifisch/klassen/liste/" + schule), snap => {
				const klasse = snap.key
				const standard = schule === this.schule && klasse === this.klasse
				klassen.add(new Option(klasse, klasse, standard, standard))
			})
		}

		onValue(ref(Datenbank.datenbank, "allgemein/saisons/laufend"), snap => {
			Eintragung.laufend = snap.val()
			probieren()

			schulen.innerHTML = ""
			get(ref(Datenbank.datenbank, "allgemein/saisons/details/" + Eintragung.laufend + "/schulen/liste")).then(snap => {
				snap.forEach(childSnap => {
					const schule = childSnap.key
					schulen.add(new Option(schule, schule))
				})
				if (this.schule) schulen.value = this.schule
				else if (schulen.value) klassenFuellen(schulen.value)
			})
		})
		onValue(ref(Datenbank.datenbank, "spezifisch/klassen/leer"), snap => {
			Eintragung.leer = snap.val() === null ? true : snap.val()
			probieren()
		})

		schulen.addEventListener("change", () => klassenFuellen(schulen.value))
	})),
	name: popup("name", {
		abbrechen: true,
		direkt: async (eintragung, element) => {
			await eintragung.nameSetzen((element["name"] as HTMLInputElement).value)
			eintragung.optionSetzen("direkt")
		},
		berechnen: async (eintragung, element) => {
			await eintragung.nameSetzen((element["name"] as HTMLInputElement).value)
			eintragung.optionSetzen("berechnen")
		}
	}),
	nameGegeben: popup("name-gegeben", {
		abbrechen: true,
		direkt: eintragung => eintragung.optionSetzen("direkt"),
		berechnen: eintragung => eintragung.optionSetzen("berechnen")
	}, async (eintragung, element) => {
		(element["abmelden"] as HTMLButtonElement).addEventListener("click", () => {
			signOut(auth)
			eintragung.schliessen()
		});
		["schule", "klasse", "name"].forEach(it => element.querySelector("." + it).textContent = eintragung[it])
		element.querySelector(".strecke").textContent = await new Promise(resolve => onValue(
			ref(Datenbank.datenbank, "spezifisch/fahrer/" + eintragung.fahrer + "/strecke"),
			snap => resolve(snap.val() || 0),
			{onlyOnce: true}))
	}),
	berechnen: popup("berechnen", {
		abbrechen: true,
		zurueck: async eintragung => {
			await eintragung.nameSetzen(undefined)
			eintragung.optionSetzen(undefined)
		},
		weiter: (eintragung, element) => eintragung.meterSetzen(1000) // TODO berechnete meter benutzen
	}, () => {
		/*(document.getElementById("eintragen-karte-knopf") as HTMLDetailsElement)
			.addEventListener("toggle", () => new google.maps.Map(document.getElementById("eintragen-karte"), {
				center: koordinaten.hoechstadt,
				mapTypeControl: false,
				clickableIcons: false,
				fullscreenControl: false,
				keyboardShortcuts: false,
				rotateControl: false,
				streetViewControl: false,
				zoom: 11
			}), {once: true})*/
	}),
	direkt: popup("direkt", {
		abbrechen: true,
		zurueck: async eintragung => {
			await eintragung.nameSetzen(undefined)
			eintragung.optionSetzen(undefined)
		},
		weiter: (eintragung, element) =>
			eintragung.meterSetzen(parseInt((element["kilometer"] as HTMLInputElement).value) * 1000)
	}),
	datenschutz: popup("datenschutz", {
		abbrechen: true,
		zurueck: eintragung => eintragung.meterSetzen(undefined),
		weiter: eintragung => {
			eintragung.datenschutz = true
			return eintragung.speichern()
		}
	}),
	fertig: popup("fertig", {
		schliessen: eintragung => eintragung.schliessen()
	})
}

export class Eintragung {
	option: "berechnen" | "direkt" = undefined
	offen: boolean = false
	offenesPopup: PopupInfo = undefined

	angemeldetBleiben = false
	schule: string = undefined
	klasse: string = undefined
	name: string = undefined
	fahrer: string = undefined
	meter: number = undefined
	datenschutz: boolean = false

	private constructor() {
		Eintragung.eintragungen.push(this)
	}

	async oeffnen() {
		// Abbrechen falls schon eine Eintragung offen
		if (!!Eintragung.offen) return

		// Ist ja schon offen ...
		if (this.offen) return

		// Auth state ist schon bekannt
		if (Eintragung.user !== undefined) {
			if (Eintragung.user !== null && Eintragung.user.email === adminEmail) {
				// Eingelogged aber als Admin...
				await signOut(auth)
				Eintragung.user = null // onAuthStateChanged ist evtl. etwas verspätet
			}

			if (Eintragung.user === null) {
				// Muss sich anmelden

				// Vorab vorbereiten, damit Eintragung.laufend und Eintragung.leer gesetzt werden
				await this.popupVorbereiten(popups.authentifizierung)

				// Keine Saison
				if (Eintragung.laufend === null) return benachrichtigung("Es können aktuell keine Eintragungen vorgenommen werden.")

				// Keine Klassen
				if (Eintragung.leer !== false) return benachrichtigung("Es wurden noch keine Klassen für die laufende Saison eingetragen.") // TODO "bitte s. #mitmachen ...

				await this.popupOeffnen(popups.authentifizierung)
			} else {
				const fahrer = Cookie.get<string>("fahrer", false)
				if (fahrer) {
					// Ist schon angemeldet
					this.angemeldetBleiben = true
					this.fahrer = fahrer
					const {
						schule,
						klasse,
						name
					} = (await get(ref(Datenbank.datenbank, "spezifisch/fahrer/" + fahrer))).val()
					this.schule = schule
					this.klasse = klasse
					this.name = name
					await this.popupOeffnen(popups.nameGegeben)
				} else {
					// Ist schon angemeldet, es fehlt aber der Cookie, weshalb nicht klar ist, bei welcher Klasse der Nutzer angemeldet ist
					// Nutzer wollte wahrscheinlich angemeldet bleiben, da ja user !== null, deswegen angemeldet bleiben auf checked setzen
					(popups.authentifizierung.element["angemeldet-bleiben"] as HTMLInputElement).checked = true
					// TODO schule & klasse herausfinden durch querying -> wird automatisch ausgefüllt
					// this.schule =
					// this.klasse =
					await signOut(auth)
					await this.oeffnen()
				}
			}
		} else await load(new Promise(resolve => {
			// Sonst halt warten und nochmal probieren...
			const listener = onAuthStateChanged(auth, user => {
				listener()
				Eintragung.user = user
				resolve()
				this.oeffnen()
			})
		}))
	}

	schliessen() {
		this.popupSchliessen()
		this.geschlossen()
	}

	geschlossen() {
		this.offen = false
		this.offenesPopup = undefined
	}

	popupSchliessen() {
		if (this.offenesPopup) Popup.schliessen(this.offenesPopup.element)
		else Popup.alleSchliessen()
	}

	async popupVorbereiten(popup: PopupInfo) {
		if (!popup.vorbereitet) {
			popup.vorbereitet = true
			await popup.vorbereiten(this, popup.element)
		}
	}

	async popupOeffnen(popup: PopupInfo) {
		await this.popupVorbereiten(popup)

		// Altes schließen, Neues öffnen
		if (this.offenesPopup) this.popupSchliessen()
		this.offenesPopup = popup
		this.offen = true
		Popup.oeffnen(popup.element)
	}

	async nameSetzen(name: string | undefined) {
		this.name = name
		this.fahrer = name === undefined ? undefined :
			(await fahrerBekommen(this.schule, this.klasse, name) || await fahrerErstellen(this.schule, this.klasse, name))
		if (this.angemeldetBleiben) Cookie.set("fahrer", this.fahrer, false)
	}

	optionSetzen(option: "direkt" | "berechnen" | undefined) {
		this.option = option
		this.popupOeffnen(popups[option] || popups.name)
	}

	meterSetzen(wert: number) {
		this.meter = wert
		this.popupOeffnen(wert !== undefined ? popups.datenschutz : popups[this.option])
	}

	authentifizierungSetzen(schule: string, klasse: string) {
		this.schule = schule
		this.klasse = klasse

		// Fahrer autocomplete
		const datalist = (document.getElementById("eintragen-fahrer") as HTMLDataListElement)
		datalist.innerHTML = ""
		onChildAdded(
			ref(Datenbank.datenbank, "spezifisch/klassen/details/" + schule + "/" + klasse + "/fahrer"),
			snap => datalist.append(new Option(undefined, snap.key))
		)

		this.popupOeffnen(popups.name)
	}

	async speichern() {
		if (!this.schule || !this.klasse) throw new Error("Noch nicht angemeldet.")
		if (!Eintragung.user) throw new Error("Authentifizierung abgelaufen.")
		if (!this.name) throw new Error("Name noch nicht eingetragen.")
		if (!this.meter) throw new Error("Länge noch nicht eingetragen.")
		if (!this.datenschutz) throw new Error("Datenschutzerklärung wurde noch nicht zugestimmt.")

		const strecke = await streckeErstellen(this.fahrer, this.meter)

		/*if (route) {
			// TODO überlegen: sind immer beide Orte gegeben? entsprechend spezifisch/orte updaten...
			await routeErstellen(strecke, route)
		}*/

		await this.popupOeffnen(popups.fertig)
	}

	static eintragungen: Eintragung[] = []

	/**
	 * angemeldet: User
	 * nicht angemeldet: null
	 * unbekannt: undefined
	 */
	static user: User | null | undefined

	static get offen(): Eintragung | null {
		return Eintragung.eintragungen.find(eintragung => eintragung.offen)
	}

	static async eintragen(): Promise<Eintragung> {
		const eintragung = new Eintragung()
		await load(eintragung.oeffnen())
		return eintragung
	}

	static laufend: string | null | undefined = undefined
	static leer: boolean | undefined = undefined
}

/**
 *
 * @param schule
 * @param klasse
 * @param name
 * @return id ID des existierenden Fahrers
 */
const fahrerBekommen = (schule: string, klasse: string, name: string) => new Promise<string | null>(resolve => onValue(
	ref(Datenbank.datenbank, "spezifisch/klassen/details/" + schule + "/" + klasse + "/fahrer/" + name),
	snap => resolve(snap.val()),
	{onlyOnce: true}))

/**
 *
 * @param schule
 * @param klasse
 * @param name
 * @return id ID des neuen Fahrers
 */
const fahrerErstellen = (schule: string, klasse: string, name: string) => push(
	ref(Datenbank.datenbank, "spezifisch/fahrer"),
	{schule, klasse, name}
).then(({key}) => key)

/**
 *
 * @param fahrer
 * @param strecke
 * @return id ID der neuen Strecke
 */
const streckeErstellen = (fahrer: string, strecke: number) => push(
	ref(Datenbank.datenbank, "spezifisch/strecken"),
	{fahrer, strecke, zeitpunkt: serverTimestamp()}
).then(({key}) => key)

const routeErstellen = (strecke: string, route: Route) => set(ref(Datenbank.datenbank, "spezifisch/routen/" + strecke), route)
