import {
	AdditiveBlending, BackSide, BufferAttribute, Group,
	Mesh, Path,
	PerspectiveCamera,
	Scene,
	ShaderMaterial,
	SphereGeometry, Texture,
	TextureLoader, Vector2,
	WebGLRenderer
} from "three";
import weltVertex from "../../shaders/welt/vertex.glsl";
import weltFragment from "../../shaders/welt/fragment.glsl";
import atmosphaereVertex from "../../shaders/atmosphaere/vertex.glsl";
import atmosphaereFragment from "../../shaders/atmosphaere/fragment.glsl";
// noinspection TypeScriptCheckImport
import {MeshLine, MeshLineMaterial, MeshLineRaycast} from 'three.meshline';
import {gsap} from "gsap"
import Tween = gsap.core.Tween;

// TODO in Konfiguration auslagern
const radius = 6
const segments = 50
const atmosphaereScale = 1.02
const anfang = -Math.PI / 2 - .2
const wegFarbe = 0xffffff;
const wegBreite = 8;
const wegAbstand = 1;
const wegStartWinkel = Math.PI / 2
const wegEndWinkel = wegStartWinkel - 2 * Math.PI
const fortschritt = .1
const fortschrittFarbe = 0x71c31e
const fortschrittBreite = wegBreite * 1.5
const fortschrittAbstand = wegAbstand + .15;
const fortschrittStartWinkel = wegStartWinkel
const fortschrittEndWinkel = fortschrittStartWinkel - fortschritt * (2 * Math.PI)
const hoehe = 16;
const anfangLaenge = .05;
const anfangAbstand = fortschrittAbstand
const anfangBreite = fortschrittBreite;
const anfangFarbe = 0x111111;

