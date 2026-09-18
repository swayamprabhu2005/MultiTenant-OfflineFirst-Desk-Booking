import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';

export interface ParsedBranch {
  branchId: string;
  name: string;
  buildingCount: number;
  buildings: ParsedBuilding[];
}

export interface ParsedBuilding {
  buildingId: string;
  name: string;
  floorCount: number;
  floors: ParsedFloor[];
}

export interface ParsedFloor {
  floorId: string;
  floorNumber: number;
  name: string;
  sectionCount: number;
  sections: ParsedSection[];
}

export interface ParsedSection {
  name: string;
  direction: string;
  standardDeskCount: number;
  hdmiDeskCount: number;
  hasMeetingRoom: boolean;
  meetingRoomCapacity: number;
  meetingRoomHdmi: number;
}

export interface ParsedWorkspace {
  orgId: string;
  orgName: string;
  branchCount: number;
  branches: ParsedBranch[];
}

export interface ValidationResult {
  success: boolean;
  data?: ParsedWorkspace;
  errorCount: number;
  errorsSummary: string[];
  errorWorkbookBuffer?: Buffer;
}

function getTemplateFilePath(): string {
  const candidatePaths = [
    path.resolve(process.cwd(), 'templates/Workspace_FloorPlan_Template.xlsx'),
    path.resolve(process.cwd(), '../../templates/Workspace_FloorPlan_Template.xlsx'),
    path.resolve(__dirname, '../../../../templates/Workspace_FloorPlan_Template.xlsx'),
    path.resolve(__dirname, '../../../templates/Workspace_FloorPlan_Template.xlsx'),
    path.resolve(process.cwd(), 'Workspace_FloorPlan_Template.xlsx'),
    path.resolve(process.cwd(), '../../Workspace_FloorPlan_Template.xlsx'),
    path.resolve(__dirname, '../../../../Workspace_FloorPlan_Template.xlsx'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.resolve(process.cwd(), 'templates/Workspace_FloorPlan_Template.xlsx');
}

/**
 * Generates an Excel template pre-filled with the active organization's ID and Name
 * Uses JSZip for non-destructive in-place XML updating of Sheet 1, preventing ExcelJS
 * from corrupting or splitting Sheet 5 DataValidation ranges (H2:H401 vs H10:H401).
 */
export async function generateOrgTemplate(orgId: string, orgName: string): Promise<Buffer> {
  const templateFile = getTemplateFilePath();

  const fileData = await fs.promises.readFile(templateFile);
  const zip = await JSZip.loadAsync(fileData);

  const sheet1File = zip.file('xl/worksheets/sheet1.xml');
  if (sheet1File) {
    let sheet1Xml = await sheet1File.async('string');

    const escapeXml = (str: string) =>
      str.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
          default: return c;
        }
      });

    // Replace Cell A5 (Organization ID)
    sheet1Xml = sheet1Xml.replace(
      /(<c r="A5"[^>]*><is><t>)[^<]*(<\/t><\/is><\/c>)/,
      `$1${escapeXml(orgId)}$2`
    );

    // Replace Cell B5 (Organization Name)
    sheet1Xml = sheet1Xml.replace(
      /(<c r="B5"[^>]*><is><t>)[^<]*(<\/t><\/is><\/c>)/,
      `$1${escapeXml(orgName)}$2`
    );

    zip.file('xl/worksheets/sheet1.xml', sheet1Xml);
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return buffer;
}

/**
 * Validates and parses the uploaded Workspace Excel template
 */
