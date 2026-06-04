Write-Host "Installing Capacitor Core..."
npm install @capacitor/core
Write-Host "Installing Capacitor CLI and Android tools..."
npm install -D @capacitor/cli @capacitor/android
Write-Host "Initializing Capacitor project..."
npx cap init "LaCajitaTV" "tv.lacajita.app" --web-dir dist
Write-Host "Building Vite Web App..."
npm run build
Write-Host "Adding Android Platform..."
npx cap add android
Write-Host "Capacitor Setup Complete!"
