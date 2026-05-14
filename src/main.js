import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "https://unpkg.com/three@0.160.0/examples/jsm/libs/meshopt_decoder.module.js";
import { RGBELoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/RGBELoader.js";
import { VRButton } from "https://unpkg.com/three@0.160.0/examples/jsm/webxr/VRButton.js";
import { XRControllerModelFactory } from "https://unpkg.com/three@0.160.0/examples/jsm/webxr/XRControllerModelFactory.js";

let scene, camera, renderer;
let model;
let collisionMesh = null;
let navMesh = null;
let clock = new THREE.Clock();

let move = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

let canMove = false;
let isMobile = false;
let yawObject;
let pitchObject;
let pitch = 0;
let playerBaseY = 0;
let rightTurnReady = true;
let rightTeleportReady = true;

const playerHeight = 1.7;
const playerRadius = 0.35;
const speed = 2;
const vrSpeed = 2;
const stepHeight = 0.2;
const rightTurnAngle = THREE.MathUtils.degToRad(30);
const rightTurnThreshold = 0.75;
const rightTurnResetThreshold = 0.25;
const rightTeleportThreshold = -0.75;
const rightTeleportResetThreshold = -0.25;
const teleportRayDistance = 25;

const SPAWN = new THREE.Vector3(0, 1.5, 0);

const ui = {
    loadingScreen: document.getElementById("loadingScreen"),
    loadingStatus: document.getElementById("loadingStatus"),
    loadingProgress: document.getElementById("loadingProgress"),
    loadingPercent: document.getElementById("loadingPercent"),
    loadingError: document.getElementById("loadingError"),
    reloadButton: document.getElementById("reloadButton"),
    startScreen: document.getElementById("startScreen")
};

setStartScreenEnabled(false);
setLoadingProgress(0, "Starting renderer...");
init().catch((error) => showFatalError("Experience failed to start.", error));

function detectMobile() {
    const uaMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const smallScreen = window.innerWidth < 900;

    return uaMobile || (coarsePointer && smallScreen);
}

function setStartScreenEnabled(enabled) {
    if (!ui.startScreen) return;

    ui.startScreen.classList.toggle("is-hidden", !enabled);
    ui.startScreen.style.pointerEvents = enabled ? "auto" : "none";
}

function setLoadingProgress(value, status = "Loading...") {
    const percent = Math.max(0, Math.min(100, Math.round(value)));

    if (ui.loadingScreen) ui.loadingScreen.classList.remove("is-hidden");
    if (ui.loadingStatus) ui.loadingStatus.textContent = status;
    if (ui.loadingProgress) ui.loadingProgress.style.width = `${percent}%`;
    if (ui.loadingPercent) ui.loadingPercent.textContent = `${percent}%`;
}

function hideLoadingScreen() {
    if (!ui.loadingScreen) return;

    ui.loadingScreen.classList.add("is-hidden");
}

function showFatalError(title, error) {
    console.error(title, error);

    const detail = error?.message || String(error || "Unknown error.");

    setStartScreenEnabled(false);

    if (ui.loadingScreen) ui.loadingScreen.classList.remove("is-hidden");
    if (ui.loadingStatus) ui.loadingStatus.textContent = title;
    if (ui.loadingProgress) ui.loadingProgress.style.width = "100%";
    if (ui.loadingPercent) ui.loadingPercent.textContent = "Failed";

    if (ui.loadingError) {
        ui.loadingError.style.display = "block";
        ui.loadingError.textContent = detail;
    }

    if (ui.reloadButton) {
        ui.reloadButton.style.display = "inline-block";
        ui.reloadButton.onclick = () => window.location.reload();
    }
}

function loadHDRI(pmrem) {
    return new Promise((resolve) => {
        setLoadingProgress(10, "Loading environment...");

        new RGBELoader()
            .setPath("assets/")
            .load(
                "fouriesburg_mountain_midday_2k.hdr",
                (hdrTexture) => {
                    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
                    hdrTexture.center.set(0.5, 0.5);
                    hdrTexture.rotation = Math.PI / 2;

                    scene.background = hdrTexture;
                    scene.environment = pmrem.fromEquirectangular(hdrTexture).texture;
                    pmrem.dispose();

                    setLoadingProgress(25, "Environment ready...");
                    resolve(true);
                },
                undefined,
                (error) => {
                    console.warn("HDRI failed to load. Continuing with fallback lighting.", error);

                    scene.background = new THREE.Color(0x050505);
                    scene.environment = null;

                    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222222, 1.2);
                    scene.add(hemiLight);

                    pmrem.dispose();
                    setLoadingProgress(25, "Environment fallback active...");
                    resolve(false);
                }
            );
    });
}

