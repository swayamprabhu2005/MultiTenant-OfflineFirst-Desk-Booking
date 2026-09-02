@echo off
TITLE Multi-Tenant SaaS Control Plane
SETLOCAL EnableDelayedExpansion

echo ========================================================
echo   Multi-Tenant SaaS Control Plane - Platform ^& Org Admin
echo ========================================================
echo.

:: Check if PostgreSQL is already active on port 5432
netstat -ano | findstr :5432 | findstr LISTENING >nul 2>nul
if %errorlevel% equ 0 (
    echo [1/5] PostgreSQL is already active and listening on port 5432.
) else (
    where docker >nul 2>nul
    if %errorlevel% neq 0 (
        echo [WARNING] Docker is not installed or not in PATH. Please start PostgreSQL manually if needed.
    ) else (
        echo [1/5] Starting PostgreSQL Database via Docker Compose...
        docker compose up -d postgres
        
        echo.
        echo [2/5] Waiting for PostgreSQL database to start up and be healthy...
        timeout /t 5 /nobreak >nul
    )
)

echo.
echo [3/5] Installing PNPM workspace dependencies...
set CI=true
call pnpm install

echo.
echo [4/5] Generating Prisma Client, Pushing DB Schema, and Seeding...
call pnpm db:generate
call pnpm db:push
call pnpm db:seed

echo.
echo [5/5] Starting API Server ^& Web Admin Portal in Parallel...
echo Press Ctrl+C in this terminal to terminate all processes.
start "" cmd /c "timeout /t 4 >nul && start http://localhost:3000"
call pnpm dev

pause