export async function parseAndValidateWorkspace(
  fileBuffer: Buffer,
  expectedOrgId: string
): Promise<ValidationResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);

  const sheetOrg = workbook.getWorksheet('Organization');
  const sheetBranches = workbook.getWorksheet('Branches');
  const sheetBuildings = workbook.getWorksheet('Buildings');
  const sheetFloors = workbook.getWorksheet('Floors');
  const sheetSections = workbook.getWorksheet('Sections & Cubicles');

  const errorsBySheet: Record<string, Record<number, string[]>> = {
    Organization: {},
    Branches: {},
    Buildings: {},
    Floors: {},
    'Sections & Cubicles': {},
  };

  const addError = (sheetName: string, rowNumber: number, msg: string) => {
    if (!errorsBySheet[sheetName]) errorsBySheet[sheetName] = {};
    if (!errorsBySheet[sheetName][rowNumber]) errorsBySheet[sheetName][rowNumber] = [];
    errorsBySheet[sheetName][rowNumber].push(msg);
  };

  if (!sheetOrg || !sheetBranches || !sheetBuildings || !sheetFloors || !sheetSections) {
    return {
      success: false,
      errorCount: 1,
      errorsSummary: ['Invalid template format: Missing one or more required sheets.'],
    };
  }

  // 1. VALIDATE SHEET 1: Organization
  const orgIdCell = sheetOrg.getCell('A5').text?.trim();
  const orgNameCell = sheetOrg.getCell('B5').text?.trim();
  const branchCountVal = Number(sheetOrg.getCell('C5').value);

  if (!branchCountVal || isNaN(branchCountVal) || branchCountVal < 1) {
    addError('Organization', 5, 'Number of Branches must be a positive integer greater than 0.');
  }

  const expectedBranchCount = Math.max(1, isNaN(branchCountVal) ? 1 : branchCountVal);

  // 2. VALIDATE SHEET 2: Branches
  const parsedBranches: ParsedBranch[] = [];
  let totalBuildingsExpected = 0;

  for (let r = 2; r <= expectedBranchCount + 1; r++) {
    const branchRow = sheetBranches.getRow(r);
    const branchId = branchRow.getCell(1).text?.trim() || `BR${String(r - 1).padStart(3, '0')}`;
    const branchName = branchRow.getCell(2).text?.trim();
    const buildingCountVal = Number(branchRow.getCell(3).value);

    if (!branchName) {
      addError('Branches', r, 'Branch Name is required.');
    }
    if (!buildingCountVal || isNaN(buildingCountVal) || buildingCountVal < 1) {
      addError('Branches', r, 'Number of Buildings must be a positive integer greater than 0.');
    } else {
      totalBuildingsExpected += buildingCountVal;
    }

    parsedBranches.push({
      branchId,
      name: branchName || '',
      buildingCount: isNaN(buildingCountVal) ? 0 : buildingCountVal,
      buildings: [],
    });
  }

  // 3. VALIDATE SHEET 3: Buildings
  const parsedBuildingsList: ParsedBuilding[] = [];
  let currentBranchIdx = 0;
  let buildingsInCurrentBranch = 0;
  let totalFloorsExpected = 0;

  for (let r = 2; r <= totalBuildingsExpected + 1; r++) {
    const row = sheetBuildings.getRow(r);
    const buildingId = row.getCell(2).text?.trim() || `BLD${String(r - 1).padStart(3, '0')}`;
    const buildingName = row.getCell(3).text?.trim();
    const floorCountVal = Number(row.getCell(4).value);

    if (!buildingName) {
      addError('Buildings', r, 'Building Name is required.');
    }
    if (!floorCountVal || isNaN(floorCountVal) || floorCountVal < 1) {
      addError('Buildings', r, 'Number of Floors must be a positive integer greater than 0.');
    } else {
      totalFloorsExpected += floorCountVal;
    }

    const buildingObj: ParsedBuilding = {
      buildingId,
      name: buildingName || '',
      floorCount: isNaN(floorCountVal) ? 0 : floorCountVal,
      floors: [],
    };
    parsedBuildingsList.push(buildingObj);

    // Associate with parent branch
    if (parsedBranches[currentBranchIdx]) {
      parsedBranches[currentBranchIdx].buildings.push(buildingObj);
      buildingsInCurrentBranch++;
      if (buildingsInCurrentBranch >= parsedBranches[currentBranchIdx].buildingCount) {
        currentBranchIdx++;
        buildingsInCurrentBranch = 0;
      }
    }
  }

  // 4. VALIDATE SHEET 4: Floors
  const parsedFloorsList: ParsedFloor[] = [];
  let currentBuildingIdx = 0;
  let floorsInCurrentBuilding = 0;
  let totalSectionsExpected = 0;

  for (let r = 2; r <= totalFloorsExpected + 1; r++) {
    const row = sheetFloors.getRow(r);
    const floorId = row.getCell(4).text?.trim() || `${currentBuildingIdx + 1}-FL${String(floorsInCurrentBuilding + 1).padStart(2, '0')}`;
    const sectionCountVal = Number(row.getCell(5).value);

    if (!sectionCountVal || isNaN(sectionCountVal) || sectionCountVal < 1 || sectionCountVal > 4) {
      addError('Floors', r, 'Number of Sections must be an integer between 1 and 4.');
    } else {
      totalSectionsExpected += sectionCountVal;
    }

    const floorObj: ParsedFloor = {
      floorId,
      floorNumber: floorsInCurrentBuilding + 1,
      name: `Floor ${floorsInCurrentBuilding + 1}`,
      sectionCount: isNaN(sectionCountVal) ? 0 : sectionCountVal,
      sections: [],
    };
    parsedFloorsList.push(floorObj);

    if (parsedBuildingsList[currentBuildingIdx]) {
      parsedBuildingsList[currentBuildingIdx].floors.push(floorObj);
      floorsInCurrentBuilding++;
      if (floorsInCurrentBuilding >= parsedBuildingsList[currentBuildingIdx].floorCount) {
        currentBuildingIdx++;
        floorsInCurrentBuilding = 0;
      }
    }
  }

  // 5. VALIDATE SHEET 5: Sections & Cubicles
  let currentFloorIdx = 0;
  let sectionsInCurrentFloor = 0;

  for (let r = 2; r <= totalSectionsExpected + 1; r++) {
    const row = sheetSections.getRow(r);
    const sectionName = row.getCell(4).text?.trim() || `Section ${sectionsInCurrentFloor + 1}`;
    const standardDeskCount = Number(row.getCell(5).value);
    const hdmiDeskCount = Number(row.getCell(6).value || 0);
    const hasMeetingRoomRaw = row.getCell(7).text?.trim()?.toLowerCase();
    const meetingRoomCapacity = Number(row.getCell(8).value || 0);
    const meetingRoomHdmi = Number(row.getCell(9).value || 0);

    // Standard desk validation
    if (isNaN(standardDeskCount) || standardDeskCount < 1) {
      addError('Sections & Cubicles', r, 'Number of Cubicals (Excluding Meeting Room) must be greater than 0.');
    }
    if (isNaN(hdmiDeskCount) || hdmiDeskCount < 0) {
      addError('Sections & Cubicles', r, 'Number of Cubicals Having HDMI must be 0 or greater.');
    } else if (hdmiDeskCount > standardDeskCount) {
      addError('Sections & Cubicles', r, `Number of Cubicals Having HDMI (${hdmiDeskCount}) cannot exceed total cubicles (${standardDeskCount}).`);
    }

    // Meeting Room validation
    const hasMeetingRoom = hasMeetingRoomRaw === 'yes';
    if (!hasMeetingRoomRaw || (hasMeetingRoomRaw !== 'yes' && hasMeetingRoomRaw !== 'no')) {
      addError('Sections & Cubicles', r, "Meeting Room must be selected as 'Yes' or 'No'.");
    } else if (hasMeetingRoom) {
      if (isNaN(meetingRoomCapacity) || meetingRoomCapacity < 1) {
        addError('Sections & Cubicles', r, "Meeting Room is set to 'Yes', so Number of Cubicals Inside Meeting Room must be greater than 0.");
      }
      if (isNaN(meetingRoomHdmi) || meetingRoomHdmi < 0) {
        addError('Sections & Cubicles', r, 'Meeting Room HDMI must be 0 or greater.');
      } else if (meetingRoomHdmi > meetingRoomCapacity) {
        addError('Sections & Cubicles', r, `Meeting Room HDMI (${meetingRoomHdmi}) cannot exceed Meeting Room capacity (${meetingRoomCapacity}).`);
      }
    } else {
      // Meeting room is No
      if (meetingRoomCapacity > 0) {
        addError('Sections & Cubicles', r, "Meeting Room is 'No', but meeting room cubicles were entered. Please clear Column H or set Meeting Room to 'Yes'.");
      }
    }

    // Direction calculation
    const directions = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
    const direction = directions[sectionsInCurrentFloor % 4] || 'NORTH';

    const sectionObj: ParsedSection = {
      name: sectionName,
      direction,
      standardDeskCount: isNaN(standardDeskCount) ? 0 : standardDeskCount,
      hdmiDeskCount: isNaN(hdmiDeskCount) ? 0 : hdmiDeskCount,
      hasMeetingRoom,
      meetingRoomCapacity: hasMeetingRoom ? meetingRoomCapacity : 0,
      meetingRoomHdmi: hasMeetingRoom ? meetingRoomHdmi : 0,
    };

    if (parsedFloorsList[currentFloorIdx]) {
      parsedFloorsList[currentFloorIdx].sections.push(sectionObj);
      sectionsInCurrentFloor++;
      if (sectionsInCurrentFloor >= parsedFloorsList[currentFloorIdx].sectionCount) {
        currentFloorIdx++;
        sectionsInCurrentFloor = 0;
      }
    }
  }

  // Count total errors across all sheets
  let totalErrorCount = 0;
  const errorsSummary: string[] = [];

  for (const [sheetName, rowErrors] of Object.entries(errorsBySheet)) {
    for (const [rowNum, msgs] of Object.entries(rowErrors)) {
      totalErrorCount += msgs.length;
      for (const msg of msgs) {
        errorsSummary.push(`[${sheetName} Row ${rowNum}] ${msg}`);
      }
    }
  }

  // IF NO ERRORS: Return clean parsed data
  if (totalErrorCount === 0) {
    return {
      success: true,
      errorCount: 0,
      errorsSummary: [],
      data: {
        orgId: orgIdCell || expectedOrgId,
        orgName: orgNameCell || '',
        branchCount: expectedBranchCount,
        branches: parsedBranches,
      },
    };
  }

  // IF ERRORS EXIST: Inject sheet-specific "ERRORS" column ONLY on sheets with errors
  for (const [sheetName, rowErrors] of Object.entries(errorsBySheet)) {
    if (Object.keys(rowErrors).length > 0) {
      const sheet = workbook.getWorksheet(sheetName);
      if (sheet) {
        // Find next column after visible columns
        const lastCol = sheet.columnCount + 1;
        const headerRowIndex = sheetName === 'Organization' ? 4 : 1;
        const headerCell = sheet.getRow(headerRowIndex).getCell(lastCol);

        headerCell.value = 'ERRORS & FIXES';
        headerCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }; // Red
        headerCell.alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.getColumn(lastCol).width = 50;

        for (const [rowNumStr, msgs] of Object.entries(rowErrors)) {
          const rowNum = Number(rowNumStr);
          const cell = sheet.getRow(rowNum).getCell(lastCol);
          cell.value = msgs.join('; ');
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Light red highlight
          cell.alignment = { vertical: 'middle', wrapText: true };
        }
      }
    }
  }

  const annotatedBuffer = await workbook.xlsx.writeBuffer();

  return {
    success: false,
    errorCount: totalErrorCount,
    errorsSummary,
    errorWorkbookBuffer: Buffer.from(annotatedBuffer),
  };
}