async function loadSceneModel() {
    setLoadingProgress(30, "Preparing model decoder...");
    await MeshoptDecoder.ready;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    return new Promise((resolve, reject) => {
        loader.load(
            "assets/scene.glb",
            (gltf) => {
                model = gltf.scene;
                collisionMesh = null;
                navMesh = null;
                processModel(model);
                scene.add(model);

                setLoadingProgress(100, "Scene ready.");
                resolve(model);
            },
            (event) => {
                if (!event.lengthComputable || !event.total) {
                    setLoadingProgress(55, "Loading scene...");
                    return;
                }

                const scenePercent = (event.loaded / event.total) * 70;
                setLoadingProgress(30 + scenePercent, "Loading scene...");
            },
            (error) => {
                reject(new Error(`Could not load assets/scene.glb. ${error?.message || "Check the file path and hosting."}`));
            }
        );
    });
}
function addVRButton() {
    if (document.getElementById("VRButton")) return;
    document.body.appendChild(VRButton.createButton(renderer));
}
function getCollisionTarget() {
    return collisionMesh || model;
}
function processModel(root) {
    const glassNames = ["M_Glass_Darker", "glass", "win_glass"];

    root.traverse((child) => {
        if (!child.isMesh) return;

        const meshName = child.name.toLowerCase();

        if (meshName === "collision") {
            collisionMesh = child;
            child.visible = false;
            child.userData.ignoreCollision = false;
            console.info("Using GLB mesh named 'collision' as the sole continuous-movement collision target.");
            return;
        }

        if (meshName === "navmesh") {
            navMesh = child;
            child.visible = false;
            child.userData.ignoreCollision = true;
            console.info("Using GLB mesh named 'navmesh' as the VR teleport target.");
            return;
        }

        if (child.name === "Cube") {
            child.visible = false;
            child.userData.ignoreCollision = true;
            return;
        }

        if (Array.isArray(child.material)) {
            child.material = child.material.map(replaceMaterial);
        } else {
            child.material = replaceMaterial(child.material);
        }
    });

    if (!collisionMesh) {
        console.info("No GLB mesh named 'collision' found. Falling back to full-scene continuous-movement collision.");
    }

    if (!navMesh) {
        console.info("No GLB mesh named 'navmesh' found. VR teleport will stay disabled.");
    }

    function replaceMaterial(mat) {
        if (!mat || !mat.name) return mat;

        if (glassNames.some((name) => mat.name.includes(name))) {
            return new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                transmission: 1,
                transparent: true,
                opacity: 0.08,
                roughness: 0,
                metalness: 0,
                thickness: 0,
                ior: 1.45,
                depthWrite: false,
                side: THREE.DoubleSide
            });
        }

        if (mat.name.includes("Black")) {
            return new THREE.MeshBasicMaterial({ color: 0x000000 });
        }

        return mat;
    }
}

function addVRControllers() {
    const controllerModelFactory = new XRControllerModelFactory();

    for (let i = 0; i < 2; i++) {
        const controller = renderer.xr.getController(i);
        const rayGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1)
        ]);
        const rayMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.65 });
        const ray = new THREE.Line(rayGeometry, rayMaterial);
        ray.name = "controller-ray";
        ray.scale.z = 5;
        controller.add(ray);
        scene.add(controller);

        const grip = renderer.xr.getControllerGrip(i);
        grip.add(controllerModelFactory.createControllerModel(grip));
        scene.add(grip);
    }
}

