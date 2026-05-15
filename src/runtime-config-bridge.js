import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const engineConfig = window.EVANS_ARCHVIZ_CONFIG || {};
const spawnConfig = engineConfig.spawn || {};

const DEFAULT_SPAWN = { x: 0, y: 1.5, z: 0 };
const configuredSpawn = {
    x: Number.isFinite(spawnConfig.x) ? spawnConfig.x : DEFAULT_SPAWN.x,
    y: Number.isFinite(spawnConfig.y) ? spawnConfig.y : DEFAULT_SPAWN.y,
    z: Number.isFinite(spawnConfig.z) ? spawnConfig.z : DEFAULT_SPAWN.z
};

function isDefaultSpawnVector(vector) {
    return vector &&
        vector.x === DEFAULT_SPAWN.x &&
        vector.y === DEFAULT_SPAWN.y &&
        vector.z === DEFAULT_SPAWN.z;
}

const originalVectorCopy = THREE.Vector3.prototype.copy;
THREE.Vector3.prototype.copy = function patchedVectorCopy(source) {
    if (isDefaultSpawnVector(source)) {
        source.set(configuredSpawn.x, configuredSpawn.y, configuredSpawn.z);
    }

    return originalVectorCopy.call(this, source);
};
