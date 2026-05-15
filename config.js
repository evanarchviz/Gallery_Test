window.EVANS_ARCHVIZ_CONFIG = {
    project: {
        title: "Gallery Test"
    },

    assets: {
        modelUrl: "assets/scene.glb",
        hdriUrl: "assets/fouriesburg_mountain_midday_2k.hdr"
    },

    spawn: {
        x: 0,
        y: 1.5,
        z: 0
    },

    player: {
        height: 1.7,
        radius: 0.35,
        desktopSpeed: 2,
        vrSpeed: 2,
        stepHeight: 0.2,
        gravity: 9.8,
        maxFallSpeed: 18,
        groundSnapDownDistance: 0.28
    },

    vr: {
        enabled: true,
        reloadOnSessionEnd: true,
        snapTurnDegrees: 30,
        teleportRayDistance: 25
    },

    meshes: {
        collisionNameIncludes: "collision",
        navmeshNameIncludes: "navmesh"
    },

    ui: {
        loadingTitle: "LOADING EXPERIENCE",
        loadingStartText: "Starting renderer...",
        loadingEnvironmentText: "Loading environment...",
        loadingSceneText: "Loading scene...",
        sceneReadyText: "Scene ready.",

        startTitle: "ENTER EXPERIENCE",

        desktopInstructions: [
            "WASD to move",
            "Mouse to look",
            "ESC to unlock"
        ],

        mobileInstructions: [
            "Left thumb: Move",
            "Right side swipe: Look",
            "Rotate device to landscape"
        ],

        iosInstallHint: "For best fullscreen experience on iPhone:<br>Tap Share → Add to Home Screen",

        rotateTitle: "Please rotate your device",
        rotateText: "This experience is landscape only.",

        desktopControlsText: "WASD to move • Mouse to look • ESC to unlock",
        mobileControlsText: "Left side = Move • Right side = Look"
    }
};