/**
 * Generates an Option A Formula-Assisted Employee Ingestion Template for a specific branch
 */
export async function generateBranchEmployeeTemplate(
  corporateDomain: string,
  branchCode: string,
  branchName: string,
  defaultPassword?: string
): Promise<Buffer> {
  const cleanDomain = corporateDomain.replace(/^@/, '').trim() || 'company.com';
  const cleanPassword = (defaultPassword && defaultPassword.trim().length >= 4)
    ? defaultPassword.trim()
    : cleanDomain;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MultiTenant DeskBooking Platform';

  // 1. Config Sheet (Enterprise Card Table)
  const configSheet = workbook.addWorksheet('Config');
  configSheet.views = [{ showGridLines: true }];

  // Table Header Row (Row 1)
  const cfgHeader = configSheet.getRow(1);
  cfgHeader.values = ['Configuration Parameter', 'Assigned Value'];
  cfgHeader.height = 26;
  cfgHeader.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cfgHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  cfgHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  cfgHeader.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };

  const configData = [
    { param: 'Corporate Email Domain', val: cleanDomain },
    { param: 'Branch Code', val: branchCode },
    { param: 'Branch Name', val: branchName },
    { param: 'Default Initial Password', val: cleanPassword },
  ];

  configData.forEach((item, idx) => {
    const rowNum = idx + 2;
    const r = configSheet.getRow(rowNum);
    r.height = 22;

    // Col A (Label)
    const cellA = r.getCell(1);
    cellA.value = item.param;
    cellA.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F8' } };
    cellA.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    cellA.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };

    // Col B (Value)
    const cellB = r.getCell(2);
    cellB.value = item.val;
    cellB.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF002060' } };
    cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    cellB.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    cellB.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  configSheet.getColumn(1).width = 28;
  configSheet.getColumn(2).width = 36;

  // 2. Employee Roster Sheet (Strictly 3 Columns)
  const sheet = workbook.addWorksheet('Employee Roster');
  sheet.views = [{ showGridLines: true }];

  const headerRow = sheet.getRow(1);
  headerRow.values = [
    'Employee Full Name',
    'Corporate Email',
    'Temporary Password',
  ];
  headerRow.height = 26;
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  // Col A: Yellow User-Input
  headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
  headerRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF002060' } };

  // Col B: Soft Green Formula
  headerRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
  headerRow.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF375623' } };

  // Col C: Soft Green Formula
  headerRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
  headerRow.getCell(3).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF375623' } };

  // Pre-fill 200 rows with formulas linking to Config sheet
  for (let r = 2; r <= 201; r++) {
    const row = sheet.getRow(r);
    row.height = 20;

    // Col A: Employee Full Name (Yellow input)
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    row.getCell(1).font = { name: 'Segoe UI', size: 10 };
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    row.getCell(1).border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    // Col B: Corporate Email formula (links to Config!$B$2)
    row.getCell(2).value = {
      formula: `IF(ISBLANK(A${r}), "", LOWER(SUBSTITUTE(TRIM(A${r}), " ", ".")) & "@" & Config!$B$2)`,
    };
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F8F2' } };
    row.getCell(2).font = { name: 'Segoe UI', size: 10 };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    row.getCell(2).border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    // Col C: Temporary Password formula (links to Config!$B$5)
    row.getCell(3).value = {
      formula: `IF(ISBLANK(A${r}), "", Config!$B$5)`,
    };
    row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F8F2' } };
    row.getCell(3).font = { name: 'Segoe UI', size: 10 };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    row.getCell(3).border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  }

  sheet.getColumn(1).width = 32;
  sheet.getColumn(2).width = 36;
  sheet.getColumn(3).width = 30;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generates an Excel export of all employees in a branch
 */
export async function exportBranchEmployeesToExcel(
  branchName: string,
  employees: Array<{
    name: string;
    email: string;
    department?: string | null;
    status: string;
    isActive: boolean;
    createdAt: string | Date;
  }>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Employee Directory');
  sheet.views = [{ showGridLines: true }];

  const headerRow = sheet.getRow(1);
  headerRow.values = [
    'Employee Full Name',
    'Corporate Email',
    'Status',
    'Enrolled Date',
  ];
  headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 24;

  employees.forEach((emp, idx) => {
    const r = sheet.getRow(idx + 2);
    r.height = 20;
    r.getCell(1).value = emp.name;
    r.getCell(2).value = emp.email;
    r.getCell(3).value = emp.isActive ? 'Active' : 'Deactivated';
    r.getCell(4).value = new Date(emp.createdAt).toLocaleDateString();

    const isDeactivated = !emp.isActive || emp.status === 'DEACTIVATED';
    if (isDeactivated) {
      r.getCell(3).font = { name: 'Segoe UI', size: 10, color: { argb: 'FFDC2626' }, bold: true };
    } else {
      r.getCell(3).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF16A34A' }, bold: true };
    }
  });

  sheet.getColumn(1).width = 32;
  sheet.getColumn(2).width = 36;
  sheet.getColumn(3).width = 18;
  sheet.getColumn(4).width = 20;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generates an Enterprise Multi-Branch Employee Ingestion Template
 * Sheet 1: Organization Summary & Credentials (lists all branches, codes, domains, default passwords)
 * Sheets 2..N: Dedicated Branch Sheets (named [BranchCode] - [BranchName]), formula-driven for emails & passwords
 */
export async function generateMultiBranchEmployeeTemplate(
  orgName: string,
  corporateDomain: string,
  branches: Array<{
    id: string;
    code: string;
    name: string;
    defaultEmployeePassword?: string | null;
    employeeCount: number;
  }>,
  defaultOrgPassword?: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MultiTenant DeskBooking Platform';

  const cleanDomain = corporateDomain.replace(/^@/, '').trim() || 'company.com';
  const orgFallbackPassword =
    defaultOrgPassword && defaultOrgPassword.trim().length >= 4
      ? defaultOrgPassword.trim()
      : orgName
      ? orgName.toLowerCase().replace(/[^a-z0-9]/g, '')
      : cleanDomain;

  // 1. Sheet 1: Organization Summary & Credentials
  const summarySheet = workbook.addWorksheet('Organization Summary');
  summarySheet.views = [{ showGridLines: true }];

  // Title Block
  const titleRow = summarySheet.getRow(1);
  titleRow.values = [`${orgName} — Multi-Branch Workforce Master Roster`];
  titleRow.height = 30;
  titleRow.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  summarySheet.mergeCells('A1:E1');

  // Header Row (Row 2)
  const headerRow = summarySheet.getRow(2);
  headerRow.values = [
    'Branch Code',
    'Branch Facility Name',
    'Corporate Email Domain',
    'Default Temporary Password',
    'Registered Employees',
  ];
  headerRow.height = 26;
  headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let c = 1; c <= 5; c++) {
    headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
    headerRow.getCell(c).border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  }

  // Populate Branches in Summary Sheet
  branches.forEach((b, idx) => {
    const rowNum = idx + 3;
    const r = summarySheet.getRow(rowNum);
    r.height = 22;

    const branchPassword = b.defaultEmployeePassword || orgFallbackPassword;

    r.getCell(1).value = b.code; // Col A: Branch Code
    r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1F4E79' } };

    r.getCell(2).value = b.name; // Col B: Branch Facility Name
    r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    r.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };

    r.getCell(3).value = cleanDomain; // Col C: Corporate Email Domain
    r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    r.getCell(3).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF002060' } };
    r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; // Editable

    r.getCell(4).value = branchPassword; // Col D: Default Temporary Password
    r.getCell(4).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    r.getCell(4).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF002060' } };
    r.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; // Editable

    r.getCell(5).value = b.employeeCount || 0; // Col E: Registered Employees
    r.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(5).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF475569' } };

    for (let c = 1; c <= 5; c++) {
      r.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }
  });

  summarySheet.getColumn(1).width = 18;
  summarySheet.getColumn(2).width = 30;
  summarySheet.getColumn(3).width = 28;
  summarySheet.getColumn(4).width = 28;
  summarySheet.getColumn(5).width = 22;

  // 2. Sheets 2..N: Dedicated Branch Sheets
  branches.forEach((branch, bIdx) => {
    // Sanitize sheet name: Max 31 chars, forbidden chars replaced: \ / ? * [ ] :
    const rawSheetName = `${branch.code} - ${branch.name}`.replace(/[\\/?*[\]:]/g, ' ').trim();
    const sheetName = rawSheetName.slice(0, 30);
    const summaryRow = bIdx + 3; // Row in Organization Summary sheet for this branch

    const bSheet = workbook.addWorksheet(sheetName);
    bSheet.views = [{ showGridLines: true }];

    // Branch Sheet Header
    const bHeader = bSheet.getRow(1);
    bHeader.values = [
      'Employee Code',
      'Employee Full Name',
      'Corporate Email',
      'Temporary Password',
      'Role',
    ];
    bHeader.height = 26;
    bHeader.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col A: Code (Light grey)
    bHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    bHeader.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1F4E79' } };

    // Col B: Full Name (Yellow user input)
    bHeader.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
    bHeader.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF002060' } };

    // Col C: Corporate Email (Soft Green formula)
    bHeader.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    bHeader.getCell(3).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF375623' } };

    // Col D: Temporary Password (Soft Green formula)
    bHeader.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    bHeader.getCell(4).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF375623' } };

    // Col E: Role (Light grey)
    bHeader.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    bHeader.getCell(5).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1F4E79' } };

    // Pre-populate 100 rows with formulas referencing 'Organization Summary'
    for (let r = 2; r <= 101; r++) {
      const row = bSheet.getRow(r);
      row.height = 20;

      // Col A: Employee Code (Auto suggested code, e.g. EMP-001)
      const empNum = String(r - 1).padStart(3, '0');
      row.getCell(1).value = `EMP-${empNum}`;
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F8' } };
      row.getCell(1).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF475569' } };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      // Col B: Full Name (Yellow user input)
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      row.getCell(2).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF0F172A' } };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      // Col C: Corporate Email Formula referencing 'Organization Summary'!$C$[summaryRow]
      row.getCell(3).value = {
        formula: `IF(ISBLANK(B${r}), "", LOWER(SUBSTITUTE(TRIM(B${r}), " ", ".")) & "@" & 'Organization Summary'!$C$${summaryRow})`,
      };
      row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F8F2' } };
      row.getCell(3).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF14532D' } };
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      // Col D: Temporary Password Formula referencing 'Organization Summary'!$D$[summaryRow]
      row.getCell(4).value = {
        formula: `IF(ISBLANK(B${r}), "", 'Organization Summary'!$D$${summaryRow})`,
      };
      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F8F2' } };
      row.getCell(4).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF14532D' } };
      row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      // Col E: Role (Default EMPLOYEE)
      row.getCell(5).value = 'EMPLOYEE';
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      row.getCell(5).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF334155' } };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

      for (let c = 1; c <= 5; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
    }

    bSheet.getColumn(1).width = 16;
    bSheet.getColumn(2).width = 30;
    bSheet.getColumn(3).width = 32;
    bSheet.getColumn(4).width = 24;
    bSheet.getColumn(5).width = 16;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface ParsedMultiBranchEmployee {
  branchCode: string;
  branchName?: string;
  empCode: string;
  fullName: string;
  email: string;
  password: string;
  role: 'EMPLOYEE' | 'TECH_LEAD';
}

export interface MultiBranchRosterValidationResult {
  success: boolean;
  employees: ParsedMultiBranchEmployee[];
  branchStats: Array<{
    branchCode: string;
    branchName: string;
    count: number;
  }>;
  errors: string[];
}

/**
 * Parses and validates an uploaded Multi-Branch Employee Excel Workbook
 */
export async function parseAndValidateMultiBranchRoster(
  fileBuffer: Buffer,
  orgId: string,
  defaultDomain: string,
  branchesInDb: Array<{ id: string; code: string; name: string; defaultEmployeePassword?: string | null }>
): Promise<MultiBranchRosterValidationResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);

  const errors: string[] = [];
  const employees: ParsedMultiBranchEmployee[] = [];
  const branchMapByCode = new Map<string, typeof branchesInDb[0]>();
  branchesInDb.forEach((b) => {
    branchMapByCode.set(b.code.toUpperCase(), b);
  });

  // Extract branch overrides from "Organization Summary" sheet if present
  const summarySheet = workbook.getWorksheet('Organization Summary');
  const branchConfigFromSummary = new Map<string, { domain: string; defaultPassword?: string }>();
  if (summarySheet) {
    summarySheet.eachRow((row, rowNumber) => {
      if (rowNumber > 2) {
        const bCode = row.getCell(1).text?.trim().toUpperCase();
        const bDomain = row.getCell(3).text?.trim();
        const bPass = row.getCell(4).text?.trim();
        if (bCode) {
          branchConfigFromSummary.set(bCode, {
            domain: bDomain || defaultDomain,
            defaultPassword: bPass,
          });
        }
      }
    });
  }

  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const branchCounts = new Map<string, number>();

  // Iterate across all sheets other than "Organization Summary"
  for (const sheet of workbook.worksheets) {
    if (sheet.name.toLowerCase() === 'organization summary' || sheet.name.toLowerCase() === 'config') {
      continue;
    }

    // Match sheet to branch:
    let matchedBranch: typeof branchesInDb[0] | undefined;
    const sheetPrefix = sheet.name.split('-')[0].trim().toUpperCase();
    if (branchMapByCode.has(sheetPrefix)) {
      matchedBranch = branchMapByCode.get(sheetPrefix);
    } else {
      for (const b of branchesInDb) {
        if (
          sheet.name.toUpperCase().includes(b.code.toUpperCase()) ||
          sheet.name.toUpperCase().includes(b.name.toUpperCase())
        ) {
          matchedBranch = b;
          break;
        }
      }
    }

    if (!matchedBranch) {
      if (branchesInDb.length === 1) {
        matchedBranch = branchesInDb[0];
      } else {
        errors.push(`Sheet "${sheet.name}" could not be matched to any registered branch in the organization.`);
        continue;
      }
    }

    const branchSummaryConfig = branchConfigFromSummary.get(matchedBranch.code.toUpperCase());
    const effectiveDomain = branchSummaryConfig?.domain || defaultDomain;
    const effectivePassword =
      branchSummaryConfig?.defaultPassword ||
      matchedBranch.defaultEmployeePassword ||
      effectiveDomain;

    let sheetCount = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const getVal = (col: number) => {
        const cell = row.getCell(col);
        if (!cell || cell.value === null || cell.value === undefined) return '';
        if (typeof cell.value === 'object' && 'result' in cell.value) {
          return String(cell.value.result ?? '').trim();
        }
        return cell.text?.trim() || String(cell.value ?? '').trim();
      };

      const empCode = getVal(1) || `EMP-${String(rowNumber - 1).padStart(3, '0')}`;
      const fullName = getVal(2);

      // Skip row if full name is blank or template filler
      if (!fullName || fullName.toLowerCase().startsWith('employee') || fullName.startsWith('=')) {
        return;
      }

      let email = getVal(3);
      if (!email || email.startsWith('=')) {
        const safeName = fullName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
        email = `${safeName}@${effectiveDomain}`;
      }
      email = email.toLowerCase().trim();

      let password = getVal(4);
      if (!password || password.startsWith('=') || password.length < 4) {
        password = effectivePassword;
      }

      const rawRole = getVal(5).toUpperCase();
      const role: 'EMPLOYEE' | 'TECH_LEAD' = rawRole === 'TECH_LEAD' ? 'TECH_LEAD' : 'EMPLOYEE';

      if (!EMAIL_REGEX.test(email)) {
        errors.push(`Sheet "${sheet.name}" Row ${rowNumber}: Invalid email address "${email}" for employee "${fullName}".`);
        return;
      }

      employees.push({
        branchCode: matchedBranch.code,
        branchName: matchedBranch.name,
        empCode,
        fullName,
        email,
        password,
        role,
      });

      sheetCount++;
    });

    branchCounts.set(matchedBranch.code, (branchCounts.get(matchedBranch.code) || 0) + sheetCount);
  }

  const branchStats = branchesInDb.map((b) => ({
    branchCode: b.code,
    branchName: b.name,
    count: branchCounts.get(b.code) || 0,
  }));

  return {
    success: errors.length === 0 && employees.length > 0,
    employees,
    branchStats,
    errors,
  };
}