async function init() {
    isMobile = detectMobile();

    const container = document.getElementById("container") || document.body;
    const controlsText = document.getElementById("controlsText");

    if (controlsText) {
        controlsText.innerText = isMobile
            ? "Left side = Move • Right side = Look"
            : "WASD to move • Mouse to look • ESC to unlock";
    }

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        800
    );

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    container.appendChild(renderer.domElement);

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    yawObject = new THREE.Object3D();
    pitchObject = new THREE.Object3D();
    yawObject.position.copy(SPAWN);
    yawObject.add(pitchObject);
    pitchObject.add(camera);
    scene.add(yawObject);
    addVRControllers();

    playerBaseY = SPAWN.y - playerHeight;

    const pmrem = new THREE.PMREMGenerator(renderer);

    await loadHDRI(pmrem);
    await loadSceneModel();

    setupInputControls();

    renderer.setAnimationLoop(animate);

    setTimeout(() => {
        hideLoadingScreen();
        setStartScreenEnabled(true);
        addVRButton();
    }, 250);
}

function setupInputControls() {
    if (!isMobile) {
        ui.startScreen?.addEventListener("click", () => {
            document.body.requestPointerLock();
        });

        document.addEventListener("pointerlockchange", () => {
            if (renderer.xr.isPresenting) return;

            if (document.pointerLockElement === document.body) {
                if (ui.startScreen) ui.startScreen.style.display = "none";
                canMove = true;
            } else {
                if (ui.startScreen) ui.startScreen.style.display = "flex";
                canMove = false;
            }
        });

        document.addEventListener("mousemove", (e) => {
            if (renderer.xr.isPresenting) return;
            if (document.pointerLockElement !== document.body) return;

            yawObject.rotation.y -= e.movementX * 0.002;
            pitch -= e.movementY * 0.002;
            pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
            pitchObject.rotation.x = pitch;
        });
    } else {
        ui.startScreen?.addEventListener("click", async () => {
            ui.startScreen.style.display = "none";
            canMove = true;

            if (document.documentElement.requestFullscreen) {
                try {
                    await document.documentElement.requestFullscreen();
                } catch (error) {
                    console.warn("Fullscreen request failed. Continuing without fullscreen.", error);
                }
            }

            setupMobileControls();
        });
    }

    renderer.xr.addEventListener("sessionstart", () => {
        canMove = true;
        rightTurnReady = true;
        rightTeleportReady = true;
        if (ui.startScreen) ui.startScreen.style.display = "none";

        document.exitPointerLock?.();
        yawObject.rotation.set(0, 0, 0);
        pitchObject.rotation.set(0, 0, 0);
        pitch = 0;
    });

    renderer.xr.addEventListener("sessionend", () => {
        window.location.reload();
    });

    document.addEventListener("keydown", (e) => {
        if (e.code === "KeyW") move.forward = true;
        if (e.code === "KeyS") move.backward = true;
        if (e.code === "KeyA") move.left = true;
        if (e.code === "KeyD") move.right = true;
    });

    document.addEventListener("keyup", (e) => {
        if (e.code === "KeyW") move.forward = false;
        if (e.code === "KeyS") move.backward = false;
        if (e.code === "KeyA") move.left = false;
        if (e.code === "KeyD") move.right = false;
    });
}

