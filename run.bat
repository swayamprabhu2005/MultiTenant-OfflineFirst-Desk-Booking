@echo off
TITLE Multi-Tenant Offline-First Desk Booking SaaS

echo ========================================================
echo   Multi-Tenant Offline-First Desk Booking Platform
echo ========================================================
echo.

:: Check if docker is available
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Docker is not installed or not in PATH. Please start PostgreSQL manually if needed.
) else (
    echo [1/5] Starting PostgreSQL Database via Docker Compose...
    docker compose up -d postgres
    
    echo.
    echo [2/5] Waiting for PostgreSQL database to start up and be healthy...
    echo (Lower-spec PCs may take a few seconds to warm up the database)
    timeout /t 6 /nobreak >nul
)

echo.
echo [3/5] Installing PNPM workspace dependencies...
call pnpm install

echo.
echo [4/5] Generating Prisma Client and Pushing DB Schema...
call pnpm db:generate
call pnpm db:push
call pnpm db:seed

echo.
echo [5/5] Starting API Server ^& Web PWA Client in Parallel...
echo Press Ctrl+C in this terminal to terminate all processes.
call pnpm dev

pause
