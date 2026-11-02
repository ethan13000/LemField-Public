# LemField Alpha 5 installation

Version 1.10.59. Download the package matching your browser and extract it first.

## Chrome, Edge, Brave and Opera / Opera GX

Use **LemField-Alpha-5-Chromium.zip** (also provided as LemField-Alpha-5.zip). The unpacked working build is `LemField-Alpha-5-Chromium/`.

1. Open your extensions page: `chrome://extensions`, `edge://extensions`, `brave://extensions` or `opera://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
4. Refresh Moxfield tabs and pin LemField in the browser toolbar if desired.

Requires Chromium 120 or newer and the offscreen-document API. Chrome, Edge, Brave and Opera use the same Chromium package; their live installation and service behavior have not been verified in this environment. Enterprise browser policies may prevent unpacked extensions. Keep the extracted folder in place. To update, replace its files, click Reload on the extension's card and refresh Moxfield.

## Firefox

Use **LemField-Alpha-5-Firefox.zip**, or the original `moxfield-requirements/` working source.

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select the extracted `manifest.json`.
3. Refresh Moxfield tabs.

For an already loaded folder, click Reload beside LemField. Temporary add-ons need loading again after Firefox restarts; permanent installation requires Mozilla signing. Export your settings before changing installation folders.

## Safari

Safari is not supported by these packages.

Settings do not automatically transfer between browsers. Custom artwork is kept only in its open export tab. See ALPHA5_REVIEW.md for validation and remaining limitations.
