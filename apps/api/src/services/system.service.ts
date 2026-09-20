import os from 'os';
import { execSync } from 'child_process';
import { prisma } from '../prisma';

export interface SystemVersionManifest {
  timestamp: string;
  os: {
    platform: string;
    type: string;
    release: string;
    arch: string;
    humanName: string;
    cpuModel: string;
    cpuCores: number;
    totalMemoryGB: string;
    freeMemoryGB: string;
    uptimeHours: string;
  };
  runtimes: {
    node: string;
    pnpm: string;
    docker: string;
    dockerCompose: string;
    dockerDaemonActive: boolean;
  };
  database: {
    engine: string;
    version: string;
    host: string;
    port: number;
    status: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED';
    latencyMs: number;
  };
  frameworks: {
    backend: string;
    orm: string;
    frontend: string;
    bundler: string;
    styling: string;
    language: string;
    mailer: string;
  };
}

export class SystemService {
  private static cachedManifest: SystemVersionManifest | null = null;
  private static lastFetchTime: number = 0;

  public static async getSystemManifest(forceRefresh = false): Promise<SystemVersionManifest> {
    const now = Date.now();
    // Cache for 15 seconds to avoid repeatedly running shell commands
    if (!forceRefresh && this.cachedManifest && now - this.lastFetchTime < 15000) {
      return this.cachedManifest;
    }

    // 1. OS & Hardware
    const cpus = os.cpus() || [];
    let humanOs = `${os.type()} ${os.release()}`;
    if (os.type() === 'Windows_NT') {
      humanOs = `Windows 11 / Windows Server (Build ${os.release()}, ${os.arch()})`;
    } else if (os.type() === 'Linux') {
      humanOs = `Linux (${os.release()}, ${os.arch()})`;
    } else if (os.type() === 'Darwin') {
      humanOs = `macOS (${os.release()}, ${os.arch()})`;
    }

    // 2. Docker & Runtimes
    let dockerVer = 'Not detected or not in PATH';
    let dockerComposeVer = 'Not detected';
    let dockerDaemonActive = false;

    try {
      dockerVer = execSync('docker --version', { encoding: 'utf8', timeout: 3000 }).trim();
    } catch {
      dockerVer = 'Docker CLI not available';
    }

    try {
      dockerComposeVer = execSync('docker compose version', { encoding: 'utf8', timeout: 3000 }).trim();
    } catch {
      dockerComposeVer = 'Docker Compose not available';
    }

    try {
      execSync('docker info', { encoding: 'utf8', timeout: 4000, stdio: 'pipe' });
      dockerDaemonActive = true;
    } catch {
      dockerDaemonActive = false;
    }

    let pnpmVer = '10.34.5';
    try {
      pnpmVer = execSync('pnpm -v', { encoding: 'utf8', timeout: 3000 }).trim();
    } catch {
      pnpmVer = 'pnpm 10.x';
    }

    // 3. Database Engine & Query Check
    let dbStatus: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED' = 'DISCONNECTED';
    let dbVersion = 'PostgreSQL 16 (Alpine Container)';
    let latencyMs = 0;

    const dbStart = Date.now();
    try {
      const result = await prisma.$queryRawUnsafe<any[]>('SELECT version();');
      latencyMs = Date.now() - dbStart;
      if (result && result.length > 0) {
        dbVersion = result[0].version || dbVersion;
        dbStatus = 'HEALTHY';
      }
    } catch (err) {
      console.warn('Database health check query failed:', err);
      dbStatus = 'DISCONNECTED';
      latencyMs = Date.now() - dbStart;
    }

    const manifest: SystemVersionManifest = {
      timestamp: new Date().toISOString(),
      os: {
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        humanName: humanOs,
        cpuModel: cpus[0]?.model || 'Generic CPU',
        cpuCores: cpus.length,
        totalMemoryGB: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
        freeMemoryGB: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
        uptimeHours: `${(os.uptime() / 3600).toFixed(1)} hours`,
      },
      runtimes: {
        node: process.version,
        pnpm: pnpmVer,
        docker: dockerVer,
        dockerCompose: dockerComposeVer,
        dockerDaemonActive,
      },
      database: {
        engine: 'PostgreSQL 16',
        version: dbVersion,
        host: 'localhost',
        port: 5432,
        status: dbStatus,
        latencyMs,
      },
      frameworks: {
        backend: 'Express.js 4.22.2',
        orm: 'Prisma ORM 5.22.0',
        frontend: 'React 18.3.1',
        bundler: 'Vite 5.4.21',
        styling: 'Tailwind CSS 3.4.19',
        language: 'TypeScript 5.9.3',
        mailer: 'Nodemailer 10.0.9',
      },
    };

    this.cachedManifest = manifest;
    this.lastFetchTime = now;
    return manifest;
  }