function setupMobileControls() {
    if (document.querySelector(".joystick")) return;

    const joystick = document.createElement("div");
    joystick.className = "joystick";
    document.body.appendChild(joystick);

    const stick = document.createElement("div");
    stick.className = "stick";
    joystick.appendChild(stick);

    let joystickTouchId = null;
    let lookTouchId = null;
    let centerX = 0;
    let centerY = 0;
    let lastLookX = 0;
    let lastLookY = 0;

    document.addEventListener("touchstart", (e) => {
        for (let touch of e.changedTouches) {
            if (touch.clientX < window.innerWidth / 2 && joystickTouchId === null) {
                joystickTouchId = touch.identifier;

                const rect = joystick.getBoundingClientRect();
                centerX = rect.left + rect.width / 2;
                centerY = rect.top + rect.height / 2;
            } else if (touch.clientX >= window.innerWidth / 2 && lookTouchId === null) {
                lookTouchId = touch.identifier;
                lastLookX = touch.clientX;
                lastLookY = touch.clientY;
            }
        }
    }, { passive: false });

    document.addEventListener("touchmove", (e) => {
        e.preventDefault();

        for (let touch of e.changedTouches) {
            if (touch.identifier === joystickTouchId) {
                const dx = touch.clientX - centerX;
                const dy = touch.clientY - centerY;
                const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 40);
                const angle = Math.atan2(dy, dx);

                stick.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;

                move.forward = dy < -10;
                move.backward = dy > 10;
                move.left = dx < -10;
                move.right = dx > 10;
            }

            if (touch.identifier === lookTouchId) {
                const deltaX = touch.clientX - lastLookX;
                const deltaY = touch.clientY - lastLookY;

                lastLookX = touch.clientX;
                lastLookY = touch.clientY;

                yawObject.rotation.y -= deltaX * 0.01;
                pitch -= deltaY * 0.01;
                pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
                pitchObject.rotation.x = pitch;
            }
        }
    }, { passive: false });

    document.addEventListener("touchend", (e) => {
        for (let touch of e.changedTouches) {
            if (touch.identifier === joystickTouchId) {
                joystickTouchId = null;
                stick.style.transform = "translate(0,0)";

                move.forward = false;
                move.backward = false;
                move.left = false;
                move.right = false;
            }

            if (touch.identifier === lookTouchId) {
                lookTouchId = null;
            }
        }
    });
}

function getDesktopMovementVector(delta) {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const movement = new THREE.Vector3();

    if (move.forward) movement.add(forward);
    if (move.backward) movement.addScaledVector(forward, -1);
    if (move.left) movement.addScaledVector(right, -1);
    if (move.right) movement.add(right);

    if (movement.length() > 0) {
        movement.normalize();
        movement.multiplyScalar(speed * delta);
    }

    return movement;
}

function getRightInputSource() {
    const session = renderer.xr.getSession();
    if (!session) return null;

    for (const source of session.inputSources) {
        if (source.handedness === "right") return source;
    }

    return null;
}

function getRightStickAxes() {
    const source = getRightInputSource();
    if (!source) return { x: 0, y: 0 };

    const gamepad = source.gamepad;
    if (!gamepad || !gamepad.axes || gamepad.axes.length < 2) return { x: 0, y: 0 };

    if (gamepad.axes.length >= 4) {
        return { x: gamepad.axes[2], y: gamepad.axes[3] };
    }

    return { x: gamepad.axes[0], y: gamepad.axes[1] };
}

function rotateRigAroundHead(angle) {
    const xrCamera = renderer.xr.getCamera(camera);
    const headBefore = new THREE.Vector3();
    const headAfter = new THREE.Vector3();

    xrCamera.getWorldPosition(headBefore);
    yawObject.rotation.y += angle;
    yawObject.updateMatrixWorld(true);
    xrCamera.getWorldPosition(headAfter);
    yawObject.position.add(headBefore.sub(headAfter));
}

function handleRightStickTurn(turnX) {
    if (Math.abs(turnX) < rightTurnResetThreshold) {
        rightTurnReady = true;
        return;
    }

    if (!rightTurnReady || Math.abs(turnX) < rightTurnThreshold) return;

    rotateRigAroundHead(turnX > 0 ? -rightTurnAngle : rightTurnAngle);
    rightTurnReady = false;
}

function teleportToNavmeshHit(hit) {
    const xrCamera = renderer.xr.getCamera(camera);
    const headPosition = new THREE.Vector3();
    xrCamera.getWorldPosition(headPosition);

    const headOffsetX = headPosition.x - yawObject.position.x;
    const headOffsetZ = headPosition.z - yawObject.position.z;

    playerBaseY = hit.point.y;
    yawObject.position.set(
        hit.point.x - headOffsetX,
        playerBaseY,
        hit.point.z - headOffsetZ
    );
}

