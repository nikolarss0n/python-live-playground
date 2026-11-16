#!/usr/bin/env bash
# Builds the macOS app: the web build with Pyodide bundled for offline use, the Swift shell, and the .app around them.
# Output: build/mac/Python Live Playground.app (ad-hoc signed, App Sandbox on).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="Python Live Playground"
BUNDLE_ID="dev.local.python-live-playground"
OUT="$ROOT/build/mac"
WEB="$OUT/web"
APP="$OUT/$APP_NAME.app"
CACHE="$ROOT/macos/.cache"
PYODIDE_VERSION="$(node -p "require('$ROOT/node_modules/pyodide/package.json').version")"
SQLITE_WHEEL="sqlite3-1.0.0-cp312-cp312-pyodide_2024_0_wasm32.whl"
SQLITE_SHA256="43061928762b03482676a1e11dcef99a003148e59fe914b6a3e41180c382cfc3"
CONFIG="${CONFIG:-release}"

echo "Web build (Pyodide $PYODIDE_VERSION served from the app)"
rm -rf "$WEB"
(cd "$ROOT" && npx tsc -b && VITE_TARGET=mac VITE_PYODIDE_INDEX=/pyodide/ npx vite build --outDir "$WEB" --emptyOutDir)
if grep -q 'fonts.googleapis' "$WEB/index.html"; then echo 'The Mac build still links Google Fonts' >&2; exit 1; fi

mkdir -p "$WEB/pyodide" "$CACHE"
for file in pyodide.asm.js pyodide.asm.wasm pyodide.mjs pyodide.js python_stdlib.zip pyodide-lock.json; do
  cp "$ROOT/node_modules/pyodide/$file" "$WEB/pyodide/"
done
if [[ ! -f "$CACHE/$SQLITE_WHEEL" ]]; then
  curl -fsSL "https://cdn.jsdelivr.net/pyodide/v$PYODIDE_VERSION/full/$SQLITE_WHEEL" -o "$CACHE/$SQLITE_WHEEL.part"
  mv "$CACHE/$SQLITE_WHEEL.part" "$CACHE/$SQLITE_WHEEL"
fi
echo "$SQLITE_SHA256  $CACHE/$SQLITE_WHEEL" | shasum -a 256 -c --quiet
cp "$CACHE/$SQLITE_WHEEL" "$WEB/pyodide/"

echo "Swift build ($CONFIG)"
swift build --package-path "$ROOT/macos" -c "$CONFIG"
BIN="$(swift build --package-path "$ROOT/macos" -c "$CONFIG" --show-bin-path)/PythonPlayground"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/PythonPlayground"
cp -R "$WEB" "$APP/Contents/Resources/web"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleExecutable</key><string>PythonPlayground</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>27.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.education</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeName</key><string>Python script</string>
      <key>CFBundleTypeRole</key><string>Editor</string>
      <key>LSHandlerRank</key><string>Alternate</string>
      <key>LSItemContentTypes</key><array><string>public.python-script</string></array>
    </dict>
  </array>
</dict>
</plist>
PLIST

codesign --force --sign - --options runtime --entitlements "$ROOT/macos/PythonPlayground.entitlements" "$APP"
echo "Built: $APP"
