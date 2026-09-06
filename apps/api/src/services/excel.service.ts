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
  branchName: string
): Promise<Buffer> {
  const cleanDomain = corporateDomain.replace(/^@/, '').trim() || 'company.com';
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MultiTenant DeskBooking Platform';

  // 1. Config Sheet (Contains domain & branch metadata)
  const configSheet = workbook.addWorksheet('Config');
  configSheet.state = 'hidden';
  configSheet.getCell('A1').value = 'CorporateDomain';
  configSheet.getCell('B1').value = cleanDomain;
  configSheet.getCell('A2').value = 'BranchCode';
  configSheet.getCell('B2').value = branchCode;
  configSheet.getCell('A3').value = 'BranchName';
  configSheet.getCell('B3').value = branchName;

  // 2. Employee Roster Sheet
  const sheet = workbook.addWorksheet('Employee Roster');
  sheet.views = [{ showGridLines: true }];

  // Header Row
  const headerRow = sheet.getRow(1);
  headerRow.values = [
    'Branch ID',
    'Branch Name',
    'Employee Full Name',
    'Department',
    'Corporate Email (Auto-Generated)',
    'Initial Temporary Password (Auto-Generated)',
  ];
  headerRow.font = { name: 'Segoe UI', size: 10, bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 26;

  // Header Colors
  // Col A & B: Navy Read-Only
  headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  headerRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  headerRow.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };

  // Col C & D: Yellow User-Input
  for (let c = 3; c <= 4; c++) {
    headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
    headerRow.getCell(c).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF002060' } };
  }

  // Col E & F: Green Formula-Assisted
  for (let c = 5; c <= 6; c++) {
    headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    headerRow.getCell(c).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF375623' } };
  }

  // Pre-fill 200 rows with formulas and locked branch info
  for (let r = 2; r <= 201; r++) {
    const row = sheet.getRow(r);
    row.height = 20;

    // Col A: Branch ID
    row.getCell(1).value = branchCode;
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } };
    row.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true };
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Col B: Branch Name
    row.getCell(2).value = branchName;
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } };
    row.getCell(2).font = { name: 'Segoe UI', size: 10 };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

    // Col C: Employee Full Name (Yellow input)
    row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    row.getCell(3).font = { name: 'Segoe UI', size: 10 };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

    // Col D: Department (Yellow input with dropdown validation)
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    row.getCell(4).font = { name: 'Segoe UI', size: 10 };
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Engineering,Product,Operations,Sales,Marketing,Human Resources,Finance,Legal"'],
      showErrorMessage: true,
      errorTitle: 'Invalid Department',
      error: 'Please choose a department from the dropdown list.',
    };

    // Col E: Corporate Email formula
    row.getCell(5).value = {
      formula: `IF(ISBLANK(C${r}), "", LOWER(SUBSTITUTE(TRIM(C${r}), " ", ".")) & "@" & Config!$B$1)`,
    };
    row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F8F2' } };
    row.getCell(5).font = { name: 'Segoe UI', size: 10 };
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };

    // Col F: Initial Password formula
    row.getCell(6).value = {
      formula: `IF(ISBLANK(C${r}), "", "DeskBook$" & YEAR(TODAY()) & "#" & UPPER(LEFT(TRIM(C${r}), 3)) & "!" & ROW())`,
    };
    row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F8F2' } };
    row.getCell(6).font = { name: 'Segoe UI', size: 10 };
    row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };
  }

  sheet.getColumn(1).width = 16;
  sheet.getColumn(2).width = 24;
  sheet.getColumn(3).width = 30;
  sheet.getColumn(4).width = 24;
  sheet.getColumn(5).width = 36;
  sheet.getColumn(6).width = 36;

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
    'Department',
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
    r.getCell(3).value = emp.department || '—';
    r.getCell(4).value = emp.isActive ? 'Active' : 'Deactivated';
    r.getCell(5).value = new Date(emp.createdAt).toLocaleDateString();

    const isDeactivated = !emp.isActive || emp.status === 'DEACTIVATED';
    if (isDeactivated) {
      r.getCell(4).font = { name: 'Segoe UI', size: 10, color: { argb: 'FFDC2626' }, bold: true };
    } else {
      r.getCell(4).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF16A34A' }, bold: true };
    }
  });

  sheet.getColumn(1).width = 30;
  sheet.getColumn(2).width = 36;
  sheet.getColumn(3).width = 24;
  sheet.getColumn(4).width = 18;
  sheet.getColumn(5).width = 20;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
