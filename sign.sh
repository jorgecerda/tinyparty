#!/bin/bash
set -e

APP_PATH="release/mac/tinyparty.app"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: $APP_PATH does not exist."
  exit 1
fi

echo "1. Signing internal native libraries and helpers inside frameworks..."
# Sign Helpers inside Electron Framework first
if [ -d "$APP_PATH/Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers" ]; then
  find "$APP_PATH/Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers" -type f | while read -r file; do
    echo "Signing framework helper: $file"
    codesign --force --sign - "$file"
  done
fi

# Sign native libraries (.node, .dylib, .so)
find "$APP_PATH" -type f \( -name "*.node" -o -name "*.dylib" -o -name "*.so" \) | while read -r file; do
  echo "Signing lib: $file"
  codesign --force --sign - "$file"
done

echo "2. Signing frameworks..."
find "$APP_PATH/Contents/Frameworks" -type d -name "*.framework" | while read -r framework; do
  echo "Signing framework: $framework"
  codesign --force --sign - "$framework"
done

echo "3. Signing helper apps..."
find "$APP_PATH/Contents/Frameworks" -type d -name "*.app" | while read -r helper; do
  echo "Signing helper: $helper"
  codesign --force --sign - "$helper"
done

echo "4. Signing main application bundle..."
echo "Signing app: $APP_PATH"
codesign --force --sign - "$APP_PATH"

echo "5. Verifying signature..."
codesign --verify --deep --verbose=2 "$APP_PATH"
echo "Code signing complete and verified successfully!"
