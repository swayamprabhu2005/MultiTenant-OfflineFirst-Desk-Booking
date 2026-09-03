@echo off
TITLE Multi-Tenant SaaS Control Plane
SETLOCAL EnableDelayedExpansion

echo ========================================================
echo   Multi-Tenant SaaS Control Plane - Platform ^& Org Admin
echo ========================================================
echo.

:: 1. Check if PostgreSQL is already active on port 5432
netstat -ano | findstr :5432 | findstr LISTENING >nul 2>nul
if !errorlevel! equ 0 (
    echo [1/5] PostgreSQL is active and listening on port 5432.
    goto clean_ports
)

:: 2. Check if Docker CLI is installed
where docker >nul 2>nul
if !errorlevel! neq 0 (
    echo [ERROR] Docker is not installed or not in PATH, and PostgreSQL is not listening on port 5432.
    echo Please start PostgreSQL manually on port 5432 or install Docker Desktop.
    pause
    exit /b 1
)

:: 3. Check if Docker engine/daemon is running
docker info >nul 2>nul
if !errorlevel! equ 0 goto start_postgres

echo [INFO] Docker CLI found, but Docker engine is not active.
echo Attempting to launch Docker Desktop...
if exist "D:\MyPrograms\Docker\Docker Desktop.exe" (
    start "" "D:\MyPrograms\Docker\Docker Desktop.exe"
) else if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
)

echo Waiting for Docker engine to become responsive (up to 30s)...
set DOCKER_ACTIVE=0
for /L %%i in (1,1,15) do (
    if !DOCKER_ACTIVE! equ 0 (
        timeout /t 2 /nobreak >nul
        docker info >nul 2>nul
        if !errorlevel! equ 0 set DOCKER_ACTIVE=1
    )
)
if !DOCKER_ACTIVE! equ 0 (
    echo [ERROR] Docker engine did not start in time. Please start Docker Desktop manually and retry.
    pause
    exit /b 1
)

:start_postgres
echo [1/5] Starting PostgreSQL Database via Docker Compose...
docker compose up -d postgres
if !errorlevel! neq 0 (
    echo [ERROR] Failed to start PostgreSQL container.
    pause
    exit /b 1
)

echo Waiting for PostgreSQL database to be healthy and listening on port 5432...
set DB_READY=0
for /L %%i in (1,1,15) do (
    if !DB_READY! equ 0 (
        netstat -ano | findstr :5432 | findstr LISTENING >nul 2>nul
        if !errorlevel! equ 0 (
            set DB_READY=1
        ) else (
            timeout /t 2 /nobreak >nul
        )
    )
)

if !DB_READY! equ 0 (
    echo [ERROR] PostgreSQL failed to start on port 5432 within 30 seconds.
    pause
    exit /b 1
)
echo PostgreSQL is ready and listening on port 5432.

:clean_ports
echo.
echo [2/5] Verifying and cleaning port allocations (Ports 3000 and 4000)...
:: Clean any lingering background processes on ports 4000 and 3000 to prevent EADDRINUSE / EPERM
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>nul
)
echo Port allocations verified.

:check_deps
echo.
echo [3/5] Installing PNPM workspace dependencies...
set CI=true
call pnpm install
if !errorlevel! neq 0 (
    echo [ERROR] PNPM install failed.
    pause
    exit /b 1
)

echo.
echo [4/5] Generating Prisma Client, Pushing DB Schema, and Seeding...
call pnpm db:generate
if !errorlevel! neq 0 (
    echo [ERROR] Prisma Client generation failed.
    pause
    exit /b 1
)

call pnpm db:push
if !errorlevel! neq 0 (
    echo [ERROR] Database schema push failed.
    pause
    exit /b 1
)

call pnpm db:seed
if !errorlevel! neq 0 (
    echo [ERROR] Database seeding failed.
    pause
    exit /b 1
)

echo.
echo [5/5] Starting API Server ^& Web Admin Portal in Parallel...
echo ========================================================
echo   Multi-Tenant SaaS Control Plane
echo   - Backend API: http://localhost:4000
echo   - Web Console: http://localhost:3000
echo   - Default Platform Admin: admin@deskbooking.com
echo   - Default Password:       DeskBook$2026#SecureOps!X9
echo ========================================================
echo Press Ctrl+C in this terminal to terminate all processes.
start "" cmd /c "timeout /t 10 >nul && start http://localhost:3000"
call pnpm dev

pause
