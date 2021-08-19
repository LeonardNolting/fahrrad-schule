import {get, onChildAdded, onValue, ref, update} from "firebase/database";
import {Datenbank} from "../firebase/datenbank/datenbank";
import Popup from "../popup";
import benachrichtigung from "../benachrichtigungen/benachrichtigung";
import BenachrichtigungsLevel from "../benachrichtigungen/benachrichtigungsLevel";
import {createUserWithEmailAndPassword, getAuth} from "firebase/auth";

interface NeueSaisonSchuleLi extends HTMLLIElement {
	checkbox: HTMLInputElement
	potAnzahlFahrerInput: HTMLInputElement
}

export namespace Admin {
	export async function neueKlasse() {
		const popup = document.getElementById("popup-admin-neue-klasse")
		onValue(ref(Datenbank.datenbank, "allgemein/saisons/aktuell"), snap => {
			const aktuell = snap.val()

			popup["schule"].innerHTML = ""
			onChildAdded(
				ref(Datenbank.datenbank, "allgemein/saisons/details/" + aktuell + "/schulen/liste"),
				snap => popup["schule"].append(new Option(snap.key, snap.key))
			)

			popup.onsubmit = async event => {
				event.preventDefault()
				try {
					const email = popup["email"].value;
					const password = popup["password"].value;
					const schule = popup["schule"].value;
					const klasse = popup["name"].value;

					const auth = getAuth();
					const admin = auth.currentUser

					// Neues Konto erstellen
					const {user} = await createUserWithEmailAndPassword(auth, email, password)
					// UID merken
					const {uid} = user
					// Zurück zum Admin-Konto wechseln
					await auth.updateCurrentUser(admin)

					const updates = {}
					updates["spezifisch/klassen/details/" + schule + "/" + klasse] = {email, uid}
					updates["spezifisch/klassen/liste/" + schule + "/" + klasse] = true
					await update(ref(Datenbank.datenbank), updates)
						// Wenn was nicht funktioniert, vorherigen Status wiederherstellen
						.catch(reason => user.delete().then(() => Promise.reject(reason)))

					benachrichtigung("Neue Klasse erstellt 👍")
					Popup.schliessen(popup)
				} catch (error) {
					console.error(error)
					benachrichtigung("Konnte keinen Account für die Klasse einrichten: " + error, BenachrichtigungsLevel.ALARM)
				}
			}
			popup["abbrechen"].onclick = () => Popup.schliessen(popup)
			Popup.oeffnen(popup)
		}, {onlyOnce: true})
	}

	export async function neueSaison() {
		const popup = document.getElementById("popup-admin-neue-saison")

		const nameInput = popup["name"];
		let jahr = new Date().getFullYear()
		// Wenn noch in demselben Jahr, in dem eine Saison beendet wurde, eine Neue gestartet wird, soll diese für das nächste Jahr sein.
		while ((await get(ref(Datenbank.datenbank, "allgemein/saisons/liste/" + jahr))).exists()) jahr++
		nameInput.value = jahr.toString()

		const schulenUl = popup.querySelector(".schulen")
		schulenUl.innerHTML = ""

		const schulenListener = onChildAdded(ref(Datenbank.datenbank, "allgemein/schulen/liste"), snap => {
			const schule = snap.key

			const li = document.createElement("li") as NeueSaisonSchuleLi
			li.classList.add("schule")

			const div = document.createElement("div")
			const checkbox = document.createElement("input")
			checkbox.type = "checkbox"
			checkbox.value = schule
			const checkboxId = "admin-neue-saison-schule-" + schule;
			checkbox.id = checkboxId
			const label = document.createElement("label")
			label.htmlFor = checkboxId
			label.textContent = schule
			div.append(checkbox, label)
			li.checkbox = checkbox

			const potAnzahlFahrerDiv = document.createElement("div")
			potAnzahlFahrerDiv.classList.add("pot-anzahl-fahrer")
			const potAnzahlFahrerInput = document.createElement("input")
			potAnzahlFahrerInput.type = "number"
			potAnzahlFahrerInput.step = "10"
			const potAnzahlFahrerInputId = "admin-neue-saison-schule-" + schule + "-pot-anzahl-fahrer"
			checkbox.addEventListener("change", () => {
				potAnzahlFahrerInput.required = checkbox.checked
				potAnzahlFahrerDiv.classList[checkbox.checked ? "add" : "remove"]("sichtbar")
			})
			const potAnzahlFahrerLabel = document.createElement("label")
			potAnzahlFahrerLabel.htmlFor = potAnzahlFahrerInputId
			potAnzahlFahrerLabel.textContent = "pot. Anzahl Teilnehmer:"
			potAnzahlFahrerDiv.append(potAnzahlFahrerLabel, potAnzahlFahrerInput)
			li.potAnzahlFahrerInput = potAnzahlFahrerInput

			li.append(div, potAnzahlFahrerDiv)
			schulenUl.append(li)
		})
		popup.onsubmit = async event => {
			event.preventDefault()
			const teilnehmendeSchulen = (Array.from(schulenUl.children) as NeueSaisonSchuleLi[])
				.filter(li => li.checkbox.checked)
				.map(li => ({
					name: li.checkbox.value,
					potAnzahlFahrer: li.potAnzahlFahrerInput.value
				}))

			if (teilnehmendeSchulen.length === 0)
				return benachrichtigung("Bitte wählen Sie mindestens eine Schule aus.", BenachrichtigungsLevel.INFO)

			schulenListener()

			const name = nameInput.value
			const updates = {}
			updates["allgemein/saisons/liste/" + name] = true
			teilnehmendeSchulen.forEach(({name: schule, potAnzahlFahrer}) => {
				updates["allgemein/saisons/details/" + name + "/schulen/liste/" + schule] = true
				updates["allgemein/saisons/details/" + name + "/schulen/details/" + schule + "/potAnzahlFahrer"] = potAnzahlFahrer
				updates["allgemein/saisons/details/" + name + "/runden"] = parseInt(popup["runden"].value)
			})
			await update(ref(Datenbank.datenbank), updates)
				.then(() => {
					Popup.schliessen(popup)
					benachrichtigung("Saison erstellt 😎", BenachrichtigungsLevel.ERFOLG)
				})
				.catch(reason => {
					console.error(reason)
					benachrichtigung("Beim Erstellen der Saison ist ein Fehler aufgetreten: " + reason, BenachrichtigungsLevel.ALARM)
				})
		}
		popup["abbrechen"].onclick = () => Popup.schliessen(popup)
		Popup.oeffnen(popup)
	}
}