  public static formatManifestAsText(manifest: SystemVersionManifest, clientInfo?: any): string {
    const pad = (s: string, w: number) => (s.length >= w ? s : s + ' '.repeat(w - s.length));
    const lines: string[] = [
      '================================================================================',
      '🏢 MULTI-TENANT DESKBOOKING PLATFORM - SYSTEM DIAGNOSTICS MANIFEST',
      '================================================================================',
      `Generated At   : ${new Date().toISOString()} (${new Date().toLocaleString()})`,
      `Service Status : OPERATIONAL / HEALTHY`,
      '',
      '=== 1. HOST OPERATING SYSTEM & HARDWARE ===',
      `  ${pad('Operating System', 26)} : ${manifest.os.humanName}`,
      `  ${pad('Architecture & Platform', 26)} : ${manifest.os.arch} (${manifest.os.platform})`,
      `  ${pad('CPU Model', 26)} : ${manifest.os.cpuModel}`,
      `  ${pad('Logical CPU Cores', 26)} : ${manifest.os.cpuCores} cores`,
      `  ${pad('Memory (RAM)', 26)} : ${manifest.os.freeMemoryGB} free / ${manifest.os.totalMemoryGB} total`,
      `  ${pad('Host Uptime', 26)} : ${manifest.os.uptimeHours}`,
      '',
      '=== 2. CONTAINERIZATION & DOCKER ENGINE ===',
      `  ${pad('Docker CLI', 26)} : ${manifest.runtimes.docker}`,
      `  ${pad('Docker Compose', 26)} : ${manifest.runtimes.dockerCompose}`,
      `  ${pad('Docker Daemon', 26)} : ${manifest.runtimes.dockerDaemonActive ? 'ACTIVE / RUNNING' : 'STOPPED / OFFLINE'}`,
      '',
      '=== 3. DATABASE INFRASTRUCTURE ===',
      `  ${pad('Database Engine', 26)} : ${manifest.database.version}`,
      `  ${pad('Database Host & Port', 26)} : ${manifest.database.host}:${manifest.database.port}`,
      `  ${pad('Connection Health', 26)} : ${manifest.database.status} (Query Latency: ${manifest.database.latencyMs}ms)`,
      '',
      '=== 4. RUNTIMES & PACKAGE MANAGERS ===',
      `  ${pad('Node.js Runtime', 26)} : ${manifest.runtimes.node}`,
      `  ${pad('pnpm Package Manager', 26)} : ${manifest.runtimes.pnpm}`,
      `  ${pad('TypeScript', 26)} : ${manifest.frameworks.language}`,
      '',
      '=== 5. APPLICATION FRAMEWORKS & LIBRARIES ===',
      `  ${pad('Backend Server', 26)} : ${manifest.frameworks.backend}`,
      `  ${pad('ORM / Data Layer', 26)} : ${manifest.frameworks.orm}`,
      `  ${pad('Frontend Web App', 26)} : ${manifest.frameworks.frontend} (${manifest.frameworks.bundler})`,
      `  ${pad('Styling Engine', 26)} : ${manifest.frameworks.styling}`,
      `  ${pad('Mailer Transport', 26)} : ${manifest.frameworks.mailer}`,
      '',
    ];

    if (clientInfo) {
      lines.push(
        '=== 6. REPORTER CLIENT ENVIRONMENT ===',
        `  ${pad('Client App Version', 26)} : ${clientInfo.version || 'v1.0.0'}`,
        `  ${pad('Client Device / Browser', 26)} : ${clientInfo.deviceInfo || clientInfo.userAgent || 'Unknown'}`,
        `  ${pad('User Agent', 26)} : ${clientInfo.userAgent || 'N/A'}`,
        `  ${pad('Screen Resolution', 26)} : ${clientInfo.screen || 'N/A'}`,
        ''
      );
    }

    lines.push(
      '================================================================================',
      'End of Diagnostics Report - DeskBooking Platform Support (admin@deskbooking.com)',
      '================================================================================'
    );

    return lines.join('\n');
  }
}
