$stringsPath = "C:\Users\Fabian\Documents\App_FE_New\app\src\main\res\values\strings.xml"
$stringsContent = @"
<resources>
    <string name="app_name">Full Envios</string>
</resources>
"@

Set-Content -Path $stringsPath -Value $stringsContent -Force

$imgSource = "C:\Users\Fabian\.gemini\antigravity\brain\2f27ce83-62c6-4667-a131-484c183c8347\uploaded_media_1775363878703.png"

$resPath = "C:\Users\Fabian\Documents\App_FE_New\app\src\main\res"

if (Test-Path "$resPath\mipmap-anydpi-v26") {
    Remove-Item -Path "$resPath\mipmap-anydpi-v26\ic_launcher*.xml" -Force -ErrorAction SilentlyContinue
}

$folders = @("mipmap-mdpi", "mipmap-hdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi")

foreach ($folder in $folders) {
    if (-not (Test-Path "$resPath\$folder")) {
        New-Item -ItemType Directory -Force -Path "$resPath\$folder"
    }
    Copy-Item -Path $imgSource -Destination "$resPath\$folder\ic_launcher.png" -Force
    Copy-Item -Path $imgSource -Destination "$resPath\$folder\ic_launcher_round.png" -Force
    
    # Clean up old webp files from android studio
    Remove-Item -Path "$resPath\$folder\ic_launcher*.webp" -Force -ErrorAction SilentlyContinue
}