function handleRightStickTeleport(frame, stickY) {
    if (stickY > rightTeleportResetThreshold) {
        rightTeleportReady = true;
        return;
    }

    if (!rightTeleportReady || stickY > rightTeleportThreshold) return;
    rightTeleportReady = false;

    if (!frame || !navMesh) return;

    const source = getRightInputSource();
    const referenceSpace = renderer.xr.getReferenceSpace();
    if (!source || !source.targetRaySpace || !referenceSpace) return;

    const pose = frame.getPose(source.targetRaySpace, referenceSpace);
    if (!pose) return;

    const matrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
    const origin = new THREE.Vector3().setFromMatrixPosition(matrix);
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(matrix).normalize();

    const raycaster = new THREE.Raycaster(origin, direction, 0, teleportRayDistance);
    const hits = raycaster
        .intersectObject(navMesh, true)
        .filter((hit) => !hit.object.userData.ignoreCollision);

    if (hits.length === 0) return;

    teleportToNavmeshHit(hits[0]);
}

function handleVRRightStickActions(frame) {
    const axes = getRightStickAxes();
    handleRightStickTurn(axes.x);
    handleRightStickTeleport(frame, axes.y);
}

function getVRMovementVector(delta) {
    const session = renderer.xr.getSession();
    if (!session) return new THREE.Vector3();

    const movement = new THREE.Vector3();

    for (const source of session.inputSources) {
        if (source.handedness === "right") continue;

        const gamepad = source.gamepad;
        if (!gamepad || !gamepad.axes || gamepad.axes.length < 2) continue;

        let x = 0;
        let y = 0;

        if (gamepad.axes.length >= 4) {
            x = gamepad.axes[2];
            y = gamepad.axes[3];
        } else {
            x = gamepad.axes[0];
            y = gamepad.axes[1];
        }

        const deadzone = 0.15;
        if (Math.abs(x) < deadzone) x = 0;
        if (Math.abs(y) < deadzone) y = 0;
        if (x === 0 && y === 0) continue;

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(yawObject.quaternion);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3(1, 0, 0)
            .applyQuaternion(yawObject.quaternion);
        right.y = 0;
        right.normalize();

        movement.addScaledVector(forward, -y);
        movement.addScaledVector(right, x);
    }

    if (movement.length() > 0) {
        movement.normalize();
        movement.multiplyScalar(vrSpeed * delta);
    }

    return movement;
}

function applyMovement(movement) {
    const collisionTarget = getCollisionTarget();
    if (!collisionTarget) return;

    const proposed = yawObject.position.clone().add(movement);

    if (movement.length() > 0) {
        const midHeight = playerBaseY + playerHeight * 0.5;
        const ray = new THREE.Raycaster(
            new THREE.Vector3(yawObject.position.x, midHeight, yawObject.position.z),
            movement.clone().normalize(),
            0,
            playerRadius
        );

        const hits = ray
            .intersectObject(collisionTarget, true)
            .filter((hit) => !hit.object.userData.ignoreCollision);

        if (hits.length === 0) {
            yawObject.position.copy(proposed);
        }
    }

    const footRay = new THREE.Raycaster(
        new THREE.Vector3(yawObject.position.x, playerBaseY + stepHeight, yawObject.position.z),
        new THREE.Vector3(0, -1, 0),
        0,
        stepHeight + 0.5
    );

    const groundHits = footRay
        .intersectObject(collisionTarget, true)
        .filter((hit) => !hit.object.userData.ignoreCollision);

    if (groundHits.length > 0) {
        playerBaseY = groundHits[0].point.y;
    }

    yawObject.position.y = renderer.xr.isPresenting
        ? playerBaseY
        : playerBaseY + playerHeight;
}

function animate(time, frame) {
    const delta = clock.getDelta();

    if (canMove && model) {
        if (renderer.xr.isPresenting) {
            handleVRRightStickActions(frame);
        }

        const movement = renderer.xr.isPresenting
            ? getVRMovementVector(delta)
            : getDesktopMovementVector(delta);

        applyMovement(movement);
    }

    renderer.render(scene, camera);
}