/**
 * Generates an Excel Floor Plan Template scoped strictly to a single branch
 */
export async function generateBranchFloorPlanTemplate(
  orgName: string,
  branch: {
    code: string;
    name: string;
    buildings: Array<{
      code: string;
      name: string;
      floors: Array<{
        code: string;
        name: string;
        floorNumber: number;
        sections: Array<{
          name: string;
          direction: string;
          standardDeskCount: number;
          hdmiDeskCount: number;
          hasMeetingRoom: boolean;
          meetingRoomCapacity: number;
          meetingRoomHdmi: number;
        }>;
      }>;
    }>;
  }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MultiTenant DeskBooking Platform';

  // Color Palette Constants
  const HEADER_FILL = 'FF1F4E79'; // Deep Navy Blue
  const SUBHEADER_FILL = 'FF2F5597'; // Royal Slate Blue
  const GREY_LOCKED_FILL = 'FFF1F5F9'; // Slate-100 Read-Only Protected
  const YELLOW_INPUT_FILL = 'FFFFF2CC'; // Pale Warm Yellow (Active user input)
  const DISABLED_GREY_FILL = 'FFE2E8F0'; // Slate-200 Lockout Fill
  const THIN_BORDER = {
    top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
  };

  // 1. Sheet: Branch Info
  const sheetBranch = workbook.addWorksheet('Branch Info');
  sheetBranch.views = [{ showGridLines: true }];

  const bHeader = sheetBranch.getRow(1);
  bHeader.values = ['Branch Code', 'Branch Name', 'Number of Buildings'];
  bHeader.height = 26;
  bHeader.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  bHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let c = 1; c <= 3; c++) {
    bHeader.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    bHeader.getCell(c).border = THIN_BORDER;
  }

  const bRow = sheetBranch.getRow(2);
  bRow.height = 24;
  // Branch Code (Locked Grey)
  bRow.getCell(1).value = branch.code;
  bRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_LOCKED_FILL } };
  bRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF475569' } };
  bRow.getCell(1).protection = { locked: true };

  // Branch Name (Locked Grey)
  bRow.getCell(2).value = branch.name;
  bRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_LOCKED_FILL } };
  bRow.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF475569' } };
  bRow.getCell(2).protection = { locked: true };

  // Number of Buildings (Editable Yellow)
  bRow.getCell(3).value = Math.max(1, branch.buildings.length);
  bRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_INPUT_FILL } };
  bRow.getCell(3).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  bRow.getCell(3).protection = { locked: false };

  for (let c = 1; c <= 3; c++) {
    bRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
    bRow.getCell(c).border = THIN_BORDER;
  }
  sheetBranch.getColumn(1).width = 20;
  sheetBranch.getColumn(2).width = 30;
  sheetBranch.getColumn(3).width = 24;
  await sheetBranch.protect('', { selectLockedCells: true, selectUnlockedCells: true });

  // 2. Sheet: Buildings
  const sheetBuildings = workbook.addWorksheet('Buildings');
  sheetBuildings.views = [{ showGridLines: true }];

  const bldHeader = sheetBuildings.getRow(1);
  bldHeader.values = ['Building Code', 'Building Name', 'Number of Floors'];
  bldHeader.height = 26;
  bldHeader.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  bldHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let c = 1; c <= 3; c++) {
    bldHeader.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEADER_FILL } };
    bldHeader.getCell(c).border = THIN_BORDER;
  }

  const buildingsData =
    branch.buildings.length > 0
      ? branch.buildings
      : [{ code: 'BLD001', name: 'Main Tower', floors: [] }];

  buildingsData.forEach((bld, idx) => {
    const rowNum = idx + 2;
    const r = sheetBuildings.getRow(rowNum);
    r.height = 24;

    // Col A: Building Code (Formula cascading from Branch Info, locked grey)
    r.getCell(1).value = {
      formula: `IF(ROW()-1 <= 'Branch Info'!$C$2, "BLD" & TEXT(ROW()-1, "000"), "")`,
      result: bld.code || `BLD${String(rowNum - 1).padStart(3, '0')}`,
    };
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_LOCKED_FILL } };
    r.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF475569' } };
    r.getCell(1).protection = { locked: true };

    // Col B: Building Name (Editable Yellow)
    r.getCell(2).value = bld.name;
    r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_INPUT_FILL } };
    r.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    r.getCell(2).protection = { locked: false };

    // Col C: Number of Floors (Editable Yellow)
    r.getCell(3).value = Math.max(1, bld.floors.length);
    r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_INPUT_FILL } };
    r.getCell(3).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    r.getCell(3).protection = { locked: false };

    for (let c = 1; c <= 3; c++) {
      r.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(c).border = THIN_BORDER;
    }
  });
  sheetBuildings.getColumn(1).width = 20;
  sheetBuildings.getColumn(2).width = 30;
  sheetBuildings.getColumn(3).width = 22;
  await sheetBuildings.protect('', { selectLockedCells: true, selectUnlockedCells: true });

  // 3. Sheet: Floors
  const sheetFloors = workbook.addWorksheet('Floors');
  sheetFloors.views = [{ showGridLines: true }];

  const flHeader = sheetFloors.getRow(1);
  flHeader.values = ['Building Name', 'Floor Code', 'Floor Name', 'Number of Sections'];
  flHeader.height = 26;
  flHeader.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  flHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let c = 1; c <= 4; c++) {
    flHeader.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEADER_FILL } };
    flHeader.getCell(c).border = THIN_BORDER;
  }

  let flRowIdx = 2;
  buildingsData.forEach((bld, bldIdx) => {
    const floorsData =
      bld.floors.length > 0
        ? bld.floors
        : [
            {
              code: `${bldIdx + 1}-FL01`,
              name: 'Floor 1',
              floorNumber: 1,
              sections: [],
            },
          ];

    floorsData.forEach((fl, flIdx) => {
      const rowNum = flRowIdx++;
      const r = sheetFloors.getRow(rowNum);
      r.height = 24;

      // Col A: Building Name (Formula linking to Buildings sheet, locked grey)
      const bldRowNum = bldIdx + 2;
      r.getCell(1).value = {
        formula: `Buildings!B${bldRowNum}`,
        result: bld.name,
      };
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_LOCKED_FILL } };
      r.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF475569' } };
      r.getCell(1).protection = { locked: true };

      // Col B: Floor Code (Building-scoped code e.g. 1-FL01, locked grey)
      r.getCell(2).value = fl.code || `${bldIdx + 1}-FL${String(flIdx + 1).padStart(2, '0')}`;
      r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_LOCKED_FILL } };
      r.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF475569' } };
      r.getCell(2).protection = { locked: true };

      // Col C: Floor Name (Editable Yellow)
      r.getCell(3).value = fl.name || `Floor ${flIdx + 1}`;
      r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_INPUT_FILL } };
      r.getCell(3).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(3).protection = { locked: false };

      // Col D: Number of Sections (Editable Yellow)
      r.getCell(4).value = Math.max(1, fl.sections.length);
      r.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_INPUT_FILL } };
      r.getCell(4).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(4).protection = { locked: false };

      for (let c = 1; c <= 4; c++) {
        r.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(c).border = THIN_BORDER;
      }
    });
  });

  sheetFloors.getColumn(1).width = 26;
  sheetFloors.getColumn(2).width = 20;
  sheetFloors.getColumn(3).width = 24;
  sheetFloors.getColumn(4).width = 22;
  await sheetFloors.protect('', { selectLockedCells: true, selectUnlockedCells: true });

  // 4. Sheet: Sections & Cubicles
  const sheetSections = workbook.addWorksheet('Sections & Cubicles');
  sheetSections.views = [{ showGridLines: true }];

  const secHeader = sheetSections.getRow(1);
  secHeader.values = [
    'Floor Code',
    'Section Name',
    'Direction',
    'Standard Cubicles',
    'HDMI Cubicles',
    'Has Meeting Room',
    'Meeting Room Capacity',
    'Meeting Room HDMI',
  ];
  secHeader.height = 26;
  secHeader.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  secHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let c = 1; c <= 8; c++) {
    secHeader.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEADER_FILL } };
    secHeader.getCell(c).border = THIN_BORDER;
  }

  let secRowIdx = 2;
  buildingsData.forEach((bld, bldIdx) => {
    bld.floors.forEach((fl, flIdx) => {
      const flCodeDefault = fl.code || `${bldIdx + 1}-FL${String(flIdx + 1).padStart(2, '0')}`;
      const sectionsData =
        fl.sections.length > 0
          ? fl.sections
          : [
              {
                name: 'First North',
                direction: 'NORTH',
                standardDeskCount: 16,
                hdmiDeskCount: 8,
                hasMeetingRoom: true,
                meetingRoomCapacity: 8,
                meetingRoomHdmi: 4,
              },
            ];

      sectionsData.forEach((sec) => {
        const rowNum = secRowIdx++;
        const r = sheetSections.getRow(rowNum);
        r.height = 24;

        // Col A: Floor Code (Locked Grey)
        r.getCell(1).value = flCodeDefault;
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_LOCKED_FILL } };
        r.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF475569' } };
        r.getCell(1).protection = { locked: true };

        // Col B: Section Name (Editable Yellow)
        r.getCell(2).value = sec.name;
        r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_INPUT_FILL } };
        r.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        r.getCell(2).protection = { locked: false };

        // Col C: Direction (Yellow Dropdown)
        r.getCell(3).value = sec.direction || 'NORTH';
        r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_INPUT_FILL } };
        r.getCell(3).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        r.getCell(3).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"NORTH,SOUTH,EAST,WEST"'],
        };
        r.getCell(3).protection = { locked: false };

        // Col D: Standard Cubicles (Editable Yellow)
        r.getCell(4).value = sec.standardDeskCount || 16;
        r.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_INPUT_FILL } };
        r.getCell(4).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        r.getCell(4).protection = { locked: false };

        // Col E: HDMI Cubicles (Editable Yellow)
        r.getCell(5).value = sec.hdmiDeskCount || 8;
        r.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_INPUT_FILL } };
        r.getCell(5).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        r.getCell(5).protection = { locked: false };

        // Col F: Has Meeting Room (Yellow Dropdown)
        const hasMrStr = sec.hasMeetingRoom ? 'Yes' : 'No';
        r.getCell(6).value = hasMrStr;
        r.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_INPUT_FILL } };
        r.getCell(6).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        r.getCell(6).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"Yes,No"'],
        };
        r.getCell(6).protection = { locked: false };

        // Col G: Meeting Room Capacity (Dynamic Yellow when Yes, Lockout Grey when No)
        r.getCell(7).value = sec.hasMeetingRoom ? (sec.meetingRoomCapacity || 8) : 0;
        r.getCell(7).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: sec.hasMeetingRoom ? YELLOW_INPUT_FILL : DISABLED_GREY_FILL },
        };
        r.getCell(7).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: sec.hasMeetingRoom ? 'FF0F172A' : 'FF94A3B8' } };
        r.getCell(7).protection = { locked: false };

        // Col H: Meeting Room HDMI (Dynamic Yellow when Yes, Lockout Grey when No)
        r.getCell(8).value = sec.hasMeetingRoom ? (sec.meetingRoomHdmi || 4) : 0;
        r.getCell(8).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: sec.hasMeetingRoom ? YELLOW_INPUT_FILL : DISABLED_GREY_FILL },
        };
        r.getCell(8).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: sec.hasMeetingRoom ? 'FF0F172A' : 'FF94A3B8' } };
        r.getCell(8).protection = { locked: false };

        for (let c = 1; c <= 8; c++) {
          r.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
          r.getCell(c).border = THIN_BORDER;
        }
      });
    });
  });

  // Conditional formatting on Sheet 4: Range G2:H401
  // If Has Meeting Room is "No", grey out cells G and H automatically
  sheetSections.addConditionalFormatting({
    ref: 'G2:H401',
    rules: [
      {
        type: 'expression',
        priority: 1,
        formulae: ['UPPER(TRIM($F2))="NO"'],
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: DISABLED_GREY_FILL },
          },
          font: {
            color: { argb: 'FF94A3B8' },
          },
        },
      },
      {
        type: 'expression',
        priority: 2,
        formulae: ['UPPER(TRIM($F2))="YES"'],
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: YELLOW_INPUT_FILL },
          },
          font: {
            color: { argb: 'FF0F172A' },
            bold: true,
          },
        },
      },
    ],
  });

  sheetSections.getColumn(1).width = 18;
  sheetSections.getColumn(2).width = 24;
  sheetSections.getColumn(3).width = 18;
  sheetSections.getColumn(4).width = 20;
  sheetSections.getColumn(5).width = 18;
  sheetSections.getColumn(6).width = 20;
  sheetSections.getColumn(7).width = 24;
  sheetSections.getColumn(8).width = 22;
  await sheetSections.protect('', { selectLockedCells: true, selectUnlockedCells: true });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface ParsedBranchFloorPlan {
  branchCode: string;
  branchName: string;
  buildings: Array<{
    code: string;
    name: string;
    floors: Array<{
      code: string;
      name: string;
      floorNumber: number;
      sections: Array<{
        name: string;
        direction: string;
        standardDeskCount: number;
        hdmiDeskCount: number;
        hasMeetingRoom: boolean;
        meetingRoomCapacity: number;
        meetingRoomHdmi: number;
      }>;
    }>;
  }>;
}

