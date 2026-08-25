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
    echo [1/4] Starting PostgreSQL Database via Docker Compose...
    docker compose up -d postgres
)

echo.
echo [2/4] Installing PNPM dependencies if needed...
call pnpm install

echo.
echo [3/4] Generating Prisma Client and Pushing DB Schema...
call pnpm db:generate
call pnpm db:push
call pnpm db:seed

echo.
echo [4/4] Starting API Server & Web PWA Client in Parallel...
call pnpm dev

pause