export default async () => {
	document.body.classList.add("admin")

	const form = document.getElementById("admin-anzeige") as HTMLFormElement
	const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement
	const button = (name: string) => form[name] as HTMLButtonElement

	form.onsubmit = event => event.preventDefault()

	await new Promise(resolve => {
		const knopf = button("neue-saison")
		// * Neue Saison: nur wenn nicht schon eine aktuelle Saison existiert
		onValue(ref(Datenbank.datenbank, "allgemein/saisons/aktuell"), snap => {
			knopf.disabled = snap.val() !== null;
			resolve()
		})

		// Neue Saison: allgemein/saisons/aktuell setzen, aktuell leeren
		knopf.onclick = () => Admin.neueSaison()
	})

	await new Promise(resolve => {
		const knopf = button("neue-klasse")
		// * Klasse eintragen: nur wenn eine aktuelle Saison existiert
		onValue(ref(Datenbank.datenbank, "allgemein/saisons/aktuell"), async snap => {
			knopf.disabled = snap.val() === null;
			resolve()
		})

		knopf.onclick = () => Admin.neueKlasse()
	})

	await new Promise(resolve => {
		const knopf = button("saisonstart")
		// TODO neue Zeitenstruktur
		// * Saisonstart festlegen/verändern: nur wenn noch keiner gegeben oder dieser noch verändert werden kann (nicht schon passiert ist)
		onValue(ref(Datenbank.datenbank, "allgemein/saisons/laufend"), snap => {
			knopf.disabled = true
			const laufend = snap.val();
			if (laufend !== null) {
				onValue(ref(Datenbank.datenbank, "allgemein/saisons/details/" + laufend + "/zeit/start"), snap => {
					const start = snap.val();
					if (start === null || start > Date.now()) knopf.disabled = false
					resolve()
				})
			} else resolve()
		})

		// Saisonstart gesetzt: allgemein/saisons/aktiv setzen
		// Saisonstart passiert: allgemein/saisons/laufend setzen
	})

	await new Promise(resolve => {
		const knopf = button("saisonende")
		// TODO neue Zeitenstruktur
		// * Saisonende festlegen/verändern: nur wenn noch keines gegeben oder dieses noch verändert werden kann (nicht schon passiert ist)
		onValue(ref(Datenbank.datenbank, "allgemein/saisons/laufend"), snap => {
			knopf.disabled = true
			const laufend = snap.val();
			if (laufend !== null) {
				onValue(ref(Datenbank.datenbank, "allgemein/saisons/details/" + laufend + "/zeit/ende"), snap => {
					const ende = snap.val();
					if (ende === null || ende > Date.now()) knopf.disabled = false
					resolve()
				})
			} else resolve()
		})

		// Saisonende passiert: allgemein/saisons/laufend entfernen, allgemein/saisons/aktuell entfernen
	})

	await new Promise(resolve => {
		const knopf = button("saison-loeschen")
		// * Saison löschen: nur wenn eine aktuelle Saison existiert
		onValue(ref(Datenbank.datenbank, "allgemein/saisons/aktuell"), async snap => {
			knopf.disabled = snap.val() === null;
			resolve()
			// TODO Neuladen empfehlen (nach Löschen einer Saison, da keine listener auf Saison onChildRemoved)
		})

		// Saison gelöscht: allgemein/saisons/aktuell entfernen, allgemein/saisons/laufend entfernen, allgemein/saisons/aktiv ggf. ändern, spezifisch löschen?
	})

	await new Promise(resolve => {
		const knopf = button("strecke-loeschen")
		onValue(ref(Datenbank.datenbank, "allgemein/saisons/laufend"), snap => {
			knopf.disabled = snap.val() === null;
			resolve()
		})
	})

	await new Promise(resolve => {
		const knopf = button("testnachricht")
		resolve()
	})

	await new Promise(resolve => {
		const knopf = button("neue-schule")
		knopf.disabled = true
		resolve()
	})

	fieldset.disabled = false
}