export interface BranchFloorPlanValidationResult {
  success: boolean;
  errorCount: number;
  errorsSummary: string[];
  data?: ParsedBranchFloorPlan;
}

function getCellString(cell: ExcelJS.Cell): string {
  if (!cell) return '';
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if ('result' in val && val.result !== undefined && val.result !== null) {
      return String(val.result).trim();
    }
    if ('text' in val && typeof (val as any).text === 'string') {
      return (val as any).text.trim();
    }
    if ('richText' in val && Array.isArray((val as any).richText)) {
      return (val as any).richText.map((t: any) => t.text).join('').trim();
    }
  }
  if (cell.text && cell.text.trim()) {
    return cell.text.trim();
  }
  return String(val).trim();
}

function getCellNumber(cell: ExcelJS.Cell): number {
  if (!cell) return NaN;
  const val = cell.value;
  if (val === null || val === undefined) return NaN;
  if (typeof val === 'object') {
    if ('result' in val && val.result !== undefined && val.result !== null) {
      const resNum = Number(val.result);
      if (!isNaN(resNum)) return resNum;
    }
  }
  const n = Number(cell.value);
  if (!isNaN(n)) return n;
  if (cell.text) {
    const textNum = Number(cell.text.trim());
    if (!isNaN(textNum)) return textNum;
  }
  return NaN;
}

