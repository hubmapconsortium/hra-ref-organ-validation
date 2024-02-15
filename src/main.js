// run `npx vite` to run server

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';

const canvas = document.querySelector(".webgl")
const scene = new THREE.Scene();

// Instantiate a loader
const loader = new GLTFLoader();

// Load a glTF resource
loader.load(
	// resource URL
	'../3d-vh-f-united.glb',
	// called when the resource is loaded
	function (glb) {
		console.log(glb)
		const obj = glb.scene;
		obj.scale.set(1, 1, 1)
		
		scene.add(obj);
	},
	// called while loading is progressing
	function (xhr) {

		console.log((xhr.loaded / xhr.total * 100) + '% loaded');

	},
	// called when loading has errors
	function (error) {
		console.log(error);
	}
);

	
const light = new THREE.DirectionalLight(0xffffff, 1)
light.position.set(2, 2, 5);
scene.add(light);

const sizes = {
	width: window.innerWidth,
	height: window.innerHeight
}

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(0, 1, 2)
scene.add(camera)

const renderer = new THREE.WebGL1Renderer(
	{
		canvas: canvas
	}
)

renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.gammaOuput = true

function animate() {
	requestAnimationFrame(animate)
	renderer.render(scene, camera)
}

animate()
