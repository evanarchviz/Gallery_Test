import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/RGBELoader.js";

const engineConfig = window.EVANS_ARCHVIZ_CONFIG || {};
const assetConfig = engineConfig.assets || {};

const DEFAULT_MODEL_URL = "assets/scene.glb";
const DEFAULT_HDRI_PATH = "assets/";
const DEFAULT_HDRI_FILE = "fouriesburg_mountain_midday_2k.hdr";
const DEFAULT_HDRI_URL = `${DEFAULT_HDRI_PATH}${DEFAULT_HDRI_FILE}`;

const configuredModelUrl = assetConfig.modelUrl || DEFAULT_MODEL_URL;
const configuredHdriUrl = assetConfig.hdriUrl || DEFAULT_HDRI_URL;

const originalGltfLoad = GLTFLoader.prototype.load;
GLTFLoader.prototype.load = function patchedGltfLoad(url, onLoad, onProgress, onError) {
    const finalUrl = url === DEFAULT_MODEL_URL ? configuredModelUrl : url;
    return originalGltfLoad.call(this, finalUrl, onLoad, onProgress, onError);
};

const originalRgbeSetPath = RGBELoader.prototype.setPath;
RGBELoader.prototype.setPath = function patchedRgbeSetPath(path) {
    this.userData = this.userData || {};
    this.userData.evansArchvizOriginalPath = path;
    return originalRgbeSetPath.call(this, path);
};

const originalRgbeLoad = RGBELoader.prototype.load;
RGBELoader.prototype.load = function patchedRgbeLoad(url, onLoad, onProgress, onError) {
    const originalPath = this.userData?.evansArchvizOriginalPath || "";
    const combinedUrl = `${originalPath || ""}${url || ""}`;
    const finalUrl = combinedUrl === DEFAULT_HDRI_URL ? configuredHdriUrl : url;

    if (finalUrl === configuredHdriUrl) {
        originalRgbeSetPath.call(this, "");
    }

    return originalRgbeLoad.call(this, finalUrl, onLoad, onProgress, onError);
};
