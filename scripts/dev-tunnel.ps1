# Expose local Vite (5173) via Microsoft Dev Tunnels.
# Vite serves HTTP locally — MUST use --protocol http or you get 502 Bad Gateway.
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Host ""
Write-Host "Prerequisites:"
Write-Host "  1. npm run dev   (Vite on port 5173)"
Write-Host "  2. python app.py (Flask on port 5000, in sociochat-backend)"
Write-Host ""
Write-Host "Starting public Dev Tunnel for port 5173..."
Write-Host "Use the printed https://*-5173.inc1.devtunnels.ms URL in your browser."
Write-Host ""

devtunnel host -p 5173 --allow-anonymous --protocol http