export default function welt() {
	const scene = new Scene()
	const camera = new PerspectiveCamera()
	camera.position.z = hoehe
	camera.aspect = 1
	const renderer = new WebGLRenderer({antialias: true})
	renderer.setPixelRatio(devicePixelRatio)

	const folgenGruppe = new Group()
	const bewegenGruppe = new Group()
	const offsetGruppe = new Group()
	offsetGruppe.rotation.y = anfang
	folgenGruppe.add(bewegenGruppe)
	bewegenGruppe.add(offsetGruppe)
	scene.add(folgenGruppe)

	// region Welt
	// let welt
	const texture = new Promise<Texture>(resolve => new TextureLoader().load(new URL(
		"../../img/Erde/Erde vereinfacht.jpg?as=webp&height=675&quality=20",
		import.meta.url
	).toString(), texture => {
		const welt = new Mesh(
			new SphereGeometry(radius, segments, segments),
			new ShaderMaterial({
				vertexShader: weltVertex,
				fragmentShader: weltFragment,
				uniforms: {
					globeTexture: {
						value: texture
					}
				}
			})
		)
		offsetGruppe.add(welt)
		resolve(texture)

		// region Bessere Textur nachladen
		// Experimental / non-standard
		// noinspection TypeScriptUnresolvedVariable
		const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
		// noinspection TypeScriptUnresolvedVariable
		const type = connection?.type;
		const url = (type === "cellular" ? new URL(
			"../../img/Erde/Erde.jpg?as=webp&height=1350&quality=50",
			import.meta.url
		) : new URL(
			"../../img/Erde/Erde.jpg?as=webp&height=1350&quality=80",
			import.meta.url
		)).toString()
		new TextureLoader().load(url, texture => {
			welt.material = new ShaderMaterial({
				vertexShader: weltVertex,
				fragmentShader: weltFragment,
				uniforms: {
					globeTexture: {
						value: texture
					}
				}
			})
		})
		// endregion
	}))
	// endregion

	// region Atmosphäre
	const atmosphaere = new Mesh(
		new SphereGeometry(radius, segments, segments),
		new ShaderMaterial({
			vertexShader: atmosphaereVertex,
			fragmentShader: atmosphaereFragment,
			side: BackSide,
			blending: AdditiveBlending
		})
	)
	atmosphaere.scale.set(atmosphaereScale, atmosphaereScale, atmosphaereScale)
	scene.add(atmosphaere)
	// endregion

	// region Weg & Fortschritt
	const kreise = []

	const positions = (
		abstand: number,
		start: number = 0,
		ende: number = 2 * Math.PI,
		anzahlSegmente: number = segments,
		map: (x: number, y: number) => [number, number, number] = (x, y) => [x, 0, y],
	) => new Path()
		.absarc(0, 0, radius + abstand, start, ende, true)
		.getPoints(anzahlSegmente)
		.flatMap(({x, y}) => map(x, y))

	const kreis = (
		farbe: number,
		breite: number,
		positions: number[] = [],
		anzeigen: boolean = true
	): MeshLine => {
		const line = new MeshLine()
		line.setPoints(positions)

		const material = new MeshLineMaterial({
			color: farbe,
			lineWidth: breite
			/*side: BackSide,
			blending: AdditiveBlending*/
		});

		const mesh = new Mesh(line, material)
		bewegenGruppe.add(mesh)
		return mesh
	}
	/*const zeichneKreis = (kreis: Line2, positions: number[]) => {
		kreis.geometry.setPositions(positions)
		kreis.geometry.attributes["position"].needsUpdate = true

	}*/

	// Weg
	const weg = positions(wegAbstand, wegStartWinkel, wegEndWinkel);
	const wegPositions = [...weg.slice(0, 3), ...weg.slice(0, 3).map(position => position + 0.00001), ...weg.slice(3, weg.length)]
// const wegKreis = kreis(wegFarbe, wegBreite, wegPositions, false)

// zeichneKreis(wegKreis, wegPositions.slice(0, 6))

	let i = 6; // zwei Punkte müssen mindestens gegeben sein
	const wegInterval = setInterval(() => {
		// zeichneKreis(wegKreis, wegPositions.slice(0, i))

		if (i === wegPositions.length) clearInterval(wegInterval)
		i += 3
	}, 20)
	// kreise.push(wegKreis)

	// Fortschritt
	/*const fortschrittPositions = positions(fortschrittAbstand, fortschrittStartWinkel, fortschrittEndWinkel);
	const fortschrittKreis = kreis(fortschrittFarbe, fortschrittBreite)
	kreise.push(fortschrittKreis)
	setSize()*/

	// Anfang
	// const anfangKreis = kreis(anfangFarbe, anfangBreite, positions(anfangAbstand, anfangLaenge, -anfangLaenge, segments, (x, y) => [0, y, x]))
	// kreise.push(anfangKreis)
	// endregion

	return async function () {
		await texture

		const wrapper = document.querySelector("header")
		const container = document.getElementById("welt")
		const anzeige = document.getElementById("anzeige")

		// Resizing
		const setSize = () => {
			const width = anzeige.clientWidth,
				height = anzeige.clientHeight
			const size = Math.min(width, height)

			camera.updateProjectionMatrix()
			// renderer.setSize(renderer.domElement.clientWidth, renderer.domElement.clientHeight);
			// const min =
			renderer.setSize(size, size);
			document.documentElement.style.setProperty("--erde-größe", size + "px")
			kreise.forEach(kreis => kreis.material.resolution = new Vector2(renderer.domElement.clientWidth, renderer.domElement.clientHeight))

			/*camera.aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight
			camera.updateProjectionMatrix()
			console.log("resizing: ", renderer.domElement.clientWidth, renderer.domElement.clientHeight)
			// renderer.setSize(renderer.domElement.clientWidth, renderer.domElement.clientHeight);
			// const min =
			// renderer.setSize(min, min);
			kreise.forEach(kreis => kreis.material.resolution = new Vector2(renderer.domElement.clientWidth, renderer.domElement.clientHeight))*/
		}

		// container.insertBefore(renderer.domElement, container.firstChild)
		anzeige.append(renderer.domElement)

		setSize()
		const resizeObserver = new ResizeObserver(setSize)
		resizeObserver.observe(anzeige, {box: "border-box"})

		// Folge cursor
		const cursorPosition = {x: 0, y: 0}
		let mussFolgen = false
		addEventListener('mousemove', event => {
			mussFolgen = true
			// 1 bzw. -1 an den Ecken von container
			cursorPosition.x = ((event.clientX - container.offsetLeft) / container.clientWidth) * 2 - 1.5
			cursorPosition.y = -((event.clientY - container.offsetTop) / container.clientHeight) * 2 + 1
		})

		// Bewegen
		{
			let tween: Tween | undefined
			const options = {passive: true}
			const last: { x: number | undefined, y: number | undefined } = {x: undefined, y: undefined}
			const listener = {
				down: () => {
					addEventListener("mousemove", listener.mouseMove, options);
					addEventListener("touchmove", listener.touchMove, {passive: false});
					document.body.classList.add("moving");
				},
				touchDown: (event: TouchEvent) => {
					last.x = event.touches[0].pageX
					last.y = event.touches[0].pageY
					listener.down()
				},
				move: (movementX: number, movementY: number, divisor: number) => {
					bewegenGruppe.rotation.y += movementX / divisor
					bewegenGruppe.rotation.x += movementY / 2000
					if (tween) tween.kill()
				},
				mouseMove: (event: MouseEvent) => listener.move(event.movementX, event.movementY, 400),
				touchMove: (event: TouchEvent) => {
					event.preventDefault()
					const newX = event.touches[0].pageX;
					const newY = event.touches[0].pageY;
					listener.move(newX - last.x, newY - last.y, 200)
					last.x = newX
					last.y = newY
				},
				up: () => {
					removeEventListener("mousemove", listener.mouseMove);
					removeEventListener("touchmove", listener.touchMove)
					document.body.classList.remove("moving");
					tween = gsap.to(bewegenGruppe.rotation, {
						x: 0,
						duration: 1.2,
					})
				}
			}
			wrapper.addEventListener("mousedown", listener.down)
			wrapper.addEventListener("touchstart", listener.touchDown)
			addEventListener("mouseup", listener.up)
			addEventListener("touchend", listener.up)
			addEventListener("touchcancel", listener.up)
		}

		// Animieren
		function animate() {
			requestAnimationFrame(animate)
			renderer.render(scene, camera)
			if (mussFolgen) gsap.to(folgenGruppe.rotation, {
				y: cursorPosition.x / 12,
				x: -cursorPosition.y / 12,
				duration: 2
			})
		}

		animate()
	}
}

export const aktualisieren = (wert: number) => {

}