/**
 * Validates and parses branch-scoped floor plan Excel template
 */
export async function parseAndValidateBranchFloorPlan(
  fileBuffer: Buffer,
  expectedBranchCode: string
): Promise<BranchFloorPlanValidationResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);

  const sheetBranch = workbook.getWorksheet('Branch Info');
  const sheetBuildings = workbook.getWorksheet('Buildings');
  const sheetFloors = workbook.getWorksheet('Floors');
  const sheetSections = workbook.getWorksheet('Sections & Cubicles');

  const errors: string[] = [];

  if (!sheetBranch || !sheetBuildings || !sheetFloors || !sheetSections) {
    return {
      success: false,
      errorCount: 1,
      errorsSummary: [
        'Invalid template format: Missing one or more required sheets (Branch Info, Buildings, Floors, Sections & Cubicles).',
      ],
    };
  }

  // 1. Branch Info
  const branchRow = sheetBranch.getRow(2);
  const branchCode = getCellString(branchRow.getCell(1));
  const branchName = getCellString(branchRow.getCell(2));

  if (!branchCode) {
    errors.push('Branch Info (Row 2): Branch Code is missing.');
  } else if (branchCode.toUpperCase() !== expectedBranchCode.toUpperCase()) {
    errors.push(
      `Branch Code mismatch: Uploaded spreadsheet is for branch "${branchCode}", but your active branch is "${expectedBranchCode}".`
    );
  }

  // 2. Buildings
  const buildingsMap = new Map<
    string,
    {
      code: string;
      name: string;
      floorCount: number;
      floors: Array<{
        code: string;
        name: string;
        floorNumber: number;
        sections: Array<{
          name: string;
          direction: string;
          standardDeskCount: number;
          hdmiDeskCount: number;
          hasMeetingRoom: boolean;
          meetingRoomCapacity: number;
          meetingRoomHdmi: number;
        }>;
      }>;
    }
  >();

  for (let r = 2; r <= sheetBuildings.rowCount; r++) {
    const row = sheetBuildings.getRow(r);
    let bldCode = getCellString(row.getCell(1));
    const bldName = getCellString(row.getCell(2));
    const floorCountVal = getCellNumber(row.getCell(3));

    if (!bldCode && !bldName) continue;

    // Handle formula fallback if not evaluated
    if (!bldCode || bldCode.startsWith('=')) {
      bldCode = `BLD${String(r - 1).padStart(3, '0')}`;
    }

    if (!bldName) {
      errors.push(`Buildings (Row ${r}): Building Name is required.`);
    }
    if (isNaN(floorCountVal) || floorCountVal < 1) {
      errors.push(`Buildings (Row ${r}): Number of Floors must be at least 1.`);
    }

    if (bldName) {
      buildingsMap.set(bldName.toLowerCase(), {
        code: bldCode,
        name: bldName,
        floorCount: isNaN(floorCountVal) ? 1 : floorCountVal,
        floors: [],
      });
    }
  }

  if (buildingsMap.size === 0) {
    errors.push('Buildings sheet: At least 1 building must be specified.');
  }

  // 3. Floors
  const floorsMap = new Map<
    string,
    {
      code: string;
      name: string;
      floorNumber: number;
      sections: Array<{
        name: string;
        direction: string;
        standardDeskCount: number;
        hdmiDeskCount: number;
        hasMeetingRoom: boolean;
        meetingRoomCapacity: number;
        meetingRoomHdmi: number;
      }>;
    }
  >();

  const buildingsList = Array.from(buildingsMap.values());
  for (let r = 2; r <= sheetFloors.rowCount; r++) {
    const row = sheetFloors.getRow(r);
    let bldName = getCellString(row.getCell(1));
    let flCode = getCellString(row.getCell(2));
    const flName = getCellString(row.getCell(3));

    if (!bldName && !flCode && !flName) continue;

    // If formula reference e.g. =Buildings!B2 or =Buildings!$B$2
    if (bldName.startsWith('=')) {
      const match = bldName.match(/B(\d+)/i);
      if (match) {
        const bldRowIdx = parseInt(match[1], 10) - 2;
        if (bldRowIdx >= 0 && bldRowIdx < buildingsList.length) {
          bldName = buildingsList[bldRowIdx].name;
        }
      }
    }

    let bldEntry = bldName ? buildingsMap.get(bldName.toLowerCase()) : null;
    if (!bldEntry && buildingsMap.size > 0) {
      bldEntry = buildingsMap.values().next().value;
    }

    if (!bldEntry) {
      errors.push(`Floors (Row ${r}): Building "${bldName}" not found in Buildings sheet.`);
      continue;
    }

    const bldIndex = buildingsList.findIndex((b) => b.code === bldEntry?.code);
    const floorNumber = bldEntry.floors.length + 1;

    // If formula or missing flCode, fallback to building-scoped code
    if (!flCode || flCode.startsWith('=')) {
      flCode = `${(bldIndex >= 0 ? bldIndex : 0) + 1}-FL${String(floorNumber).padStart(2, '0')}`;
    }

    const floorObj = {
      code: flCode,
      name: flName || `Floor ${floorNumber}`,
      floorNumber,
      sections: [],
    };

    bldEntry.floors.push(floorObj);
    floorsMap.set(flCode.toLowerCase(), floorObj);
  }

  // 4. Sections & Cubicles
  const floorsList = Array.from(floorsMap.values());
  for (let r = 2; r <= sheetSections.rowCount; r++) {
    const row = sheetSections.getRow(r);
    let flCode = getCellString(row.getCell(1));
    const secName = getCellString(row.getCell(2));
    const direction = (getCellString(row.getCell(3)) || 'NORTH').toUpperCase();
    const standardDeskCount = getCellNumber(row.getCell(4));
    const hdmiDeskCount = getCellNumber(row.getCell(5));
    const hasMeetingRoomRaw = getCellString(row.getCell(6)).toLowerCase();
    const meetingRoomCapacity = getCellNumber(row.getCell(7));
    const meetingRoomHdmi = getCellNumber(row.getCell(8));

    if (!flCode && !secName) continue;

    if (!secName) {
      errors.push(`Sections & Cubicles (Row ${r}): Section Name is required.`);
      continue;
    }

    // If flCode is formula reference e.g. =Floors!B2
    if (flCode.startsWith('=')) {
      const match = flCode.match(/B(\d+)/i);
      if (match) {
        const flRowIdx = parseInt(match[1], 10) - 2;
        if (flRowIdx >= 0 && flRowIdx < floorsList.length) {
          flCode = floorsList[flRowIdx].code;
        }
      }
    }

    let floorEntry = flCode ? floorsMap.get(flCode.toLowerCase()) : null;
    if (!floorEntry && floorsMap.size > 0) {
      floorEntry = floorsMap.values().next().value;
    }

    if (!floorEntry) {
      errors.push(`Sections & Cubicles (Row ${r}): Floor "${flCode}" not found in Floors sheet.`);
      continue;
    }

    const stdCount = isNaN(standardDeskCount) ? 0 : standardDeskCount;
    const hdmiCount = isNaN(hdmiDeskCount) ? 0 : hdmiDeskCount;

    if (isNaN(standardDeskCount) || standardDeskCount < 0) {
      errors.push(`Sections & Cubicles (Row ${r}): Standard Cubicles must be a non-negative number.`);
    }
    if (isNaN(hdmiDeskCount) || hdmiDeskCount < 0) {
      errors.push(`Sections & Cubicles (Row ${r}): HDMI Cubicles must be a non-negative number.`);
    } else if (hdmiCount > stdCount) {
      errors.push(
        `Sections & Cubicles (Row ${r}): HDMI Cubicles (${hdmiCount}) cannot exceed Standard Cubicles (${stdCount}).`
      );
    }

    const hasMeetingRoom =
      hasMeetingRoomRaw === 'yes' || hasMeetingRoomRaw === 'true' || hasMeetingRoomRaw === '1';
    const mrCap = isNaN(meetingRoomCapacity) ? 0 : meetingRoomCapacity;
    const mrHdmi = isNaN(meetingRoomHdmi) ? 0 : meetingRoomHdmi;

    if (hasMeetingRoom) {
      if (mrCap <= 0) {
        errors.push(
          `Sections & Cubicles (Row ${r}): Meeting Room is set to 'Yes', but Meeting Room Capacity is missing or 0. Please specify capacity >= 1.`
        );
      } else if (mrHdmi > mrCap) {
        errors.push(
          `Sections & Cubicles (Row ${r}): Meeting Room HDMI (${mrHdmi}) cannot exceed Meeting Room capacity (${mrCap}).`
        );
      }
    } else {
      if (mrCap > 0) {
        errors.push(
          `Sections & Cubicles (Row ${r}): Meeting Room is 'No', but meeting room capacity (${mrCap}) was entered. Please clear Column G or set Meeting Room to 'Yes'.`
        );
      }
    }

    floorEntry.sections.push({
      name: secName,
      direction: ['NORTH', 'SOUTH', 'EAST', 'WEST'].includes(direction) ? direction : 'NORTH',
      standardDeskCount: Math.max(0, stdCount),
      hdmiDeskCount: Math.max(0, hdmiCount),
      hasMeetingRoom,
      meetingRoomCapacity: hasMeetingRoom ? Math.max(0, mrCap) : 0,
      meetingRoomHdmi: hasMeetingRoom ? Math.max(0, mrHdmi) : 0,
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      errorCount: errors.length,
      errorsSummary: errors,
    };
  }

  const buildingsResult = Array.from(buildingsMap.values()).map((b) => ({
    code: b.code,
    name: b.name,
    floors: b.floors,
  }));

  return {
    success: true,
    errorCount: 0,
    errorsSummary: [],
    data: {
      branchCode: branchCode || expectedBranchCode,
      branchName: branchName || '',
      buildings: buildingsResult,
    },
  };
}




