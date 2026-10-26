@echo off
setlocal EnableExtensions DisableDelayedExpansion
title MDrawing - Aplikasi Lokal

pushd "%~dp0" >nul 2>&1
if errorlevel 1 goto gagal_folder

if not exist "package.json" goto gagal_proyek
if not exist "server.ts" goto gagal_proyek
if not exist "package-lock.json" goto gagal_proyek

where node.exe >nul 2>&1
if errorlevel 1 goto gagal_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto gagal_node
node -e "const [major,minor]=process.versions.node.split('.').map(Number); if(!((major===22&&minor>=18)||major===24)){console.error('Gunakan Node.js 22.18 atau lebih baru dalam versi 22, atau Node.js 24.');process.exit(1)}"
if errorlevel 1 goto gagal

set "HOST=127.0.0.1"
set "PORT=3888"
set "MDRAWING_LOCAL_URL=http://localhost:3888"

rem Reuse a running MDrawing instance; do not start another server on its port.
powershell.exe -NoLogo -NoProfile -Command "try { $h=Invoke-RestMethod -Uri ($env:MDRAWING_LOCAL_URL+'/api/health') -TimeoutSec 2; if($h.app -like 'MDrawing*' -and $h.postingMode -eq 'TRANSACTIONAL_COMMANDS'){exit 0} } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 goto sudah_berjalan

rem Stop with a clear message if another program already owns the local port.
node -e "const s=require('node:net').connect({host:'127.0.0.1',port:3888});s.once('connect',()=>{s.destroy();process.exit(2)});s.once('error',()=>process.exit(0));s.setTimeout(2000,()=>{s.destroy();process.exit(2)})"
if errorlevel 2 goto gagal_port
if errorlevel 1 goto gagal

if not exist "node_modules\.bin\vite.cmd" goto pasang
if not exist "node_modules\.bin\esbuild.cmd" goto pasang
goto periksa_build

:pasang
echo.
echo Menyiapkan aplikasi untuk penggunaan pertama. Internet diperlukan.
call npm.cmd ci --include=dev --no-audit --no-fund
if errorlevel 1 goto gagal

:periksa_build
set "NODE_ENV=production"
if not exist "dist\server.cjs" goto bangun
if not exist "dist\index.html" goto bangun
rem Rebuild only when an application input is newer than the existing build.
powershell.exe -NoLogo -NoProfile -Command "$ErrorActionPreference='Stop'; try { $built=(Get-Item -LiteralPath 'dist/server.cjs').LastWriteTimeUtc; $files=@(Get-ChildItem -LiteralPath 'src','server' -Recurse -File); foreach($p in @('server.ts','index.html','vite.config.ts','tsconfig.json','package.json','package-lock.json','firebase-applet-config.json')){ $files+=Get-Item -LiteralPath $p }; foreach($f in $files){if($f.LastWriteTimeUtc -gt $built){exit 1}};exit 0 } catch {exit 1}" >nul 2>&1
if errorlevel 1 goto bangun
goto buka

:bangun
echo.
echo Menyiapkan tampilan aplikasi. Mohon tunggu sampai selesai.
call npm.cmd run build
if errorlevel 1 goto gagal

:buka
echo.
echo MDrawing akan dibuka di %MDRAWING_LOCAL_URL%
echo Biarkan jendela ini terbuka selama menggunakan aplikasi.
echo Tutup jendela ini atau tekan Ctrl+C untuk menghentikan aplikasi.
echo.
rem Open the browser only after MDrawing responds, without a fixed startup delay.
if "%MDRAWING_LAUNCHER_NO_BROWSER%"=="1" goto jalankan
start "" powershell.exe -NoLogo -NoProfile -WindowStyle Hidden -Command "$url=$env:MDRAWING_LOCAL_URL; for($i=0;$i -lt 120;$i++){try{$h=Invoke-RestMethod -Uri ($url+'/api/health') -TimeoutSec 1;if($h.app -like 'MDrawing*' -and $h.postingMode -eq 'TRANSACTIONAL_COMMANDS'){Start-Process -FilePath $url;exit 0}}catch{};Start-Sleep -Seconds 1};exit 1"

:jalankan
rem Node loads optional local environment files; existing environment values take priority.
set "MDRAWING_ENV_FLAGS="
if exist ".env" set "MDRAWING_ENV_FLAGS=--env-file=.env"
if exist ".env.local" set "MDRAWING_ENV_FLAGS=%MDRAWING_ENV_FLAGS% --env-file=.env.local"
node %MDRAWING_ENV_FLAGS% dist\server.cjs
if errorlevel 1 goto gagal
echo.
echo Aplikasi telah berhenti.
goto selesai

:sudah_berjalan
echo MDrawing sudah berjalan. Membuka browser...
if "%MDRAWING_LAUNCHER_NO_BROWSER%"=="1" goto keluar
start "" "%MDRAWING_LOCAL_URL%"
goto keluar

:gagal_node
echo.
echo Node.js dan npm belum tersedia.
echo Pasang Node.js 22.18+ dalam versi 22 atau Node.js 24 dari https://nodejs.org/
echo Setelah pemasangan selesai, klik file ini lagi.
goto gagal

:gagal_proyek
echo.
echo Folder aplikasi belum lengkap.
echo Ekstrak ZIP terlebih dahulu, lalu letakkan file BAT ini di folder
echo yang sama dengan package.json, package-lock.json, dan server.ts.
goto gagal

:gagal_port
echo.
echo Alamat lokal port 3888 sedang digunakan aplikasi lain.
echo Tutup aplikasi tersebut, kemudian jalankan file ini lagi.
goto gagal

:gagal_folder
echo Folder aplikasi tidak dapat dibuka. Ekstrak ZIP ke folder yang dapat diakses.
pause
endlocal
exit /b 1

:gagal
echo.
echo Aplikasi belum dapat dijalankan. Periksa pesan di atas.
echo Konfigurasi Firebase dan layanan lain tetap memakai pengaturan proyek Anda.
pause
popd
endlocal
exit /b 1

:selesai
pause
:keluar
popd
endlocal
exit /b 0
