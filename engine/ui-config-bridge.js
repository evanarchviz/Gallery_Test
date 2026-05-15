const engineConfig = window.EVANS_ARCHVIZ_CONFIG || {};
const projectConfig = engineConfig.project || {};
const uiConfig = engineConfig.ui || {};

function setText(selector, value) {
    if (value === undefined || value === null) return;
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
}

function setHTML(selector, value) {
    if (value === undefined || value === null) return;
    const element = document.querySelector(selector);
    if (element) element.innerHTML = value;
}

function replaceParagraphs(containerSelector, lines) {
    if (!Array.isArray(lines)) return;
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const existingHint = container.querySelector("#iosInstallHint");
    container.innerHTML = "";

    for (const line of lines) {
        const paragraph = document.createElement("p");
        paragraph.textContent = line;
        container.appendChild(paragraph);
    }

    if (existingHint) container.appendChild(existingHint);
}

if (projectConfig.title) document.title = projectConfig.title;

setText("#loadingScreen h1", uiConfig.loadingTitle);
setText("#startScreen h1", uiConfig.startTitle);
replaceParagraphs("#desktopInstructions", uiConfig.desktopInstructions);
replaceParagraphs("#mobileInstructions", uiConfig.mobileInstructions);
setHTML("#iosInstallHint", uiConfig.iosInstallHint);
setText("#rotateOverlay h2", uiConfig.rotateTitle);
setText("#rotateOverlay p", uiConfig.rotateText);
